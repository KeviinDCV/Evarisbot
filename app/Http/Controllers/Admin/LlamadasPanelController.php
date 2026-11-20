<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Middleware\VerifyMetaSignature;
use App\Models\Llamada;
use App\Models\Setting;
use App\Models\User;
use App\Services\LlamadasWhatsApp;
use App\Support\LibroExcel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

/**
 * Pantalla «Llamadas» (solo administradores; diseño aprobado el 19/11/2026: design/vista-llamadas): lo que pasa ahora
 * («En vivo»), las cifras del periodo y cuatro pestañas: Historial, Buzón de voz, Indicadores y Ajustes.
 *
 * La pantalla pide cada parte por su ruta JSON (como Estadísticas): así «En vivo» se refresca solo con cada aviso de
 * tiempo real sin volver a calcular el historial. Las fechas se cuentan en hora de Colombia.
 */
class LlamadasPanelController extends Controller
{
    private const ZONA = 'America/Bogota';
    private const POR_PAGINA = 25;
    /** Tope de llamadas que se leen para un periodo (sobra: hoy entran decenas al día). */
    private const TOPE_PERIODO = 20000;

    public function index(Request $request)
    {
        return Inertia::render('admin/llamadas/index', [
            'activas' => LlamadasWhatsApp::activas(),
            'tabInicial' => in_array($request->query('tab'), ['historial', 'buzon', 'indicadores', 'ajustes'], true) ? $request->query('tab') : 'historial',
        ]);
    }

    // ── En vivo ─────────────────────────────────────────────────────────────────────────────────────────────────────

    public function enVivo(): JsonResponse
    {
        $conectados = User::whereIn('role', ['admin', 'advisor'])
            ->where('last_activity_at', '>=', now()->subMinutes(5))
            ->get(['id', 'name', 'role', 'is_on_duty', 'equipo_id']);

        $timbrando = Llamada::with(['conversation:id,contact_name,phone_number,equipo_id,assigned_to,status', 'conversation.assignedUser:id,is_on_duty'])
            ->where('estado', 'timbrando')->where(fn ($q) => LlamadasWhatsApp::aunTimbra($q))
            ->orderBy('id')->get()
            ->map(function (Llamada $l) use ($conectados) {
                $a = $conectados->filter(fn (User $u) => LlamadasWhatsApp::puedeAtender($u, $l->conversation));

                return $this->fila($l) + [
                    'espera' => $l->inicio() ? max(0, now()->getTimestamp() - $l->inicio()->getTimestamp()) : 0,
                    'le_timbra_asesores' => $a->where('role', 'advisor')->count(),
                    'le_timbra_admins' => $a->where('role', 'admin')->count(),
                ];
            })->values();

        $enCurso = Llamada::with(['conversation:id,contact_name,phone_number', 'atendidaPor:id,name'])
            ->whereIn('estado', ['conectando', 'en_curso'])->where('updated_at', '>=', now()->subHours(3))
            ->orderBy('id')->get()
            ->map(fn (Llamada $l) => $this->fila($l) + [
                'atendio' => $l->atendidaPor?->name,
                'desde' => ($l->contestada_en ?? $l->updated_at)?->toIso8601String(),
            ])->values();

        $a = LlamadasWhatsApp::ajustes();

        return response()->json([
            'activas' => LlamadasWhatsApp::activas(),
            'timbrando' => $timbrando,
            'en_curso' => $enCurso,
            'asesores_turno_conectados' => $conectados->filter(fn (User $u) => $u->role === 'advisor' && $u->is_on_duty && ! $u->equipo_id)->count(),
            'horario' => ['dias' => $a['dias'], 'desde' => $a['desde'], 'hasta' => $a['hasta'], 'abierto' => LlamadasWhatsApp::enHorario()],
            'buzon_sin_resolver' => $this->buzonSinResolver(),
            // Cuánto timbra antes del buzón: la pantalla cuenta hacia atrás cuando nadie puede contestar.
            'segundos_timbre' => LlamadasWhatsApp::segundosTimbre(),
        ]);
    }

