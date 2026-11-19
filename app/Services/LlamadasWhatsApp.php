<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\ConversationActivity;
use App\Models\Llamada;
use App\Models\Setting;
use App\Models\User;
use App\Support\TiempoReal;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Llamadas de WhatsApp ENTRANTES (Calling API de Meta), contestadas desde el navegador del asesor.
 *
 * Cómo va una llamada:
 *  1. El paciente toca «llamar» en el chat del hospital. Meta manda al webhook (campo «calls») un evento «connect» con
 *     la oferta SDP (los datos técnicos del audio). Se guarda la llamada y se avisa a las pantallas (tiempo real).
 *  2. Timbra en Evarisbot a quien puede atenderla (ver puedeAtender): administradores y, si el chat no es de nadie, los
 *     asesores de turno de la línea general; si es de un asesor, a él; si es de un equipo, a sus miembros.
 *  3. El primero que contesta: su navegador arma la respuesta SDP (WebRTC), el servidor la manda a Meta (pre_accept y
 *     accept) y el audio va directo entre Meta y ese navegador. Los demás dejan de timbrar.
 *  4. Al colgar cualquiera de los dos, Meta manda «terminate» con la duración: queda en el historial del chat.
 *
 * Horario (pedido del 19/11/2026: lunes a viernes de 6:30 a. m. a 4:00 p. m.): lo controla Evarisbot y no Meta, porque
 * el buzón de voz de Meta no funciona con su horario («When voicemail is enabled, turn off call hours»). Fuera de
 * horario la llamada se rechaza al instante; con el buzón activo en Meta, el paciente deja un mensaje de voz, que llega
 * al chat como audio (y se transcribe como los demás). Dentro de horario, si nadie contesta, Meta pasa al buzón sola.
 *
 * Nunca lanza hacia el webhook: un fallo aquí no puede frenar los mensajes de los pacientes.
 */
class LlamadasWhatsApp
{
    // La Calling API salió después de la v21 que usa el resto de la app: aquí va una versión que ya la trae.
    public const API = 'https://graph.facebook.com/v23.0';

    /** Horario de llamadas: días ISO (1 = lunes) y horas en hora de Colombia. */
    public const HORARIO_DIAS = [1, 2, 3, 4, 5];
    public const HORARIO_DESDE = '06:30';
    public const HORARIO_HASTA = '16:00';
    private const ZONA = 'America/Bogota';

    /**
     * Segundos que una llamada puede timbrar en las pantallas, contados desde que el paciente llamó (hora de Meta): un
     * segundo menos que la espera del buzón que se configuró en Meta (whatsapp:llamadas --espera, por defecto 25). Pasado
     * eso Meta ya la pasó al buzón y no se puede contestar. Sin buzón, Meta da 30-60 s: el tope queda en 45.
     */
    public const AJUSTE_ESPERA = 'llamadas_espera_buzon';

    public static function segundosTimbre(): int
    {
        try {
            $espera = (int) Setting::get(self::AJUSTE_ESPERA, '0');
        } catch (\Throwable) {
            $espera = 0;
        }

        return $espera > 0 ? max(10, min(45, $espera - 1)) : 45;
    }

    /** Estados de chat en los que el asesor asignado ya no lo está atendiendo: la llamada timbra al grupo. */
    private const CHAT_CERRADO = ['resolved', 'scheduled', 'closed'];

    /** Interruptor de Evarisbot (lo pone el comando whatsapp:llamadas al activar/desactivar en Meta). */
    public const AJUSTE_ACTIVAS = 'llamadas_activas';

