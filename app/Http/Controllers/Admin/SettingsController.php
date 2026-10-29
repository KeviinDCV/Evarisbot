<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Middleware\VerifyMetaSignature;
use App\Models\Conversation;
use App\Models\ConversationActivity;
use App\Models\Equipo;
use App\Models\Setting;
use App\Models\User;
use App\Services\InactiveConversationReleaser;
use App\Services\WebhookWatchdog;
use App\Services\WeekendNotice;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

/**
 * Configuración del sistema.
 *
 * Seguridad (incidente oct 2026): las claves e identificadores de WhatsApp y la clave de Groq ya no
 * se cambian desde la web. La página solo muestra si están guardadas y permite comprobarlas. Se
 * cambian en la consola del servidor: php artisan whatsapp:guardar-token (clave de acceso),
 * whatsapp:clave-verificacion, whatsapp:firma --guardar y groq:guardar-clave. Los identificadores
 * del número no tienen orden propia (tinker). Setting::set rechaza esas claves fuera de la consola.
 */
class SettingsController extends Controller
{
    /** Último perfil del número que devolvió Meta al pulsar «Comprobar ahora». */
    private const KEY_PERFIL = 'ajustes:perfil_whatsapp';

    public function index()
    {
        // Ningún carácter de los secretos sale hacia la página: solo si están guardados y cuándo cambiaron.
        $secretos = ['whatsapp_token', 'whatsapp_verify_token', VerifyMetaSignature::KEY_SECRET, 'groq_api_key'];
        $cambios = Setting::whereIn('key', $secretos)->pluck('updated_at', 'key');
        $clave = function (string $key) use ($cambios) {
            $guardada = filled(Setting::get($key));

            return [
                'guardada' => $guardada,
                'cambiada_en' => $guardada && isset($cambios[$key]) ? Carbon::parse($cambios[$key])->toIso8601String() : null,
            ];
        };

        $firma = $clave(VerifyMetaSignature::KEY_SECRET);

        $settings = [
            'whatsapp' => [
                'configurada' => filled(Setting::get('whatsapp_token')) && filled(Setting::get('whatsapp_phone_id')),
                'clave_acceso' => $clave('whatsapp_token'),
                'clave_verificacion' => $clave('whatsapp_verify_token'),
                'firma' => $firma['guardada']
                    ? (Setting::get(VerifyMetaSignature::KEY_MODE) === VerifyMetaSignature::MODE_ENFORCE ? 'exigida' : 'observar')
                    : 'sin_activar',
                'phone_id' => Setting::get('whatsapp_phone_id'),
                // Recordatorios y envíos masivos salen por esta otra clave: debe ser el mismo número.
                'phone_number_id' => Setting::get('whatsapp_phone_number_id'),
                'business_account_id' => Setting::get('whatsapp_business_account_id'),
                'webhook_url' => WebhookWatchdog::expectedWebhookUrl(),
                'perfil' => Cache::get(self::KEY_PERFIL),
            ],
            'groq' => [
                'clave' => $clave('groq_api_key'),
            ],
            'vigilancia' => [
                'revisado_en' => Cache::get(WebhookWatchdog::KEY_CHECKED_AT),
                // Última vez que Meta contestó de verdad (no basta con que la vigilancia corriera).
                'meta_ok_en' => Cache::get(WebhookWatchdog::KEY_META_OK),
            ],
        ];

        // Asesores para la sección de turnos (y la de equipos: con su equipo)
        $advisors = User::where('role', 'advisor')
            ->select('id', 'name', 'email', 'is_on_duty', 'equipo_id')
            ->orderBy('name')
            ->get();

        // Equipos aparte de la línea general (Teleconsulta…), con sus miembros y cuántos chats abiertos tienen.
        $equipos = Equipo::orderBy('nombre')->get()->map(fn (Equipo $e) => [
            'id' => $e->id,
            'nombre' => $e->nombre,
            'miembros' => User::where('equipo_id', $e->id)->orderBy('name')->pluck('id')->all(),
            'chats_abiertos' => Conversation::where('equipo_id', $e->id)->whereIn('status', ['active', 'pending'])->count(),
        ])->all();

        $autoRelease = InactiveConversationReleaser::settings();
        $weekendNotice = WeekendNotice::settings();

        return Inertia::render('admin/settings/index', [
            'weekendNotice' => [
                'enabled' => $weekendNotice['enabled'],
                'text' => $weekendNotice['text'],
                'default_text' => WeekendNotice::DEFAULT_TEXT,
                'max_length' => WeekendNotice::MAX_LENGTH,
            ],
            'settings' => $settings,
            'advisors' => $advisors,
            'equipos' => $equipos,
            'autoRelease' => [
                'enabled' => $autoRelease['enabled'],
                'minutes' => $autoRelease['minutes'],
                'min' => InactiveConversationReleaser::MIN_MINUTES,
                'max' => InactiveConversationReleaser::MAX_MINUTES,
            ],
        ]);
    }