    // ── Cifras, historial e indicadores del periodo ─────────────────────────────────────────────────────────────────

    public function cifras(Request $request): JsonResponse
    {
        [$desde, $hasta] = $this->periodo($request);
        $todas = $this->delPeriodo($desde, $hasta);

        return response()->json($this->resumen($todas));
    }

    public function historial(Request $request): JsonResponse
    {
        [$desde, $hasta] = $this->periodo($request);
        $filas = $this->filtrar($this->delPeriodo($desde, $hasta), $request);
        $pagina = max(1, (int) $request->query('pagina', 1));

        return response()->json([
            'total' => $filas->count(),
            'pagina' => $pagina,
            'paginas' => max(1, (int) ceil($filas->count() / self::POR_PAGINA)),
            'filas' => $filas->slice(($pagina - 1) * self::POR_PAGINA, self::POR_PAGINA)->map(fn (Llamada $l) => $this->filaHistorial($l))->values(),
            'asesores' => User::whereIn('role', ['admin', 'advisor'])->orderBy('name')->get(['id', 'name'])->map(fn ($u) => ['id' => $u->id, 'name' => $u->name]),
        ]);
    }

    public function indicadores(Request $request): JsonResponse
    {
        [$desde, $hasta] = $this->periodo($request);
        $todas = $this->delPeriodo($desde, $hasta)->filter(fn (Llamada $l) => ! in_array($l->resultado(), ['timbrando', 'en_curso'], true));
        $a = LlamadasWhatsApp::ajustes();
        $horaDesde = (int) substr($a['desde'], 0, 2);
        $horaHasta = (int) ceil(((int) substr($a['hasta'], 0, 2) * 60 + (int) substr($a['hasta'], 3, 2)) / 60);

        // Por hora del día (Colombia) dentro del horario; lo de fuera de horario va en una barra aparte.
        $barras = [];
        for ($h = $horaDesde; $h < max($horaDesde + 1, $horaHasta); $h++) {
            $barras[$h] = ['hora' => $h, 'atendidas' => 0, 'buzon' => 0, 'perdidas' => 0];
        }
        $fuera = ['hora' => null, 'atendidas' => 0, 'buzon' => 0, 'perdidas' => 0];
        foreach ($todas as $l) {
            $inicio = $l->inicio()?->copy()->setTimezone(self::ZONA);
            if (! $inicio) {
                continue;
            }
            $clave = match ($l->resultado()) {
                'atendida', 'cortada' => 'atendidas',
                'buzon' => 'buzon',
                default => 'perdidas',
            };
            $dentro = LlamadasWhatsApp::enHorario($inicio) && isset($barras[(int) $inicio->format('G')]);
            if ($dentro) {
                $barras[(int) $inicio->format('G')][$clave]++;
            } else {
                $fuera[$clave]++;
            }
        }

        // Por asesor (las que contestó cada uno).
        $atendidas = $todas->filter(fn (Llamada $l) => $l->atendida_por && $l->contestada_en);
        $nombres = User::whereIn('id', $atendidas->pluck('atendida_por')->unique())->pluck('name', 'id');
        $porAsesor = $atendidas->groupBy('atendida_por')->map(fn (Collection $g, $id) => [
            'id' => (int) $id,
            'nombre' => $nombres[$id] ?? '—',
            'atendidas' => $g->count(),
            'hablando' => (int) $g->sum('duracion'),
            'duracion_promedio' => (int) round($g->avg('duracion') ?? 0),
            'espera_promedio' => (int) round($g->map(fn ($l) => $l->espera())->filter(fn ($v) => $v !== null)->avg() ?? 0),
            'cortadas' => $g->filter(fn ($l) => $l->resultado() === 'cortada')->count(),
        ])->sortByDesc('atendidas')->values();

        return response()->json([
            'por_hora' => array_values($barras),
            'fuera_de_horario' => $fuera,
            'resumen' => $this->resumen($todas),
            'por_asesor' => $porAsesor,
        ]);
    }