    public static function activas(): bool
    {
        try {
            return Setting::get(self::AJUSTE_ACTIVAS, 'false') === 'true';
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Ensayo: mientras haya ids aquí, las llamadas SOLO les timbran a esos usuarios (nadie más las ve ni las puede
     * contestar, ni siquiera los otros administradores). Lo pone y lo quita whatsapp:llamadas --solo=… (19/11/2026:
     * probar con el número real sin que les suene a los asesores).
     */
    public const AJUSTE_ENSAYO = 'llamadas_ensayo_usuarios';

    /** @return int[] */
    public static function usuariosEnsayo(): array
    {
        try {
            $ids = json_decode((string) Setting::get(self::AJUSTE_ENSAYO, ''), true);
        } catch (\Throwable) {
            return [];
        }

        return is_array($ids) ? array_values(array_unique(array_filter(array_map('intval', $ids), fn ($i) => $i > 0))) : [];
    }

    /**
     * Ensayo: números (solo dígitos, con indicativo) que pueden llamar mientras dura. Ocultar el botón no es un bloqueo
     * total (Meta: quien tenga el contacto guardado aún puede llamar), así que en ensayo cualquier otro número se rechaza
     * al instante. Lo llena whatsapp:llamadas --boton.
     */
    public const AJUSTE_ENSAYO_NUMEROS = 'llamadas_ensayo_numeros';

    /** @return string[] */
    public static function numerosEnsayo(): array
    {
        try {
            $n = json_decode((string) Setting::get(self::AJUSTE_ENSAYO_NUMEROS, ''), true);
        } catch (\Throwable) {
            return [];
        }

        return is_array($n) ? array_values(array_filter(array_map(fn ($x) => preg_replace('/\D/', '', (string) $x), $n), fn ($x) => strlen($x) >= 8)) : [];
    }

    /**
     * Botón de llamar en el chat del hospital: DEFAULT (lo ven todos los pacientes) o DISABLE_ALL (oculto; solo sirve el
     * botón «Llamar» que se envía con whatsapp:llamadas --boton). Lo guarda el comando al activar.
     */
    public const AJUSTE_ICONO = 'llamadas_icono';

    public static function iconoLlamar(): string
    {
        try {
            return Setting::get(self::AJUSTE_ICONO, 'DEFAULT') === 'DISABLE_ALL' ? 'DISABLE_ALL' : 'DEFAULT';
        } catch (\Throwable) {
            return 'DEFAULT';
        }
    }

    /**
     * Ajustes que el administrador cambia en la pantalla «Llamadas» (pestaña Ajustes), con los valores por defecto del
     * pedido del 19/11/2026. Se guardan juntos, en JSON, en el ajuste «llamadas_ajustes».
     */
    public const AJUSTE_PANEL = 'llamadas_ajustes';

    /** @return array{dias: int[], desde: string, hasta: string, festivos: string[], modo: string, grupo: int[]} */
    public static function ajustes(): array
    {
        $porDefecto = ['dias' => self::HORARIO_DIAS, 'desde' => self::HORARIO_DESDE, 'hasta' => self::HORARIO_HASTA, 'festivos' => [], 'modo' => 'turno', 'grupo' => []];
        try {
            $guardado = json_decode((string) Setting::get(self::AJUSTE_PANEL, ''), true);
        } catch (\Throwable) {
            $guardado = null;
        }
        if (! is_array($guardado)) {
            return $porDefecto;
        }
        $hora = fn ($v, $d) => is_string($v) && preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $v) ? $v : $d;
        $dias = array_values(array_unique(array_filter(array_map('intval', (array) ($guardado['dias'] ?? [])), fn ($d) => $d >= 1 && $d <= 7)));
        sort($dias);

        return [
            'dias' => $dias,
            'desde' => $hora($guardado['desde'] ?? null, self::HORARIO_DESDE),
            'hasta' => $hora($guardado['hasta'] ?? null, self::HORARIO_HASTA),
            'festivos' => array_values(array_filter((array) ($guardado['festivos'] ?? []), fn ($f) => is_string($f) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $f))),
            'modo' => ($guardado['modo'] ?? 'turno') === 'grupo' ? 'grupo' : 'turno',
            'grupo' => array_values(array_unique(array_map('intval', (array) ($guardado['grupo'] ?? [])))),
        ];
    }

    public static function enHorario(?Carbon $momento = null): bool
    {
        $a = self::ajustes();
        $t = ($momento ?? now())->copy()->setTimezone(self::ZONA);
        $hhmm = $t->format('H:i');

        return in_array($t->dayOfWeekIso, $a['dias'], true)
            && ! in_array($t->format('Y-m-d'), $a['festivos'], true)
            && $hhmm >= $a['desde'] && $hhmm < $a['hasta'];
    }