    /**
     * Liberación automática: activar/desactivar y tiempo de espera sin respuesta del asesor.
     */
    public function updateAutoRelease(Request $request)
    {
        // Apagar nunca depende del tiempo: si el campo quedó mal, se conserva el guardado.
        $validated = $request->validate([
            'enabled' => 'required|boolean',
            'minutes' => 'required_if:enabled,true,1|nullable|integer|min:' . InactiveConversationReleaser::MIN_MINUTES . '|max:' . InactiveConversationReleaser::MAX_MINUTES,
        ], [
            'minutes.required_if' => 'Indica el tiempo sin respuesta.',
            'minutes.min' => 'El tiempo mínimo es de ' . InactiveConversationReleaser::MIN_MINUTES . ' minutos.',
            'minutes.max' => 'El tiempo máximo es de 30 días.',
        ]);

        if (isset($validated['minutes'])) {
            Setting::set(InactiveConversationReleaser::KEY_MINUTES, (string) $validated['minutes'], 'Minutos sin respuesta del asesor antes de liberar la conversación');
        }
        Setting::set(InactiveConversationReleaser::KEY_ENABLED, $validated['enabled'] ? 'true' : 'false', 'Liberación automática de conversaciones sin respuesta del asesor');

        return redirect()->back()->with('success', 'Liberación automática actualizada.');
    }

    /**
     * Mensaje de fin de semana: activar/desactivar y texto que recibe el paciente.
     */
    public function updateWeekendNotice(Request $request)
    {
        $validated = $request->validate([
            'enabled' => 'required|boolean',
            'text' => 'required_if:enabled,true,1|nullable|string|max:' . WeekendNotice::MAX_LENGTH,
        ], [
            'text.required_if' => 'Escribe el mensaje que recibirá el paciente.',
            'text.max' => 'El mensaje puede tener como máximo ' . WeekendNotice::MAX_LENGTH . ' caracteres.',
        ]);

        // Saltos de línea de Windows → \n (WhatsApp los muestra igual, y así no se duplican).
        $texto = trim(str_replace("\r\n", "\n", (string) ($validated['text'] ?? '')));
        if ($texto !== '') {
            Setting::set(WeekendNotice::KEY_TEXT, $texto, 'Mensaje automático que reciben los pacientes que escriben el fin de semana');
        }
        Setting::set(WeekendNotice::KEY_ENABLED, $validated['enabled'] ? 'true' : 'false', 'Mensaje automático de fin de semana');

        return redirect()->back()->with('success', 'Mensaje de fin de semana actualizado.');
    }

    /**
     * Cuántas conversaciones se liberarían ahora mismo con ese tiempo (solo consulta, no toca nada).
     */
    public function previewAutoRelease(Request $request, InactiveConversationReleaser $releaser)
    {
        $validated = $request->validate([
            'minutes' => 'required|integer|min:' . InactiveConversationReleaser::MIN_MINUTES . '|max:' . InactiveConversationReleaser::MAX_MINUTES,
        ]);

        return response()->json([
            'count' => $releaser->candidates((int) $validated['minutes'])->count(),
        ]);
    }