    public function exportar(Request $request)
    {
        [$desde, $hasta] = $this->periodo($request);
        $filas = $this->filtrar($this->delPeriodo($desde, $hasta), $request);

        $carpeta = LibroExcel::carpeta();
        $libro = new LibroExcel('Llamadas', ['A' => 12, 'B' => 10, 'C' => 30, 'D' => 18, 'E' => 18, 'F' => 28, 'G' => 10, 'H' => 10], $carpeta);
        $libro->encabezados(['Fecha', 'Hora', 'Paciente', 'Teléfono', 'Resultado', 'Atendió', 'Esperó (s)', 'Duración (s)'], '2e3f84');
        foreach ($filas as $l) {
            $f = $this->filaHistorial($l);
            $inicio = $l->inicio()?->copy()->setTimezone(self::ZONA);
            $libro->fila([
                $inicio?->format('Y-m-d'), $inicio?->format('g:i a'), $f['nombre'], $f['telefono'],
                self::ETIQUETAS[$f['resultado']] ?? $f['resultado'], $f['atendio'], $f['espera'], $f['duracion'],
            ]);
        }
        $nombre = 'llamadas_'.now(self::ZONA)->format('Y-m-d_Hi').'.xlsx';
        $temp = tempnam($carpeta, 'lla');
        try {
            $libro->guardar($temp);
        } catch (\Throwable $e) {
            @unlink($temp);
            throw $e;
        }
        Log::info('Llamadas exportadas', ['filas' => $filas->count(), 'user_id' => auth()->id()]);

        return response()->download($temp, $nombre, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    /** Textos del resultado para el Excel (la pantalla usa sus traducciones). */
    private const ETIQUETAS = [
        'timbrando' => 'Timbrando', 'en_curso' => 'En curso', 'atendida' => 'Atendida', 'cortada' => 'Se cortó',
        'buzon' => 'Dejó mensaje de voz', 'fuera_horario' => 'Fuera de horario', 'fallida' => 'No se pudo conectar', 'perdida' => 'Perdida',
    ];

    // ── Buzón de voz ────────────────────────────────────────────────────────────────────────────────────────────────

    public function buzon(Request $request): JsonResponse
    {
        $filtro = in_array($request->query('filtro'), ['resueltos', 'todos'], true) ? $request->query('filtro') : 'sin_resolver';
        $q = Llamada::with(['conversation:id,contact_name,phone_number', 'buzonMensaje:id,media_url,transcription,content,created_at', 'resueltoPor:id,name'])
            ->whereNotNull('buzon_message_id');
        if ($filtro === 'sin_resolver') {
            $q->whereNull('buzon_resuelto_en');
        } elseif ($filtro === 'resueltos') {
            $q->whereNotNull('buzon_resuelto_en')->where('created_at', '>=', now()->subDays(60));
        } else {
            $q->where('created_at', '>=', now()->subDays(60));
        }
        $filas = $q->latest('id')->limit(300)->get();

        $buscar = mb_strtolower(trim((string) $request->query('buscar', '')));
        if ($buscar !== '') {
            $filas = $filas->filter(fn (Llamada $l) => str_contains(mb_strtolower(implode(' ', [
                $l->conversation?->contact_name, $l->telefono, $l->conversation?->phone_number, $l->buzonMensaje?->transcription,
            ])), $buscar));
        }

        return response()->json([
            'sin_resolver' => $this->buzonSinResolver(),
            'filas' => $filas->values()->map(fn (Llamada $l) => $this->fila($l) + [
                'cuando' => $l->inicio()?->toIso8601String(),
                'fuera_de_horario' => $l->motivo === 'fuera_de_horario',
                'audio' => $l->buzonMensaje?->media_url,
                'transcripcion' => $l->buzonMensaje?->transcription,
                'resuelto_en' => $l->buzon_resuelto_en?->toIso8601String(),
                'resuelto_por' => $l->resueltoPor?->name,
            ]),
        ]);
    }

    public function resolverBuzon(Request $request, Llamada $llamada): JsonResponse
    {
        abort_unless($llamada->buzon_message_id, 404);
        $deshacer = $request->boolean('deshacer');
        $llamada->update([
            'buzon_resuelto_por' => $deshacer ? null : auth()->id(),
            'buzon_resuelto_en' => $deshacer ? null : now(),
        ]);
        \App\Support\TiempoReal::llamada($llamada->id, $llamada->conversation_id);

        return response()->json(['ok' => true, 'sin_resolver' => $this->buzonSinResolver()]);
    }

    private function buzonSinResolver(): int
    {
        return Llamada::whereNotNull('buzon_message_id')->whereNull('buzon_resuelto_en')->count();
    }

    // ── Ajustes y conexión ──────────────────────────────────────────────────────────────────────────────────────────

    public function ajustes(): JsonResponse
    {
        return response()->json([
            'ajustes' => LlamadasWhatsApp::ajustes(),
            'espera' => (int) (Setting::get(LlamadasWhatsApp::AJUSTE_ESPERA, '25') ?: 25),
            'usuarios' => User::whereIn('role', ['admin', 'advisor'])->whereNull('equipo_id')->orderBy('name')
                ->get(['id', 'name', 'role'])->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'role' => $u->role]),
        ]);
    }