    /**
     * ¿A este usuario le timbra la llamada (y puede contestarla)? Las fronteras de las bandejas (equipos, línea general):
     *  - administradores: siempre;
     *  - chat de un equipo: sus miembros;
     *  - chat abierto asignado a un asesor DE TURNO: ese asesor;
     *  - si no (sin asignar, resuelto/agendado, o su asesor ya no está de turno): los asesores de turno de la línea
     *    general (y el asignado, si lo hay). Que una llamada no se pierda porque quien cerró el chat se fue a casa.
     */
    public static function puedeAtender(User $user, ?Conversation $conversation): bool
    {
        $ensayo = self::usuariosEnsayo();
        if ($ensayo !== []) {
            return in_array((int) $user->id, $ensayo, true);
        }
        if ($user->isAdmin()) {
            return true;
        }
        if (! $user->isAdvisor()) {
            return false;
        }
        if ($conversation && $conversation->equipo_id) {
            return (int) $user->equipo_id === (int) $conversation->equipo_id;
        }
        if ($user->equipo_id) {
            return false;
        }
        // «Solo a un grupo elegido» (Ajustes): fuera de los equipos, solo los marcados (y los administradores).
        $ajustes = self::ajustes();
        if ($ajustes['modo'] === 'grupo') {
            return in_array((int) $user->id, $ajustes['grupo'], true);
        }
        $asignado = $conversation?->assigned_to ? (int) $conversation->assigned_to : null;
        if ($asignado === (int) $user->id) {
            return true;
        }
        $abierto = $conversation && ! in_array($conversation->status, self::CHAT_CERRADO, true);
        if ($asignado && $abierto && $conversation->assignedUser?->isOnDuty()) {
            return false; // lo atiende su asesor
        }

        return $user->isOnDuty();
    }

    /** Un cambio del webhook con field = «calls». */
    public function procesarCambio(array $value): void
    {
        // Errores de Meta sobre llamadas (p. ej. 131044 sin método de pago): van al lado de calls[], no dentro.
        foreach ((array) ($value['errors'] ?? []) as $err) {
            if (is_array($err)) {
                Log::warning('Llamada de WhatsApp: error de Meta', ['code' => $err['code'] ?? null, 'message' => mb_substr((string) ($err['message'] ?? ''), 0, 200), 'detalle' => mb_substr((string) ($err['error_data']['details'] ?? ''), 0, 300)]);
            }
        }
        foreach ((array) ($value['calls'] ?? []) as $call) {
            if (is_array($call) && ! empty($call['errors'])) {
                Log::warning('Llamada de WhatsApp: la llamada trae errores', ['evento' => $call['event'] ?? null, 'errores' => mb_substr(json_encode($call['errors'], JSON_UNESCAPED_UNICODE), 0, 500)]);
            }
        }
        foreach ((array) ($value['calls'] ?? []) as $call) {
            try {
                if (! is_array($call) || empty($call['id'])) {
                    continue;
                }
                $evento = (string) ($call['event'] ?? '');
                if ($evento === 'connect' && ($call['direction'] ?? 'USER_INITIATED') === 'USER_INITIATED') {
                    $this->entrante($call);
                } elseif ($evento === 'terminate') {
                    $this->terminada($call);
                } else {
                    Log::info('Llamada de WhatsApp: evento sin uso', ['evento' => $evento, 'direccion' => $call['direction'] ?? null]);
                }
            } catch (\Throwable $e) {
                Log::error('Llamada de WhatsApp: no se pudo procesar el evento', ['error' => $e->getMessage()]);
            }
        }
    }

    /**
     * El SDP termina en CRLF (RFC 8866; Meta lo pide con «\r\n»), pero el middleware global TrimStrings de Laravel le
     * quita el salto final a todo JSON que entra (el aviso de Meta y la respuesta que manda el navegador): se repone.
     */
    public static function sdpConFinal(string $sdp): string
    {
        $sdp = rtrim($sdp, "\r\n \t");

        return $sdp === '' ? '' : $sdp."\r\n";
    }

