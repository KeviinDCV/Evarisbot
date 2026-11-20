<?php

namespace App\Support;

use App\Jobs\RondaLlamadasJob;
use App\Models\Appointment;
use App\Models\Conversation;
use App\Models\Llamada;
use App\Models\PermisoLlamada;
use App\Services\LlamadasWhatsApp;
use App\Services\RecordatoriosPorLlamada;
use App\Services\RobotLlamadas;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * RONDAS DE RECORDATORIOS POR LLAMADA en la pantalla Citas (diseño aprobado el 20/11/2026, lienzo «Recordatorios por
 * llamada en Citas»). Un administrador pulsa «Llamar a N» y el robot (App\Services\RobotLlamadas) llama, de a pocos a
 * la vez, a los pacientes con cita el próximo día hábil que recibieron el recordatorio de WhatsApp, NO respondieron y
 * dieron permiso (App\Models\PermisoLlamada). Lo que marcan queda en la cita (RecordatoriosPorLlamada::tecla).
 *
 * El estado vive en settings, por ámbito (clave «llamadas_ronda», con el prefijo de EnvioRecordatorios), y se lee
 * directo de la tabla. Las cifras NO se guardan: se cuentan siempre sobre la tabla llamadas (origen 'robot', cita_id),
 * así una llamada que termina después de cerrar la ronda igual queda contada.
 *
 * La ronda avanza con RondaLlamadasJob: una «vuelta» cada SEGUNDOS_ENTRE_VUELTAS en la cola de siempre. Cada vuelta
 * lanza como mucho UNA llamada nueva y nunca más de SIMULTANEAS vivas. Solo vale la cadena cuyo token coincide con el
 * guardado: pausar/detener lo borran (la cadena vieja se apaga sola) y reanudar pone uno nuevo.
 */
class RondaLlamadas
{
    public const CLAVE = 'llamadas_ronda';

    /** Llamadas del robot vivas a la vez como máximo. */
    public const SIMULTANEAS = 3;

    public const SEGUNDOS_ENTRE_VUELTAS = 5;

    /** Meta: llamadas iniciadas por la empresa y CONTESTADAS por número, en 24 horas. */
    public const LIMITE_META_24H = 100;

    /**
     * Horario de las llamadas automáticas, por día ISO (1 = lunes): el mismo que fija la ley 2300 de 2023 para llamar a
     * usuarios (lunes a viernes de 7 a. m. a 7 p. m. y sábados de 8 a. m. a 3 p. m.; ni domingos ni festivos).
     */
    public const HORARIO = [
        1 => ['07:00', '19:00'],
        2 => ['07:00', '19:00'],
        3 => ['07:00', '19:00'],
        4 => ['07:00', '19:00'],
        5 => ['07:00', '19:00'],
        6 => ['08:00', '15:00'],
    ];

    /** No se llama por una cita que empieza en menos de esto (minutos). */
    public const MINUTOS_ANTES_DE_LA_CITA = 60;

    /** Recordatorio que salió y el paciente no respondió (los únicos a los que se llama). */
    public const SIN_RESPONDER = ['sent', 'delivered', 'read'];

    /** Fallos seguidos al llamar (robot o Meta) tras los que la ronda se corta: algo general está mal. */
    private const FALLOS_PARA_CORTAR = 3;

    /** Sin vueltas durante este tiempo, la pantalla avisa que la ronda no avanza (¿worker detenido?). */
    private const SEGUNDOS_SIN_AVANZAR = 90;

    /* ── Estado ───────────────────────────────────────────────────────────────────────────────────── */

    public static function leer(string $service): ?array
    {
        $r = json_decode((string) EnvioRecordatorios::leer($service, self::CLAVE), true);

        return is_array($r) && isset($r['id'], $r['estado']) ? $r : null;
    }

    private static function guardar(string $service, array $r): void
    {
        EnvioRecordatorios::guardar($service, self::CLAVE, json_encode($r, JSON_UNESCAPED_UNICODE));
    }