    public function guardarAjustes(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'dias' => 'present|array|max:7',
            'dias.*' => 'integer|between:1,7',
            'desde' => ['required', 'string', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'hasta' => ['required', 'string', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/', 'after:desde'],
            'festivos' => 'present|array|max:60',
            'festivos.*' => 'date_format:Y-m-d',
            'modo' => 'required|in:turno,grupo',
            'grupo' => 'present|array|max:200',
            'grupo.*' => 'integer|exists:users,id',
            'espera' => 'required|integer|between:5,30',
        ], [
            'hasta.after' => 'La hora de cierre debe ser después de la de apertura.',
            'espera.between' => 'La espera antes del buzón va de 5 a 30 segundos.',
        ]);
        if ($datos['modo'] === 'grupo' && $datos['grupo'] === []) {
            return response()->json(['message' => 'Elija al menos una persona para el grupo que atiende llamadas.', 'errors' => ['grupo' => ['Elija al menos una persona.']]], 422);
        }

        $festivos = array_values(array_unique($datos['festivos']));
        sort($festivos);
        Setting::set(LlamadasWhatsApp::AJUSTE_PANEL, json_encode([
            'dias' => array_values(array_unique(array_map('intval', $datos['dias']))),
            'desde' => $datos['desde'],
            'hasta' => $datos['hasta'],
            'festivos' => $festivos,
            'modo' => $datos['modo'],
            'grupo' => array_values(array_unique(array_map('intval', $datos['grupo']))),
        ]), 'Llamadas de WhatsApp: horario, festivos y a quién le timbra (pantalla Llamadas)');

        $esperaAntes = (int) (Setting::get(LlamadasWhatsApp::AJUSTE_ESPERA, '0') ?: 0);
        $avisoMeta = null;
        if ((int) $datos['espera'] !== $esperaAntes) {
            Setting::set(LlamadasWhatsApp::AJUSTE_ESPERA, (string) $datos['espera'], 'Segundos antes del buzón de voz de Meta (0 = sin buzón)');
            $avisoMeta = app(LlamadasWhatsApp::class)->actualizarEsperaEnMeta((int) $datos['espera']);
            if ($avisoMeta !== null) {
                // WhatsApp siguió con la espera anterior: el timbre de Evarisbot también, para no quedar desfasados
                // (y así el próximo «Guardar» lo vuelve a intentar).
                Setting::set(LlamadasWhatsApp::AJUSTE_ESPERA, (string) $esperaAntes, 'Segundos antes del buzón de voz de Meta (0 = sin buzón)');
            }
        }
        Log::info('Llamadas: ajustes guardados', ['user_id' => auth()->id(), 'modo' => $datos['modo'], 'espera' => $datos['espera']]);

        return response()->json(['ok' => true, 'ajustes' => LlamadasWhatsApp::ajustes(), 'aviso_meta' => $avisoMeta]);
    }