    /** Hora en que el paciente llamó según Meta (epoch del aviso); si no viene o es rara, ahora. */
    private static function horaDeMeta(array $call): Carbon
    {
        $ts = $call['timestamp'] ?? null;
        if (is_numeric($ts) && (int) $ts > 1_600_000_000 && (int) $ts <= now()->addMinutes(5)->getTimestamp()) {
            return Carbon::createFromTimestamp((int) $ts);
        }

        return now();
    }

    private function entrante(array $call): void
    {
        $wacid = (string) $call['id'];
        if (Llamada::where('wa_call_id', $wacid)->exists()) {
            return; // Meta reintentó el mismo aviso (o el fin llegó antes que el inicio: ya quedó registrada)
        }

        $from = preg_match('/^\d{8,15}$/', (string) ($call['from'] ?? '')) ? (string) $call['from'] : null;
        $conversation = $from ? Conversation::firstOrCreate(
            ['phone_number' => '+'.$from],
            ['status' => 'active', 'last_message_at' => now()]
        ) : null;
        $iniciada = self::horaDeMeta($call);

        $llamada = Llamada::create([
            'conversation_id' => $conversation?->id,
            'wa_call_id' => $wacid,
            'direccion' => 'entrante',
            'estado' => 'timbrando',
            'telefono' => $from,
            'iniciada_en' => $iniciada,
            'sdp_oferta' => self::sdpConFinal((string) ($call['session']['sdp'] ?? '')),
        ]);

        Log::info('Llamada de WhatsApp entrante', ['llamada_id' => $llamada->id, 'conversation_id' => $conversation?->id]);

        // Aviso que llegó tarde (Meta reintenta si no respondimos a tiempo): ya no se puede contestar. No timbra.
        if ($iniciada->lt(now()->subSeconds(self::segundosTimbre()))) {
            $llamada->update(['estado' => 'perdida', 'motivo' => 'aviso_tardio', 'terminada_en' => now(), 'sdp_oferta' => null]);

            return;
        }
        if ($conversation?->is_blocked) {
            $this->rechazar($llamada, 'bloqueado');

            return;
        }
        if (! self::activas()) {
            // Llamadas activadas en Meta pero apagadas en Evarisbot: nadie las vería timbrar.
            $this->rechazar($llamada, 'desactivadas');

            return;
        }
        if (self::usuariosEnsayo() !== [] && ! in_array((string) $from, self::numerosEnsayo(), true)) {
            // En ensayo solo llaman los números invitados: un paciente que llame igual no se queda timbrando en vano.
            $this->rechazar($llamada, 'ensayo');

            return;
        }
        if (! self::enHorario()) {
            $this->rechazar($llamada, 'fuera_de_horario');

            return;
        }
        if (($call['session']['sdp_type'] ?? '') !== 'offer' || $llamada->sdp_oferta === '') {
            $this->rechazar($llamada, 'sin_oferta');

            return;
        }

        TiempoReal::llamada($llamada->id, $conversation?->id);
    }