    /**
     * «Comprobar ahora»: corre en el momento la misma vigilancia que se hace sola cada 10 minutos
     * (clave aceptada, desvío del webhook, cola, disco…) y trae el perfil del número.
     *
     * Solo lee. Al navegador nunca llegan mensajes de excepción ni la respuesta cruda de Meta.
     */
    public function checkWhatsApp(WebhookWatchdog $watchdog)
    {
        $alertas = $watchdog->run();

        $perfil = null;
        if (isset($alertas['meta_config'])) {
            $meta = 'sin_config';
        } else {
            $perfil = $this->perfilWhatsApp();
            $desviado = isset($alertas['meta_override'])
                || collect(array_keys($alertas))->contains(fn ($codigo) => str_starts_with($codigo, 'meta_webhook_'));

            // «ok» solo si de verdad se revisaron la clave, la dirección y el desvío: si Meta no
            // contestó a alguna consulta, no se puede afirmar que todo esté bien.
            $meta = match (true) {
                isset($alertas['meta_token']) => 'rechazada',
                isset($alertas['meta_error']) => 'error_meta',
                $desviado => 'desviado',
                $perfil === null || ! $watchdog->metaCompleta() => 'sin_respuesta',
                default => 'ok',
            };
        }

        return response()->json([
            'meta' => $meta,
            // código => texto (la página separa las de Meta, que ya resume `meta`, de las demás).
            'alertas' => (object) $alertas,
            'perfil' => $perfil,
            'revisado_en' => Cache::get(WebhookWatchdog::KEY_CHECKED_AT),
            'meta_ok_en' => Cache::get(WebhookWatchdog::KEY_META_OK),
        ]);
    }

    /** Lo que Meta tiene registrado del número; null si no respondió. */
    private function perfilWhatsApp(): ?array
    {
        $token = Setting::get('whatsapp_token');
        $phoneId = Setting::get('whatsapp_phone_id');

        try {
            $response = Http::withToken((string) $token)
                ->timeout(8)
                ->connectTimeout(5)
                ->get("https://graph.facebook.com/v21.0/{$phoneId}", [
                    'fields' => 'verified_name,display_phone_number,quality_rating,whatsapp_business_manager_messaging_limit,messaging_limit_tier',
                ]);

            if (! $response->successful()) {
                Log::warning('Configuración: Meta no devolvió el perfil del número', ['status' => $response->status(), 'code' => $response->json('error.code')]);

                return null;
            }

            $perfil = [
                'nombre' => $response->json('verified_name'),
                'numero' => $response->json('display_phone_number'),
                'calidad' => $response->json('quality_rating'),
                // Meta pasó el límite al portafolio: el campo viejo llega vacío (comprobado el 15/10/2026).
                'limite' => $response->json('whatsapp_business_manager_messaging_limit') ?? $response->json('messaging_limit_tier'),
                'consultado_en' => now()->toIso8601String(),
            ];
            Cache::put(self::KEY_PERFIL, $perfil, now()->addDays(7));

            return $perfil;
        } catch (\Throwable $e) {
            Log::warning('Configuración: no se pudo consultar el perfil del número', ['error' => $e->getMessage()]);

            return null;
        }
    }

    /**
     * «Comprobar clave» de Groq: pregunta a Groq si acepta la clave guardada (lista de modelos).
     */
    public function checkGroq()
    {
        $apiKey = Setting::get('groq_api_key');

        if (blank($apiKey)) {
            return response()->json(['estado' => 'sin_clave']);
        }

        try {
            $response = Http::withToken((string) $apiKey)
                ->timeout(10)
                ->connectTimeout(5)
                ->get('https://api.groq.com/openai/v1/models');

            $estado = match (true) {
                $response->successful() => 'ok',
                in_array($response->status(), [401, 403], true) => 'rechazada',
                default => 'sin_respuesta',
            };

            if ($estado !== 'ok') {
                Log::warning('Configuración: Groq no aceptó la comprobación de la clave', ['status' => $response->status()]);
            }
        } catch (\Throwable $e) {
            Log::warning('Configuración: no se pudo hablar con Groq', ['error' => $e->getMessage()]);
            $estado = 'sin_respuesta';
        }

        return response()->json(['estado' => $estado]);
    }