    /**
     * Cambio atómico del estado (un candado por ámbito: la vuelta de la cola y los botones escriben el mismo JSON).
     * Devuelve el estado que quedó, o null si no hay ronda. Lanza LockTimeoutException si el candado no se libera.
     */
    public static function mutar(string $service, callable $cambio): ?array
    {
        return Cache::lock('ronda-llamadas-'.$service, 20)->block(8, function () use ($service, $cambio) {
            $r = self::leer($service);
            if (! $r) {
                return null;
            }
            $nuevo = $cambio($r);
            if (! is_array($nuevo)) {
                return $r;
            }
            if ($nuevo !== $r) {
                self::guardar($service, $nuevo);
            }

            return $nuevo;
        });
    }

    public static function activa(?array $r): bool
    {
        return $r !== null && in_array($r['estado'] ?? '', ['en_curso', 'pausada'], true);
    }

    /* ── Horario, fecha y tope de Meta ─────────────────────────────────────────────────────────────── */

    /** Festivo: los de Colombia (calculados) y los que el administrador anotó en Llamadas → Ajustes. */
    public static function esFestivo(string $ymd): bool
    {
        if (in_array($ymd, self::festivosColombia((int) substr($ymd, 0, 4)), true)) {
            return true;
        }
        try {
            return in_array($ymd, LlamadasWhatsApp::ajustes()['festivos'], true);
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Festivos de Colombia de un año ('Y-m-d'): fijos, los que la ley Emiliani (ley 51 de 1983) corre al lunes siguiente y
     * los que dependen de la Pascua.
     *
     * @return string[]
     */
    public static function festivosColombia(int $anio): array
    {
        static $cache = [];
        if (isset($cache[$anio])) {
            return $cache[$anio];
        }
        $fecha = fn (int $m, int $d) => Carbon::create($anio, $m, $d, 0, 0, 0, Recordatorios::ZONA);
        $alLunes = fn (Carbon $d) => $d->dayOfWeekIso === 1 ? $d : $d->copy()->next(Carbon::MONDAY);

        // Domingo de Pascua (algoritmo anónimo gregoriano).
        $a = $anio % 19;
        $b = intdiv($anio, 100);
        $c = $anio % 100;
        $d = intdiv($b, 4);
        $e = $b % 4;
        $f = intdiv($b + 8, 25);
        $g = intdiv($b - $f + 1, 3);
        $h = (19 * $a + $b - $d - $g + 15) % 30;
        $i = intdiv($c, 4);
        $k = $c % 4;
        $l = (32 + 2 * $e + 2 * $i - $h - $k) % 7;
        $m = intdiv($a + 11 * $h + 22 * $l, 451);
        $mes = intdiv($h + $l - 7 * $m + 114, 31);
        $dia = (($h + $l - 7 * $m + 114) % 31) + 1;
        $pascua = $fecha($mes, $dia);

        $dias = [
            $fecha(1, 1), $fecha(5, 1), $fecha(7, 20), $fecha(8, 7), $fecha(12, 8), $fecha(12, 25),
            $alLunes($fecha(1, 6)), $alLunes($fecha(3, 19)), $alLunes($fecha(6, 29)), $alLunes($fecha(8, 15)),
            $alLunes($fecha(10, 12)), $alLunes($fecha(11, 1)), $alLunes($fecha(11, 11)),
            $pascua->copy()->subDays(3), $pascua->copy()->subDays(2),   // Jueves y Viernes Santo
            $pascua->copy()->addDays(43), $pascua->copy()->addDays(64), $pascua->copy()->addDays(71), // Ascensión, Corpus, Sagrado Corazón (lunes)
        ];

        return $cache[$anio] = array_values(array_unique(array_map(fn (Carbon $x) => $x->format('Y-m-d'), $dias)));
    }

    /**
     * Modo de prueba de las llamadas (el mismo criterio que las entrantes, las del asesor y la prueba del robot): hay
     * ensayo si hay usuarios de ensayo; entonces solo se llama a los números invitados, y con la lista vacía, a nadie.
     *
     * @return array{activo: bool, invitados: string[]}
     */
    public static function ensayo(): array
    {
        return ['activo' => LlamadasWhatsApp::usuariosEnsayo() !== [], 'invitados' => LlamadasWhatsApp::numerosEnsayo()];
    }

    private static function fueraDelEnsayo(array $ensayo, string $telefono): bool
    {
        return $ensayo['activo'] && ! in_array(PermisoLlamada::digitos($telefono), $ensayo['invitados'], true);
    }

    public static function enHorario(?Carbon $momento = null): bool
    {
        $t = ($momento ?? now())->copy()->setTimezone(Recordatorios::ZONA);
        $franja = self::HORARIO[$t->dayOfWeekIso] ?? null;
        if (! $franja || self::esFestivo($t->format('Y-m-d'))) {
            return false;
        }
        $hm = $t->format('H:i');

        return $hm >= $franja[0] && $hm < $franja[1];
    }

    /** Cuándo se puede volver a llamar ('Y-m-d H:i', hora de Colombia), o null si ya se puede. */
    public static function proximaApertura(?Carbon $momento = null): ?string
    {
        $t = ($momento ?? now())->copy()->setTimezone(Recordatorios::ZONA);
        if (self::enHorario($t)) {
            return null;
        }
        for ($i = 0; $i < 15; $i++) {
            $dia = $t->copy()->startOfDay()->addDays($i);
            $franja = self::HORARIO[$dia->dayOfWeekIso] ?? null;
            if (! $franja || self::esFestivo($dia->format('Y-m-d'))) {
                continue;
            }
            $abre = $dia->copy()->setTimeFromTimeString($franja[0]);
            if ($t->lt($abre)) {
                return $abre->format('Y-m-d H:i');
            }
        }

        return null;
    }

    /** Las citas por las que se llama: las del próximo día que no sea domingo ni festivo. */
    public static function fechaObjetivo(): string
    {
        $d = now(Recordatorios::ZONA)->startOfDay()->addDay();
        for ($i = 0; $i < 7 && ($d->dayOfWeekIso === 7 || self::esFestivo($d->format('Y-m-d'))); $i++) {
            $d->addDay();
        }

        return $d->format('Y-m-d');
    }

    /** Llamadas que hizo Evarisbot (robot o asesor) y el paciente contestó, en las últimas 24 horas. */
    public static function usadas24h(): int
    {
        return Llamada::where('created_at', '>=', now()->subHours(25))
            ->where('direccion', 'saliente')
            ->whereNotNull('contestada_en')
            ->where('contestada_en', '>=', now()->subDay())
            ->count();
    }

    /* ── A quién se llama ─────────────────────────────────────────────────────────────────────────── */

    /**
     * Las citas de esa fecha que no respondieron el WhatsApp, separadas: con_permiso (a las que se llama, en orden de
     * hora: ids), sin_permiso, ya_llamadas (ya se llamó por ellas), fuera_ensayo (fuera de los números invitados en el
     * modo de prueba) y otras (sin chat, bloqueadas o ya muy cerca de la hora).
     *
     * @return array{fecha: string, no_respondieron: int, con_permiso: int, sin_permiso: int, ya_llamadas: int, fuera_ensayo: int, otras: int, ids: int[]}
     */
    public static function candidatos(string $service, string $fecha): array
    {
        $filas = Appointment::where('service', $service)
            ->where('citfc', $fecha)
            ->where('reminder_sent', true)
            ->whereIn('reminder_status', self::SIN_RESPONDER)
            ->orderBy('cithor')->orderBy('id')
            ->get(['id', 'conversation_id', 'citfc', 'cithor']);

        $ids = $filas->pluck('id')->map(fn ($i) => (int) $i)->all();
        $llamadas = $ids === [] ? [] : array_flip(Llamada::where('origen', 'robot')->whereIn('cita_id', $ids)->pluck('cita_id')->map(fn ($i) => (int) $i)->all());
        $chats = Conversation::whereIn('id', $filas->pluck('conversation_id')->filter()->unique()->values()->all())
            ->get(['id', 'phone_number', 'is_blocked'])->keyBy('id');
        $permisos = self::permisos($chats->pluck('phone_number')->all());
        $ensayo = self::ensayo();

        $cuenta =['con_permiso' => 0, 'sin_permiso' => 0, 'ya_llamadas' => 0, 'fuera_ensayo' => 0, 'otras' => 0];
        $elegibles = [];
        foreach ($filas as $f) {
            if (isset($llamadas[(int) $f->id])) {
                $cuenta['ya_llamadas']++;

                continue;
            }
            $chat = $f->conversation_id ? $chats->get($f->conversation_id) : null;
            if (! $chat || $chat->is_blocked) {
                $cuenta['otras']++;

                continue;
            }
            $tel = PermisoLlamada::digitos($chat->phone_number);
            if (($permisos[$tel] ?? null) !== true) {
                $cuenta['sin_permiso']++;

                continue;
            }
            if (self::fueraDelEnsayo($ensayo, $tel)) {
                $cuenta['fuera_ensayo']++;

                continue;
            }
            if (! self::aTiempo($f)) {
                $cuenta['otras']++;

                continue;
            }
            $cuenta['con_permiso']++;
            $elegibles[] = (int) $f->id;
        }

        return ['fecha' => $fecha, 'no_respondieron' => $filas->count()] + $cuenta + ['ids' => $elegibles];
    }

    /**
     * La última respuesta real (sí o no) de cada teléfono, en pocas consultas.
     *
     * @param  array<int, ?string>  $telefonos
     * @return array<string, bool>
     */
    public static function permisos(array $telefonos): array
    {
        $tels = array_values(array_unique(array_filter(array_map(fn ($t) => PermisoLlamada::digitos($t), $telefonos))));
        $out = [];
        foreach (array_chunk($tels, 500) as $lote) {
            PermisoLlamada::whereIn('telefono', $lote)->whereNotNull('acepta')->orderBy('id')->get(['telefono', 'acepta'])
                ->each(function ($p) use (&$out) {
                    $out[(string) $p->telefono] = (bool) $p->acepta;
                });
        }

        return $out;
    }

    /** ¿Todavía tiene sentido llamar? Cita de un día que no pasó y, si es hoy, que falte más de una hora. */
    public static function aTiempo(object $cita): bool
    {
        $fecha = Recordatorios::fechaDe($cita->citfc ?? null);
        $hoy = Recordatorios::hoy();
        if ($fecha === null || $fecha < $hoy) {
            return false;
        }
        if ($fecha > $hoy) {
            return true;
        }
        $hora = Recordatorios::horaDe($cita instanceof Appointment ? $cita->getRawOriginal('cithor') : ($cita->cithor ?? null));

        // Las horas de las citas se guardan en hora de Colombia (no en UTC como el resto).
        return $hora !== null && $hora > now(Recordatorios::ZONA)->addMinutes(self::MINUTOS_ANTES_DE_LA_CITA)->format('H:i');
    }

    /* ── Cifras ───────────────────────────────────────────────────────────────────────────────────── */

    /**
     * Cómo va una llamada del robot, para las cifras de la ronda. Una llamada «viva» de hace más de 5 minutos ya no
     * cuenta como viva (se perdió el aviso de fin): cuenta por lo que alcanzó a pasar.
     */
    public static function categoria(Llamada $l): string
    {
        if ($l->resultado_robot === 'confirmo') {
            return 'confirmaron';
        }
        if ($l->resultado_robot === 'cancelo') {
            return 'cancelaron';
        }
        if (in_array($l->estado, Llamada::VIVAS, true) && $l->created_at && $l->created_at->gt(now()->subMinutes(5))) {
            return $l->estado === 'en_curso' ? 'hablando' : 'sonando';
        }
        if ($l->contestada_en) {
            return 'no_marcaron';
        }
        if ($l->estado === 'fallida') {
            return 'no_se_pudo';
        }

        return 'no_contestaron';
    }

    /** Lo que ve la lista de citas en la columna Respuesta. */
    public static function resultadoFila(Llamada $l): string
    {
        return match (self::categoria($l)) {
            'confirmaron' => 'confirmo',
            'cancelaron' => 'cancelo',
            'sonando', 'hablando' => 'en_curso',
            'no_marcaron' => 'sin_marcar',
            'no_se_pudo' => 'no_se_pudo',
            default => $l->estado === 'rechazada' ? 'rechazo' : 'no_contesto',
        };
    }

    /** @return array<string, int> */
    public static function conteo(array $r): array
    {
        $ids = array_values(array_unique(array_map('intval', (array) ($r['ids'] ?? []))));
        $omitidas = array_map('intval', array_keys((array) ($r['omitidas'] ?? [])));
        $c = [
            'total' => count($ids), 'confirmaron' => 0, 'cancelaron' => 0, 'no_contestaron' => 0, 'no_marcaron' => 0,
            'no_se_pudo' => 0, 'sonando' => 0, 'hablando' => 0, 'omitidas' => 0,
        ];
        $hechas = [];
        if ($ids !== []) {
            foreach (Llamada::where('origen', 'robot')->whereIn('cita_id', $ids)->get(['id', 'cita_id', 'estado', 'contestada_en', 'resultado_robot', 'created_at']) as $l) {
                if (isset($hechas[(int) $l->cita_id])) {
                    continue;
                }
                $hechas[(int) $l->cita_id] = true;
                $c[self::categoria($l)]++;
            }
        }
        $c['omitidas'] = count(array_diff(array_intersect($omitidas, $ids), array_keys($hechas)));
        $c['en_curso'] = $c['sonando'] + $c['hablando'];
        $c['por_llamar'] = max(0, $c['total'] - count($hechas) - $c['omitidas']);
        // Terminadas = llamadas hechas que ya acabaron (las omitidas no son llamadas): total = por_llamar + en_curso + terminadas + omitidas.
        $c['terminadas'] = max(0, count($hechas) - $c['en_curso']);

        return $c;
    }

    /** La ronda tal como la pinta la pantalla (estado + cifras contadas ahora). */
    public static function resumen(string $service): ?array
    {
        $r = self::leer($service);
        if (! $r) {
            return null;
        }
        // Una ronda en marcha o en pausa de una fecha que ya pasó (quedó así de un día para otro) se cierra.
        if (self::activa($r) && ($r['fecha_citas'] ?? '') < Recordatorios::hoy()) {
            try {
                $r = self::cerrar($service, null, 'cortada', 'vencida') ?? $r;
            } catch (\Throwable) {
                // Se cierra en la próxima lectura.
            }
        }
        $latido = null;
        try {
            $latido = isset($r['latido']) ? Carbon::parse((string) $r['latido']) : null;
        } catch (\Throwable) {
        }

        return [
            'id' => (string) $r['id'],
            'estado' => (string) $r['estado'],
            'motivo' => $r['motivo'] ?? null,
            'fecha_citas' => (string) ($r['fecha_citas'] ?? ''),
            'iniciado_por' => $r['iniciado_por'] ?? null,
            'inicio' => $r['inicio'] ?? null,
            'fin' => $r['fin'] ?? null,
            'sin_avanzar' => ($r['estado'] ?? '') === 'en_curso' && (! $latido || $latido->lt(now()->subSeconds(self::SEGUNDOS_SIN_AVANZAR))),
        ] + self::conteo($r);
    }

    /** Lo que muestra la sección antes de llamar (cifras de la próxima fecha, horario, tope de Meta, robot). */
    public static function cifras(string $service): array
    {
        if (! LlamadasWhatsApp::activas()) {
            return ['activas' => false];
        }
        $cand = self::candidatos($service, self::fechaObjetivo());
        unset($cand['ids']);
        $usadas = self::usadas24h();
        $quedan = max(0, self::LIMITE_META_24H - $usadas);

        return [
            'activas' => true,
            'robot' => RobotLlamadas::disponible(),
            'ensayo' => self::ensayo()['activo'],
            'en_horario' => self::enHorario(),
            'abre' => self::proximaApertura(),
            'limite' => self::LIMITE_META_24H,
            'usadas' => $usadas,
            'quedan' => $quedan,
            'salen' => min($cand['con_permiso'], $quedan),
        ] + $cand;
    }

    /* ── Iniciar, pausar, reanudar, detener ───────────────────────────────────────────────────────── */

    /** Deja la ronda en marcha y encola la primera vuelta. Quien llama ya comprobó que no había otra activa. */
    public static function iniciar(string $service, string $fecha, array $ids, ?string $quien): array
    {
        $token = bin2hex(random_bytes(8));
        $r = [
            'id' => (string) Str::uuid(),
            'token' => $token,
            'estado' => 'en_curso',
            'motivo' => null,
            'fecha_citas' => $fecha,
            'ids' => array_values(array_map('intval', $ids)),
            'omitidas' => [],
            'iniciado_por' => $quien,
            'inicio' => Recordatorios::ahoraCol(),
            'fin' => null,
            'latido' => now()->toIso8601String(),
            'fallos_seguidos' => 0,
        ];
        self::guardar($service, $r);
        RondaLlamadasJob::dispatch($service, $token);

        return $r;
    }

    public static function pausar(string $service): ?array
    {
        return self::mutar($service, fn (array $r) => ($r['estado'] ?? '') === 'en_curso' ? array_merge($r, ['estado' => 'pausada', 'token' => null]) : $r);
    }

    public static function reanudar(string $service): ?array
    {
        $token = bin2hex(random_bytes(8));
        $r = self::mutar($service, fn (array $r) => ($r['estado'] ?? '') === 'pausada'
            ? array_merge($r, ['estado' => 'en_curso', 'token' => $token, 'latido' => now()->toIso8601String(), 'fallos_seguidos' => 0])
            : $r);
        if (($r['token'] ?? null) === $token) {
            RondaLlamadasJob::dispatch($service, $token);
        }

        return $r;
    }

    public static function detener(string $service): ?array
    {
        return self::cerrar($service, null, 'detenida', null);
    }

    /** Cierra la ronda (si $token no es null, solo si sigue siendo la de esa cadena). Las llamadas vivas terminan solas. */
    public static function cerrar(string $service, ?string $token, string $estado, ?string $motivo): ?array
    {
        return self::mutar($service, function (array $r) use ($token, $estado, $motivo) {
            if (! self::activa($r) || ($token !== null && ($r['token'] ?? null) !== $token)) {
                return $r;
            }
            Log::info('Ronda de llamadas cerrada', ['ronda' => $r['id'], 'estado' => $estado, 'motivo' => $motivo]);

            return array_merge($r, ['estado' => $estado, 'motivo' => $motivo, 'fin' => Recordatorios::ahoraCol(), 'token' => null]);
        });
    }

    /* ── La vuelta (la corre RondaLlamadasJob) ────────────────────────────────────────────────────── */

    /** Una vuelta de la cadena $token. Devuelve true si hay que programar la siguiente. */
    public static function vuelta(string $service, string $token): bool
    {
        $r = self::mutar($service, fn (array $r) => ($r['token'] ?? null) === $token && ($r['estado'] ?? '') === 'en_curso'
            ? array_merge($r, ['latido' => now()->toIso8601String()])
            : $r);
        if (! $r || ($r['token'] ?? null) !== $token || ($r['estado'] ?? '') !== 'en_curso') {
            return false; // pausada, detenida, cerrada u otra cadena
        }

        $c = self::conteo($r);
        if ($c['por_llamar'] === 0) {
            if ($c['en_curso'] === 0) {
                self::cerrar($service, $token, 'terminada', null);

                return false;
            }

            return true; // esperar a que terminen las que están sonando o hablando
        }

        $corte = self::motivoDeCorte($r);
        if ($corte !== null) {
            self::cerrar($service, $token, 'cortada', $corte);

            return false;
        }

        if ($c['en_curso'] < self::SIMULTANEAS) {
            $siguiente = self::siguiente($r);
            if ($siguiente !== null) {
                self::llamarCita($service, $token, $siguiente);
            }
        }

        return true;
    }

    /** Por qué no se puede seguir llamando (o null). */
    private static function motivoDeCorte(array $r): ?string
    {
        return match (true) {
            ($r['fecha_citas'] ?? '') < Recordatorios::hoy() => 'vencida',
            ! LlamadasWhatsApp::activas() => 'desactivadas',
            ! self::enHorario() => 'horario',
            self::usadas24h() >= self::LIMITE_META_24H => 'limite',
            ! RobotLlamadas::disponible() => 'robot',
            default => null,
        };
    }

    /** La primera cita de la ronda (en orden de hora) por la que aún no se llamó ni se omitió. */
    private static function siguiente(array $r): ?int
    {
        $ids = array_map('intval', (array) ($r['ids'] ?? []));
        if ($ids === []) {
            return null;
        }
        $hechas = array_flip(Llamada::where('origen', 'robot')->whereIn('cita_id', $ids)->pluck('cita_id')->map(fn ($i) => (int) $i)->all());
        $omitidas = (array) ($r['omitidas'] ?? []);
        foreach ($ids as $id) {
            if (! isset($hechas[$id]) && ! array_key_exists($id, $omitidas)) {
                return $id;
            }
        }

        return null;
    }

    /** Llama por UNA cita, revisando antes que todavía aplique (pudo responder por WhatsApp mientras tanto). */
    private static function llamarCita(string $service, string $token, int $citaId): void
    {
        $candado = Cache::lock('llamada-cita-'.$citaId, 120);
        if (! $candado->get()) {
            return;
        }
        try {
            if (Llamada::where('origen', 'robot')->where('cita_id', $citaId)->exists()) {
                return;
            }
            $cita = Appointment::find($citaId);
            $chat = $cita?->conversation_id ? Conversation::find($cita->conversation_id) : null;
            $motivo = match (true) {
                ! $cita => 'no_existe',
                ! RecordatoriosPorLlamada::sePuedeLlamar($cita, $chat) => 'ya_no_aplica',
                ! self::aTiempo($cita) => 'tarde',
                self::fueraDelEnsayo(self::ensayo(), (string) $chat->phone_number) => 'ensayo',
                default => null,
            };
            if ($motivo !== null) {
                self::omitir($service, $token, $citaId, $motivo);

                return;
            }

            // El mismo número ya está en otra llamada (otra cita suya, de este u otro ámbito): Meta respondería «ocupado».
            // No se omite: queda «por llamar» y una vuelta siguiente la intenta cuando termine la otra.
            $tel = PermisoLlamada::digitos($chat->phone_number);
            if (Llamada::where('telefono', $tel)->whereIn('estado', Llamada::VIVAS)->where('created_at', '>', now()->subMinutes(5))->exists()) {
                return;
            }

            // ¿Sigue en marcha? (la vuelta revisó el token al empezar; el admin pudo pausar o detener desde entonces). Se
            // pregunta aquí y otra vez justo antes de marcar, después de que el robot fabrica los audios (tarda segundos).
            $sigue = function () use ($service, $token) {
                $r = self::leer($service);

                return ($r['token'] ?? null) === $token && ($r['estado'] ?? '') === 'en_curso';
            };
            if (! $sigue()) {
                return;
            }

            $resultado = app(LlamadasWhatsApp::class)->llamarRobot($chat, RecordatoriosPorLlamada::textos($cita), $cita->id, $sigue);
            if ($resultado['ok'] ?? false) {
                self::mutar($service, fn (array $r) => ($r['token'] ?? null) === $token ? array_merge($r, ['fallos_seguidos' => 0]) : $r);

                return;
            }

            $error = (string) ($resultado['error'] ?? 'meta');
            if ($error === 'cancelada') {
                return; // pausaron o detuvieron mientras se preparaba: no se marcó ni cuenta como fallo
            }
            Log::warning('Ronda de llamadas: no se pudo llamar', ['cita_id' => $citaId, 'error' => $error]);
            $fila = $resultado['llamada'] ?? null;
            // Un fallo que no es del paciente (el robot, la red, la cuenta de Meta) no «gasta» su cita: la fila deja de
            // apuntar a ella y la cita se omite solo en ESTA ronda (otra ronda la puede volver a intentar).
            $general = ! $fila
                || str_starts_with((string) $fila->motivo, 'robot:')
                || in_array($error, ['sin_conexion', 'limite', 'desactivadas', 'sin_pago', 'meta', 'ocupado'], true);
            if ($general) {
                if ($fila) {
                    Llamada::whereKey($fila->id)->update(['cita_id' => null]);
                }
                self::omitir($service, $token, $citaId, $error);
            }
            // Lo que es de toda la cuenta corta la ronda; lo de un paciente (sin permiso de Meta, sin WhatsApp, tope de
            // llamadas a ese paciente) cuenta como «no se pudo» y se sigue. Tres fallos seguidos también cortan.
            $corte = match ($error) {
                'limite' => 'limite',
                'desactivadas' => 'desactivadas',
                'sin_pago' => 'sin_pago',
                default => null,
            };
            $r = self::mutar($service, fn (array $r) => ($r['token'] ?? null) === $token ? array_merge($r, ['fallos_seguidos' => (int) ($r['fallos_seguidos'] ?? 0) + 1]) : $r);
            if ($corte === null && (int) ($r['fallos_seguidos'] ?? 0) >= self::FALLOS_PARA_CORTAR) {
                $corte = RobotLlamadas::disponible() ? 'fallos' : 'robot';
            }
            if ($corte !== null) {
                self::cerrar($service, $token, 'cortada', $corte);
            }
        } finally {
            $candado->release();
        }
    }

    private static function omitir(string $service, string $token, int $citaId, string $motivo): void
    {
        Log::info('Ronda de llamadas: cita omitida', ['cita_id' => $citaId, 'motivo' => $motivo]);
        self::mutar($service, function (array $r) use ($token, $citaId, $motivo) {
            if (($r['token'] ?? null) !== $token) {
                return $r;
            }
            $omitidas = (array) ($r['omitidas'] ?? []);
            $omitidas[$citaId] = mb_substr($motivo, 0, 30);

            return array_merge($r, ['omitidas' => $omitidas]);
        });
    }

    /* ── La lista de citas ────────────────────────────────────────────────────────────────────────── */

    /**
     * Añade a cada fila (Recordatorios::fila) lo de la llamada: 'llamada' => {resultado, hora} si el robot llamó por
     * esa cita, y 'sin_permiso_llamada' => true si su fecha tuvo ronda, no respondió y no se llamó porque el número no
     * dio permiso. Nunca lanza: sin esto la lista se ve como antes.
     *
     * @param  array<int, array<string, mixed>>  $filas
     * @return array<int, array<string, mixed>>
     */
    public static function anotarFilas(array $filas, string $service): array
    {
        try {
            $ids = array_values(array_filter(array_map(fn ($f) => (int) ($f['id'] ?? 0), $filas)));
            if ($ids === []) {
                return $filas;
            }
            $llamadas = Llamada::where('origen', 'robot')->whereIn('cita_id', $ids)->orderBy('id')
                ->get(['id', 'cita_id', 'estado', 'contestada_en', 'resultado_robot', 'iniciada_en', 'created_at'])
                ->keyBy('cita_id');

            $fechas = self::fechasConRonda($service);
            $porRevisar = [];
            foreach ($filas as $f) {
                if (! isset($llamadas[(int) $f['id']]) && ($f['respuesta'] ?? null) === 'sin_respuesta' && in_array($f['citfc'] ?? null, $fechas, true)) {
                    $porRevisar[] = (int) $f['id'];
                }
            }
            $sinPermiso = [];
            if ($porRevisar !== []) {
                $chatDe = Appointment::whereIn('id', $porRevisar)->pluck('conversation_id', 'id')->filter()->all();
                $telDe = Conversation::whereIn('id', array_values(array_unique($chatDe)))->pluck('phone_number', 'id')->all();
                $permisos = self::permisos(array_values($telDe));
                foreach ($chatDe as $citaId => $chatId) {
                    $tel = PermisoLlamada::digitos($telDe[$chatId] ?? '');
                    if ($tel !== '' && ($permisos[$tel] ?? null) !== true) {
                        $sinPermiso[(int) $citaId] = true;
                    }
                }
            }

            foreach ($filas as &$f) {
                $l = $llamadas[(int) $f['id']] ?? null;
                $f['llamada'] = $l ? ['resultado' => self::resultadoFila($l), 'hora' => Recordatorios::horaCol($l->iniciada_en ?? $l->created_at)] : null;
                $f['sin_permiso_llamada'] = isset($sinPermiso[(int) $f['id']]);
            }
            unset($f);
        } catch (\Throwable $e) {
            Log::warning('Lista de citas: no se pudo anotar las llamadas', ['error' => $e->getMessage()]);
        }

        return $filas;
    }

    /** Fechas de citas ('Y-m-d') de este ámbito que tuvieron ronda de llamadas (la última y las que ya llamaron). */
    private static function fechasConRonda(string $service): array
    {
        return Cache::remember('ronda-llamadas-fechas-'.$service, 60, function () use ($service) {
            $fechas = Appointment::where('service', $service)
                ->whereIn('id', Llamada::where('origen', 'robot')->whereNotNull('cita_id')->select('cita_id'))
                ->distinct()->pluck('citfc')
                ->map(fn ($d) => Recordatorios::fechaDe($d))->filter()->values()->all();
            $ultima = self::leer($service)['fecha_citas'] ?? null;
            if (is_string($ultima) && $ultima !== '') {
                $fechas[] = $ultima;
            }

            return array_values(array_unique($fechas));
        });
    }
}