    private function terminada(array $call): void
    {
        $finMeta = mb_substr(strtoupper((string) (is_array($call['status'] ?? null) ? implode(',', $call['status']) : ($call['status'] ?? 'SIN_ESTADO'))), 0, 30);
        $duracion = isset($call['duration']) && is_numeric($call['duration']) ? (int) $call['duration'] : null;

        $llamada = Llamada::where('wa_call_id', (string) $call['id'])->first();
        if (! $llamada) {
            // El fin llegó antes que el inicio (avisos fuera de orden): se deja registrada ya cerrada, para que un
            // «connect» tardío del mismo id no haga timbrar una llamada que ya terminó. Si trae el número, queda en el
            // historial de su chat como perdida.
            $from = preg_match('/^\d{8,15}$/', (string) ($call['from'] ?? '')) ? (string) $call['from'] : null;
            $conversacion = $from ? Conversation::where('phone_number', '+'.$from)->first() : null;
            $cerrada = Llamada::firstOrCreate(['wa_call_id' => (string) $call['id']], [
                'conversation_id' => $conversacion?->id, 'telefono' => $from,
                'direccion' => 'entrante', 'estado' => 'perdida', 'motivo' => 'fin_sin_inicio',
                'iniciada_en' => self::horaDeMeta($call), 'terminada_en' => now(), 'duracion' => $duracion, 'fin_meta' => $finMeta,
            ]);
            if ($cerrada->wasRecentlyCreated) {
                $this->anotar($cerrada);
            }
            Log::info('Llamada de WhatsApp: llegó el fin de una llamada sin su inicio');

            return;
        }
        if ($llamada->fin_meta !== null) {
            return; // Meta repitió el aviso de fin: ya está anotada
        }

        $antes = $llamada->estado;
        $contestada = (bool) $llamada->contestada_en;
        $estado = match (true) {
            in_array($antes, ['en_curso', 'conectando', 'terminada'], true) && $contestada => 'terminada',
            in_array($antes, ['rechazada', 'fallida'], true) => $antes,
            default => 'perdida',
        };
        // Contestada y Meta la da por FALLIDA: se cortó (red), no es una llamada que terminó normal.
        $motivo = $estado === 'terminada' && str_contains($finMeta, 'FAIL') ? ($llamada->motivo ?: 'cortada') : $llamada->motivo;

        $llamada->update([
            'estado' => $estado,
            'motivo' => $motivo,
            'terminada_en' => $llamada->terminada_en ?? now(),
            'duracion' => $duracion ?? $llamada->duracion,
            'fin_meta' => $finMeta,
            'sdp_oferta' => null,
        ]);
        $this->anotar($llamada->fresh());
        TiempoReal::llamada($llamada->id, $llamada->conversation_id);
    }

    /**
     * Contestar: el navegador del asesor ya armó su respuesta SDP. Se la queda el primero (UPDATE atómico).
     *
     * @return array{ok: bool, error?: string}
     */
    public function contestar(Llamada $llamada, User $user, string $sdp): array
    {
        $tomada = Llamada::whereKey($llamada->id)->where('estado', 'timbrando')
            ->where(fn ($q) => self::aunTimbra($q))
            ->update(['estado' => 'conectando', 'atendida_por' => $user->id]);
        if ($tomada !== 1) {
            return ['ok' => false, 'error' => 'ya_no_timbra'];
        }
        TiempoReal::llamada($llamada->id, $llamada->conversation_id); // los demás dejan de timbrar

        $sesion = ['sdp_type' => 'answer', 'sdp' => self::sdpConFinal($sdp)];
        $pre = $this->meta('pre_accept', $llamada->wa_call_id, $sesion);
        $ok = $pre['ok'] ? $this->meta('accept', $llamada->wa_call_id, $sesion) : $pre;

        if (! $ok['ok']) {
            Llamada::whereKey($llamada->id)->where('estado', 'conectando')
                ->update(['estado' => 'fallida', 'motivo' => mb_substr('meta: '.($ok['error'] ?? ''), 0, 120)]);
            TiempoReal::llamada($llamada->id, $llamada->conversation_id);

            return ['ok' => false, 'error' => 'meta'];
        }

        // Solo si sigue «conectando»: si mientras tanto el asesor colgó o Meta la terminó, no se revive.
        $viva = Llamada::whereKey($llamada->id)->where('estado', 'conectando')
            ->update(['estado' => 'en_curso', 'contestada_en' => now(), 'sdp_oferta' => null]);
        TiempoReal::llamada($llamada->id, $llamada->conversation_id);
        if ($viva !== 1) {
            $this->meta('terminate', $llamada->wa_call_id); // ya no la quiere nadie: que no quede abierta en Meta

            return ['ok' => false, 'error' => 'ya_no_timbra'];
        }

        return ['ok' => true];
    }

    /** Condición «todavía puede timbrar»: desde que el paciente llamó (hora de Meta) no pasó el plazo. */
    public static function aunTimbra($query): void
    {
        $limite = now()->subSeconds(self::segundosTimbre());
        $query->where('iniciada_en', '>=', $limite)
            ->orWhere(fn ($q) => $q->whereNull('iniciada_en')->where('created_at', '>=', $limite));
    }