    /**
     * Actualizar asesores de turno
     */
    /**
     * Crear o actualizar un equipo (nombre y miembros). Al entrar a un equipo, los chats que la persona tenía asignados
     * en la línea general vuelven a la bandeja general (ya no los vería); al salir, los del equipo que tenía asignados
     * quedan sin asignar en el equipo (sus compañeros los siguen viendo).
     */
    public function guardarEquipo(Request $request, ?Equipo $equipo = null)
    {
        $validated = $request->validate([
            'nombre' => 'required|string|max:80|unique:equipos,nombre' . ($equipo ? ',' . $equipo->id : ''),
            'miembros' => 'present|array',
            'miembros.*' => 'integer',
        ], [
            'nombre.required' => 'Escribe el nombre del equipo.',
            'nombre.unique' => 'Ya hay un equipo con ese nombre.',
        ]);

        $afectadas = [];
        DB::transaction(function () use ($validated, &$equipo, &$afectadas) {
            $equipo = $equipo ?? new Equipo();
            $equipo->nombre = trim($validated['nombre']);
            $equipo->save();

            // Solo asesores (los administradores ven todo y no van en equipos).
            $nuevos = User::whereIn('id', $validated['miembros'])->where('role', 'advisor')->pluck('id')->all();
            $antes = User::where('equipo_id', $equipo->id)->pluck('id')->all();

            $salen = array_values(array_diff($antes, $nuevos));
            if ($salen) {
                $sueltas = Conversation::where('equipo_id', $equipo->id)->whereIn('assigned_to', $salen)->pluck('id')->all();
                if ($sueltas) {
                    Conversation::whereIn('id', $sueltas)->update(['assigned_to' => null, 'assigned_at' => null]);
                    array_push($afectadas, ...$sueltas);
                }
                User::whereIn('id', $salen)->update(['equipo_id' => null]);
            }

            $entran = array_values(array_diff($nuevos, $antes));
            foreach ($entran as $id) {
                // Sus chats abiertos de la línea general (o de otro equipo) vuelven a su bandeja, sin asignar.
                $devueltos = Conversation::where('assigned_to', $id)
                    ->where(fn ($q) => $q->whereNull('equipo_id')->orWhere('equipo_id', '!=', $equipo->id))
                    ->whereIn('status', \App\Services\InactiveConversationReleaser::OPEN_STATUSES)
                    ->pluck('id');
                if ($devueltos->isNotEmpty()) {
                    Conversation::whereIn('id', $devueltos)->update(['assigned_to' => null, 'assigned_at' => null]);
                    array_push($afectadas, ...$devueltos->all());
                    foreach ($devueltos as $cid) {
                        ConversationActivity::log((int) $cid, 'unassigned', auth()->id(), ['reason' => 'equipo', 'equipo' => $equipo->nombre, 'released_from_id' => $id]);
                    }
                }
                // El turno es de la línea general: en un equipo no aplica (y así el bot tampoco lo cuenta).
                User::whereKey($id)->update(['equipo_id' => $equipo->id, 'is_on_duty' => false]);
            }
        });
        // Las pantallas abiertas sueltan (o recogen) esos chats sin esperar a recargar.
        \App\Support\TiempoReal::conversacion('conversacion', $afectadas);
        \App\Support\TiempoReal::paraTodos('conversacion');

        return redirect()->back()->with('success', 'Equipo guardado.');
    }

    /** Eliminar un equipo: sus chats vuelven a la línea general (sin asignar) y sus miembros, también. */
    public function eliminarEquipo(Equipo $equipo)
    {
        $afectadas = [];
        DB::transaction(function () use ($equipo, &$afectadas) {
            $afectadas = Conversation::where('equipo_id', $equipo->id)->pluck('id')->all();
            Conversation::where('equipo_id', $equipo->id)->update(['equipo_id' => null, 'assigned_to' => null, 'assigned_at' => null]);
            User::where('equipo_id', $equipo->id)->update(['equipo_id' => null]);
            // Sus envíos masivos pasan a la línea general, como sus chats (y uno en curso ya no mueve chats).
            \App\Models\BulkSend::where('equipo_id', $equipo->id)->update(['equipo_id' => null]);
            $equipo->delete();
        });
        \App\Support\TiempoReal::conversacion('conversacion', $afectadas);
        \App\Support\TiempoReal::paraTodos('conversacion');

        return redirect()->back()->with('success', 'Equipo eliminado: sus chats volvieron a la línea general.');
    }

    public function updateOnDutyAdvisors(Request $request)
    {
        // Sin exists: un asesor borrado con la página abierta no debe tumbar todo el guardado; el
        // whereIn de abajo ya ignora los que no son asesores.
        $validated = $request->validate([
            'advisor_ids' => 'present|array',
            'advisor_ids.*' => 'integer',
        ]);

        // En una transacción: nunca queda un instante sin nadie de turno a la vista de un paciente.
        DB::transaction(function () use ($validated) {
            User::where('role', 'advisor')->update(['is_on_duty' => false]);

            if (! empty($validated['advisor_ids'])) {
                User::whereIn('id', $validated['advisor_ids'])
                    ->where('role', 'advisor')
                    ->whereNull('equipo_id') // el turno es de la línea general: un equipo recibe siempre los suyos
                    ->update(['is_on_duty' => true]);
            }
        });

        return redirect()->back()->with('success', 'Asesores de turno actualizados exitosamente.');
    }
}