    /** Estado de la conexión con WhatsApp (solo lectura). Lo que pregunta a Meta se recuerda 10 minutos. */
    public function conexion(Request $request): JsonResponse
    {
        $clave = 'llamadas:conexion';
        if ($request->boolean('refrescar')) {
            Cache::forget($clave);
        }
        $meta = Cache::remember($clave, 600, fn () => $this->preguntarAMeta());
        $secreto = Setting::get(VerifyMetaSignature::KEY_SECRET);

        return response()->json([
            'numero' => $meta['numero'],
            'campo_calls' => $meta['campo_calls'],
            'firma' => is_string($secreto) && $secreto !== '' ? 'ok' : 'falta',
            'anuncio' => Setting::get(LlamadasWhatsApp::AJUSTE_ANUNCIO) ? 'ok' : 'falta',
            'llamadas_meta' => $meta['llamadas_meta'],
            'activas' => LlamadasWhatsApp::activas(),
        ]);
    }

    /** @return array{numero: string, campo_calls: string, llamadas_meta: string} ok | falta | desconocido */
    private function preguntarAMeta(): array
    {
        $token = (string) Setting::get('whatsapp_token');
        $id = (string) Setting::get('whatsapp_phone_id');
        $api = 'https://graph.facebook.com/v21.0';
        $r = ['numero' => 'desconocido', 'campo_calls' => 'desconocido', 'llamadas_meta' => 'desconocido'];
        if ($token === '' || $id === '') {
            return $r;
        }
        try {
            $n = Http::withToken($token)->timeout(8)->get("$api/$id", ['fields' => 'whatsapp_business_manager_messaging_limit,quality_rating']);
            if ($n->successful()) {
                $limite = (string) $n->json('whatsapp_business_manager_messaging_limit');
                $r['numero'] = in_array($limite, ['TIER_2K', 'TIER_10K', 'TIER_100K', 'TIER_UNLIMITED'], true) && $n->json('quality_rating') !== 'RED' ? 'ok' : 'falta';
            }
            $s = Http::withToken($token)->timeout(8)->get("$api/$id/settings");
            if ($s->successful()) {
                $r['llamadas_meta'] = $s->json('calling.status') === 'ENABLED' ? 'ok' : 'falta';
            }
            // El campo «calls» del webhook solo se puede leer con el token de la app (id|App Secret).
            $secreto = Setting::get(VerifyMetaSignature::KEY_SECRET);
            $app = Http::withToken($token)->timeout(8)->get("$api/app", ['fields' => 'id']);
            if (is_string($secreto) && $secreto !== '' && $app->successful() && $app->json('id')) {
                $sub = Http::timeout(8)->get("$api/".$app->json('id').'/subscriptions', ['access_token' => $app->json('id').'|'.$secreto]);
                if ($sub->successful()) {
                    $campos = collect($sub->json('data') ?? [])->firstWhere('object', 'whatsapp_business_account')['fields'] ?? [];
                    $nombres = collect($campos)->map(fn ($c) => is_array($c) ? ($c['name'] ?? '') : $c)->all();
                    $r['campo_calls'] = in_array('calls', $nombres, true) ? 'ok' : 'falta';
                }
            }
        } catch (\Throwable $e) {
            Log::warning('Llamadas: no se pudo consultar a Meta el estado de la conexión', ['error' => mb_substr($e->getMessage(), 0, 200)]);
        }

        return $r;
    }

    // ── Ayudantes ───────────────────────────────────────────────────────────────────────────────────────────────────

    /** @return array{0: Carbon, 1: Carbon} Inicio y fin del periodo en UTC. */
    private function periodo(Request $request): array
    {
        $ahora = now(self::ZONA);
        $hoy = $ahora->copy()->startOfDay();
        [$desde, $hasta] = match ($request->query('periodo')) {
            'semana' => [$hoy->copy()->startOfWeek(Carbon::MONDAY), $ahora],
            'mes' => [$hoy->copy()->startOfMonth(), $ahora],
            'rango' => $this->rango($request, $hoy, $ahora),
            default => [$hoy, $ahora],
        };

        return [$desde->copy()->utc(), $hasta->copy()->utc()];
    }