    /**
     * Colgar desde Evarisbot. El estado final (y la duración de Meta) llega con su «terminate».
     * $motivo: 'red' si el navegador perdió el audio; 'pestana' si se cerró la pestaña en plena llamada.
     */
    public function colgar(Llamada $llamada, ?string $motivo = null): bool
    {
        $r = $this->meta('terminate', $llamada->wa_call_id);
        $contestada = $llamada->contestada_en || $llamada->estado === 'en_curso';
        Llamada::whereKey($llamada->id)->whereIn('estado', Llamada::VIVAS)->update([
            'estado' => $contestada ? 'terminada' : 'perdida',
            'motivo' => $motivo ?? $llamada->motivo,
            'terminada_en' => now(),
            'duracion' => $llamada->contestada_en ? (int) round(abs(now()->diffInSeconds($llamada->contestada_en))) : null,
            'sdp_oferta' => null,
        ]);
        TiempoReal::llamada($llamada->id, $llamada->conversation_id);

        return $r['ok'];
    }

    private function rechazar(Llamada $llamada, string $motivo): void
    {
        $this->meta('reject', $llamada->wa_call_id);
        $llamada->update(['estado' => 'rechazada', 'motivo' => $motivo, 'terminada_en' => now(), 'sdp_oferta' => null]);
        TiempoReal::llamada($llamada->id, $llamada->conversation_id);
    }

    /**
     * Horario de llamadas para Meta, APAGADO (lo controla Evarisbot: el buzón de Meta no funciona con su horario). Meta
     * exige zona y horas aunque vaya apagado (error 100 «missing timezone_id / weekly_operating_hours», 19/11/2026): se
     * mandan las de la pantalla Llamadas, solo como dato.
     */
    public static function horarioMetaApagado(): array
    {
        $a = self::ajustes();
        $nombres = [1 => 'MONDAY', 2 => 'TUESDAY', 3 => 'WEDNESDAY', 4 => 'THURSDAY', 5 => 'FRIDAY', 6 => 'SATURDAY', 7 => 'SUNDAY'];
        $hhmm = fn (string $h) => str_replace(':', '', $h);
        $dias = $a['dias'] !== [] ? $a['dias'] : self::HORARIO_DIAS;

        return [
            'status' => 'DISABLED',
            'timezone_id' => self::ZONA,
            'weekly_operating_hours' => array_map(fn (int $d) => ['day_of_week' => $nombres[$d], 'open_time' => $hhmm($a['desde']), 'close_time' => $hhmm($a['hasta'])], $dias),
        ];
    }

    /** Id del audio del buzón en Meta (lo guarda whatsapp:llamadas --activar --anuncio=ID). */
    public const AJUSTE_ANUNCIO = 'llamadas_anuncio_id';

    /**
     * La espera antes del buzón cambió en la pantalla: si las llamadas están activas y hay anuncio, se le dice a Meta
     * (es el mismo ajuste de buzón que puso el comando de activación, con el tiempo nuevo). Devuelve un aviso para la
     * pantalla si Meta no lo aceptó, o null.
     */
    public function actualizarEsperaEnMeta(int $segundos): ?string
    {
        $anuncio = (string) Setting::get(self::AJUSTE_ANUNCIO, '');
        if (! self::activas() || $anuncio === '') {
            return null; // se aplicará al activar
        }
        try {
            $r = Http::withToken((string) Setting::get('whatsapp_token'))->timeout(15)
                ->post(self::API.'/'.Setting::get('whatsapp_phone_id').'/settings', ['calling' => [
                    'status' => 'ENABLED',
                    'call_icon_visibility' => self::iconoLlamar(),
                    'call_hours' => self::horarioMetaApagado(),
                    'voicemail' => [
                        'status' => 'ENABLED',
                        'triggers' => ['REJECT', 'TIMEOUT'],
                        'audio' => ['default' => ['announcement_media_id' => $anuncio, 'timeout_seconds' => max(0, min(30, $segundos))]],
                    ],
                ]]);
            if ($r->successful()) {
                return null;
            }
            Log::warning('Llamadas: Meta no aceptó la nueva espera del buzón', ['status' => $r->status(), 'error' => mb_substr((string) $r->json('error.message'), 0, 200)]);
        } catch (\Throwable $e) {
            Log::warning('Llamadas: no se pudo avisar a Meta la nueva espera del buzón', ['error' => mb_substr($e->getMessage(), 0, 200)]);
        }

        return 'meta';
    }

    /**
     * El mensaje de voz que dejó el paciente en el buzón llega por el webhook de mensajes como un audio cuyo id es el de
     * la llamada (wacid…): se une a su llamada para el Buzón de voz y para la línea «dejó un mensaje» del chat. Nunca
     * lanza (corre dentro del webhook).
     */
    public static function vincularBuzon(\App\Models\Message $mensaje): void
    {
        try {
            $wacid = (string) $mensaje->whatsapp_message_id;
            if ($mensaje->message_type !== 'audio' || ! str_starts_with($wacid, 'wacid.')) {
                return;
            }
            $llamada = Llamada::where('wa_call_id', $wacid)->first();
            if (! $llamada || $llamada->buzon_message_id) {
                return;
            }
            $llamada->update([
                'buzon_message_id' => $mensaje->id,
                'conversation_id' => $llamada->conversation_id ?? $mensaje->conversation_id,
            ]);
            TiempoReal::llamada($llamada->id, $llamada->conversation_id);
        } catch (\Throwable $e) {
            Log::warning('Llamada de WhatsApp: no se pudo unir el mensaje de voz a su llamada', ['message_id' => $mensaje->id, 'error' => $e->getMessage()]);
        }
    }

    /** Deja la llamada en el historial de actividad del chat (una línea por llamada, al terminar). */
    private function anotar(Llamada $llamada): void
    {
        if (! $llamada->conversation_id) {
            return;
        }
        try {
            ConversationActivity::create([
                'conversation_id' => $llamada->conversation_id,
                'user_id' => $llamada->atendida_por,
                'type' => 'llamada',
                'metadata' => [
                    'llamada_id' => $llamada->id,
                    'direccion' => $llamada->direccion,
                    'estado' => $llamada->estado,
                    'duracion' => $llamada->duracion,
                    'motivo' => $llamada->motivo,
                    'atendida_por_name' => $llamada->atendidaPor?->name,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::warning('Llamada de WhatsApp: no se pudo anotar en el historial', ['llamada_id' => $llamada->id, 'error' => $e->getMessage()]);
        }
    }

    /**
     * POST /{phone_number_id}/calls. Nunca lanza.
     *
     * @return array{ok: bool, error?: string}
     */
    private function meta(string $accion, string $callId, ?array $sesion = null): array
    {
        try {
            $cuerpo = ['messaging_product' => 'whatsapp', 'call_id' => $callId, 'action' => $accion];
            if ($sesion) {
                $cuerpo['session'] = $sesion;
            }
            $r = Http::withToken((string) Setting::get('whatsapp_token'))
                ->timeout(8)->connectTimeout(3)
                ->post(self::API.'/'.Setting::get('whatsapp_phone_id').'/calls', $cuerpo);
            if ($r->successful() && ($r->json('success') ?? true)) {
                return ['ok' => true];
            }
            $error = (string) ($r->json('error.message') ?? ('HTTP '.$r->status()));
            Log::warning('Llamada de WhatsApp: Meta no aceptó la acción', ['accion' => $accion, 'status' => $r->status(), 'error' => mb_substr($error, 0, 200), 'codigo' => $r->json('error.code')]);

            return ['ok' => false, 'error' => mb_substr($error, 0, 100)];
        } catch (\Throwable $e) {
            Log::warning('Llamada de WhatsApp: no se pudo hablar con Meta', ['accion' => $accion, 'error' => mb_substr($e->getMessage(), 0, 200)]);

            return ['ok' => false, 'error' => 'sin_conexion'];
        }
    }
}