    private function rango(Request $request, Carbon $hoy, Carbon $ahora): array
    {
        try {
            $d = Carbon::createFromFormat('Y-m-d', (string) $request->query('desde'), self::ZONA)->startOfDay();
            $h = Carbon::createFromFormat('Y-m-d', (string) $request->query('hasta'), self::ZONA)->endOfDay();
        } catch (\Throwable) {
            return [$hoy, $ahora];
        }
        if ($h->lt($d)) {
            [$d, $h] = [$h->copy()->startOfDay(), $d->copy()->endOfDay()];
        }
        if ($d->diffInDays($h) > 366) {
            $d = $h->copy()->subDays(366)->startOfDay();
        }

        return [$d, $h];
    }

    /** Llamadas entrantes del periodo, de la más reciente a la más vieja. */
    private function delPeriodo(Carbon $desde, Carbon $hasta): Collection
    {
        return Llamada::with(['conversation:id,contact_name,phone_number', 'atendidaPor:id,name'])
            ->where('direccion', 'entrante')
            ->whereBetween('created_at', [$desde, $hasta])
            ->latest('id')->limit(self::TOPE_PERIODO)->get();
    }

    private function filtrar(Collection $filas, Request $request): Collection
    {
        $resultado = (string) $request->query('resultado', '');
        $atendio = (int) $request->query('atendio', 0);
        $buscar = mb_strtolower(trim((string) $request->query('buscar', '')));
        $digitos = preg_replace('/\D/', '', $buscar);

        return $filas->filter(function (Llamada $l) use ($resultado, $atendio, $buscar, $digitos) {
            if ($resultado !== '' && $l->resultado() !== $resultado) {
                return false;
            }
            if ($atendio && (int) $l->atendida_por !== $atendio) {
                return false;
            }
            if ($buscar !== '') {
                $nombre = mb_strtolower((string) $l->conversation?->contact_name);
                $tel = preg_replace('/\D/', '', (string) ($l->telefono ?? $l->conversation?->phone_number));
                if (! str_contains($nombre, $buscar) && ($digitos === '' || ! str_contains($tel, $digitos))) {
                    return false;
                }
            }

            return true;
        })->values();
    }

    private function resumen(Collection $todas): array
    {
        $porResultado = $todas->countBy(fn (Llamada $l) => $l->resultado());
        $atendidas = $todas->filter(fn (Llamada $l) => in_array($l->resultado(), ['atendida', 'cortada'], true));

        return [
            'total' => $todas->count(),
            'atendidas' => ($porResultado['atendida'] ?? 0) + ($porResultado['cortada'] ?? 0),
            'buzon' => $porResultado['buzon'] ?? 0,
            'perdidas' => ($porResultado['perdida'] ?? 0) + ($porResultado['fuera_horario'] ?? 0) + ($porResultado['fallida'] ?? 0),
            'en_curso' => ($porResultado['en_curso'] ?? 0) + ($porResultado['timbrando'] ?? 0),
            'espera_promedio' => (int) round($atendidas->map(fn ($l) => $l->espera())->filter(fn ($v) => $v !== null)->avg() ?? 0),
            'duracion_promedio' => (int) round($atendidas->avg('duracion') ?? 0),
        ];
    }

    private function fila(Llamada $l): array
    {
        return [
            'id' => $l->id,
            'conversation_id' => $l->conversation_id,
            'nombre' => $l->conversation?->contact_name,
            'telefono' => $l->telefono ?? ltrim((string) $l->conversation?->phone_number, '+'),
        ];
    }

    private function filaHistorial(Llamada $l): array
    {
        return $this->fila($l) + [
            'inicio' => $l->inicio()?->toIso8601String(),
            'resultado' => $l->resultado(),
            'atendio' => $l->atendidaPor?->name,
            'espera' => $l->espera(),
            'duracion' => $l->duracion,
        ];
    }
}
