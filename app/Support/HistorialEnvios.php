<?php

namespace App\Support;

use App\Models\Llamada;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Historial de envíos de recordatorios de Citas (pedido del 24/11/2026): cada envío queda con sus citas
 * (tablas envios_recordatorio y envio_recordatorio_cita), y la pantalla muestra por envío cuántas llegaron, cuántas
 * confirmaron o cancelaron (por WhatsApp o por la llamada del robot), cuántas siguen sin respuesta y cómo fueron las
 * llamadas.
 *
 * Las cifras se cuentan EN VIVO sobre las citas: las respuestas, los avisos de «no entregado» de Meta y el segundo
 * número llegan después de cerrar el envío (el 24/11 el cierre decía 4 con error y al rato había 308).
 *
 * Una cita que está en dos envíos (falló en uno y salió en otro posterior) cuenta solo en el MÁS RECIENTE: ahí está su
 * recordatorio y de ahí vienen su respuesta y su llamada. En el anterior figura como «se volvió a enviar».
 *
 * Nada de esto puede frenar un envío: registrar y cerrar atrapan sus errores y solo dejan constancia en el log.
 */
class HistorialEnvios
{
    public const TABLA = 'envios_recordatorio';

    public const CITAS = 'envio_recordatorio_cita';

    /** Envíos que lista la pantalla: los más recientes del ámbito. */
    public const LIMITE_LISTA = 100;

    /** Resultados de la llamada del robot (los de RondaLlamadas::resultadoFila). */
    public const RESULTADOS_LLAMADA = ['confirmo', 'cancelo', 'sin_marcar', 'no_contesto', 'rechazo', 'no_se_pudo', 'no_llamar', 'en_curso'];

    /** Notas que deja WhatsAppService::aplicarRespuestaCita cuando la respuesta llegó por la llamada del robot. */
    private const NOTAS_CONFIRMO_LLAMADA = ['%confirmó asistencia vía llamada%', '%Confirmada junto con su cita #% (vía llamada)%'];

    private const NOTAS_CANCELO_LLAMADA = ['%canceló vía llamada%', '%Cancelada junto con su cita #% (vía llamada)%'];

    /** Citas por INSERT al registrar (un envío «todas» pasa de 8.000). */
    private const TROZO = 1000;

    /* ── Registro (lo llama EnvioRecordatorios) ───────────────────────────────────────────────────── */

    /**
     * Deja constancia del envío que acaba de empezar y de sus citas. Devuelve el id, o null si no se pudo (el envío
     * sigue igual: solo falta en el historial).
     *
     * @param  array{tipo: string, fecha_citas: ?string, fecha_hasta?: ?string, sin_celular?: int, iniciado_por?: ?string, iniciado_por_id?: ?int}  $datos
     */
    public static function registrar(string $service, string $batchId, array $ids, array $datos): ?int
    {
        try {
            $ids = array_values(array_unique(array_map('intval', $ids)));

            return DB::transaction(function () use ($service, $batchId, $ids, $datos) {
                $id = (int) DB::table(self::TABLA)->insertGetId([
                    'service' => $service ?: 'general',
                    'batch_id' => $batchId,
                    'tipo' => (string) $datos['tipo'],
                    'fecha_citas' => $datos['fecha_citas'] ?? null,
                    'fecha_hasta' => $datos['fecha_hasta'] ?? null,
                    'total' => count($ids),
                    'sin_celular' => (int) ($datos['sin_celular'] ?? 0),
                    'iniciado_por_id' => $datos['iniciado_por_id'] ?? null,
                    'iniciado_por' => $datos['iniciado_por'] ?? null,
                    'inicio_at' => now(),
                    'estado' => 'en_curso',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                foreach (array_chunk($ids, self::TROZO) as $trozo) {
                    DB::table(self::CITAS)->insert(array_map(fn (int $cita) => ['envio_id' => $id, 'appointment_id' => $cita], $trozo));
                }

                return $id;
            });
        } catch (\Throwable $e) {
            Log::error('Historial de envíos: no se pudo registrar el envío (el envío sigue)', [
                'service' => $service,
                'batch_id' => $batchId,
                'citas' => count($ids),
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Cierra el envío de ese lote (solo si sigue «en curso»: un «detenido» o un «cortado» no pasa a «terminado»), con la
     * foto de las cifras de EnvioRecordatorios::progreso si la hay.
     */
    public static function cerrar(string $batchId, string $estado, ?string $motivo = null, ?array $progreso = null): void
    {
        try {
            $datos = ['estado' => $estado, 'motivo' => $motivo, 'fin_at' => now(), 'updated_at' => now()];
            if ($progreso !== null) {
                $datos += [
                    'enviados' => (int) ($progreso['sent'] ?? 0),
                    'con_error' => (int) ($progreso['failed'] ?? 0),
                    'sin_enviar' => (int) ($progreso['pending'] ?? 0),
                    'omitidas' => (int) ($progreso['skipped'] ?? 0),
                ];
            }
            // También una fila que cerró solo cerrarHuerfanos() (terminado y sin cifras): el cierre real la corrige.
            DB::table(self::TABLA)->where('batch_id', $batchId)
                ->where(fn ($q) => $q->where('estado', 'en_curso')->orWhere(fn ($q) => $q->where('estado', 'terminado')->whereNull('enviados')))
                ->update($datos);
        } catch (\Throwable $e) {
            Log::warning('Historial de envíos: no se pudo cerrar el envío', ['batch_id' => $batchId, 'estado' => $estado, 'error' => $e->getMessage()]);
        }
    }

    /* ── Lectura (pantalla Citas) ─────────────────────────────────────────────────────────────────── */

    /** Los envíos más recientes del ámbito, con sus cifras en vivo. */
    public static function lista(string $service, int $limite = self::LIMITE_LISTA): array
    {
        $service = $service ?: 'general';
        $filas = DB::table(self::TABLA)->where('service', $service)->orderByDesc('id')->limit($limite)->get();
        if ($filas->isEmpty()) {
            return [];
        }

        $filas = self::cerrarHuerfanos($service, $filas);
        $ids = $filas->map(fn ($f) => (int) $f->id)->all();
        $cifras = self::cifras($ids);
        $llamadas = self::llamadas($ids);

        return $filas->map(fn ($f) => self::fila($f, $cifras[(int) $f->id] ?? null, $llamadas[(int) $f->id] ?? []))->values()->all();
    }

    /** Un envío del ámbito con sus cifras, o null si no existe (o es del otro ámbito). */
    public static function uno(string $service, int $id): ?array
    {
        $service = $service ?: 'general';
        $f = DB::table(self::TABLA)->where('service', $service)->where('id', $id)->first();
        if (! $f) {
            return null;
        }
        $f = self::cerrarHuerfanos($service, collect([$f]))->first();

        return self::fila($f, self::cifras([$id])[$id] ?? null, self::llamadas([$id])[$id] ?? []);
    }

    /**
     * Subconsulta con los ids de las citas que cuentan en ese envío (las suyas, menos las que salieron después en otro
     * envío): la usa el filtro «envio» de la lista de citas, para que la lista diga lo mismo que el historial.
     */
    public static function citasDelEnvio(int $envioId): \Illuminate\Database\Query\Builder
    {
        return DB::table(self::CITAS.' as p')
            ->select('p.appointment_id')
            ->where('p.envio_id', $envioId)
            ->whereNotExists(fn ($q) => $q->selectRaw('1')->from(self::CITAS.' as p2')
                ->whereColumn('p2.appointment_id', 'p.appointment_id')
                ->whereColumn('p2.envio_id', '>', 'p.envio_id'));
    }

    /**
     * Resultado de la ÚLTIMA llamada del robot a una cita, en SQL: lo mismo que RondaLlamadas::resultadoFila (una
     * llamada «viva» de hace más de 5 minutos cuenta por lo que alcanzó a pasar). $l es el alias de la tabla llamadas.
     *
     * @return array{0: string, 1: array}
     */
    public static function sqlResultadoLlamada(string $l = 'l'): array
    {
        $vivas = "'".implode("','", Llamada::VIVAS)."'";

        return [
            "CASE
                WHEN {$l}.resultado_robot = 'no_llamar' THEN 'no_llamar'
                WHEN {$l}.resultado_robot = 'confirmo' THEN 'confirmo'
                WHEN {$l}.resultado_robot = 'cancelo' THEN 'cancelo'
                WHEN {$l}.estado IN ({$vivas}) AND {$l}.created_at > ? THEN 'en_curso'
                WHEN {$l}.contestada_en IS NOT NULL THEN 'sin_marcar'
                WHEN {$l}.estado = 'fallida' THEN 'no_se_pudo'
                WHEN {$l}.estado = 'rechazada' THEN 'rechazo'
                ELSE 'no_contesto' END",
            [now()->subMinutes(5)->format('Y-m-d H:i:s')],
        ];
    }

    /**
     * Un envío que sigue «en curso» en la tabla pero ya no es el envío vivo del ámbito (se cerró sin pasar por
     * cerrar(): p. ej. se cayó el registro): se cierra con lo que diga el último envío, o como terminado.
     */
    private static function cerrarHuerfanos(string $service, Collection $filas): Collection
    {
        if (! $filas->contains(fn ($f) => $f->estado === 'en_curso')) {
            return $filas;
        }

        $vivo = EnvioRecordatorios::leer($service, 'reminder_processing') === 'true' ? EnvioRecordatorios::leer($service, 'reminder_batch_id') : null;
        $u = EnvioRecordatorios::ultimoEnvio($service);

        foreach ($filas as $f) {
            if ($f->estado !== 'en_curso' || ($f->batch_id !== null && $f->batch_id === $vivo)) {
                continue;
            }
            $delUltimo = $u && ($u['batch_id'] ?? null) === $f->batch_id && in_array($u['estado'] ?? null, ['terminado', 'detenido', 'cortado'], true);
            $estado = $delUltimo ? $u['estado'] : 'terminado';
            $motivo = $estado === 'cortado' ? ($u['motivo'] ?? null) : null;
            $fin = $delUltimo && ! empty($u['fin']) ? self::deColombia($u['fin']) : now();
            try {
                DB::table(self::TABLA)->where('id', $f->id)->where('estado', 'en_curso')
                    ->update(['estado' => $estado, 'motivo' => $motivo, 'fin_at' => $fin, 'updated_at' => now()]);
            } catch (\Throwable $e) {
                Log::warning('Historial de envíos: no se pudo cerrar un envío huérfano', ['id' => $f->id, 'error' => $e->getMessage()]);
            }
            $f->estado = $estado;
            $f->motivo = $motivo;
            $f->fin_at = $fin->format('Y-m-d H:i:s');
        }

        return $filas;
    }

    /**
     * Cifras de las citas de cada envío (por clave primaria). Solo las citas cuyo envío más reciente es este.
     *
     * @return array<int, object>
     */
    private static function cifras(array $ids): array
    {
        if ($ids === []) {
            return [];
        }
        $sinResolver = "(a.reminder_status IS NULL OR a.reminder_status NOT IN ('failed', 'confirmed', 'cancelled'))";
        [$c1, $c2] = self::NOTAS_CONFIRMO_LLAMADA;
        [$k1, $k2] = self::NOTAS_CANCELO_LLAMADA;

        return DB::table(self::CITAS.' as p')
            ->leftJoin('appointments as a', 'a.id', '=', 'p.appointment_id')
            ->whereIntegerInRaw('p.envio_id', $ids)
            ->whereNotExists(fn ($q) => $q->selectRaw('1')->from(self::CITAS.' as p2')
                ->whereColumn('p2.appointment_id', 'p.appointment_id')
                ->whereColumn('p2.envio_id', '>', 'p.envio_id'))
            ->groupBy('p.envio_id')
            ->selectRaw(
                "p.envio_id,
                 COUNT(*) AS propias,
                 SUM(CASE WHEN a.id IS NULL THEN 1 ELSE 0 END) AS borradas,
                 SUM(CASE WHEN a.reminder_sent = 1 AND (a.reminder_status IS NULL OR a.reminder_status <> 'failed') THEN 1 ELSE 0 END) AS llegaron,
                 SUM(CASE WHEN a.reminder_sent = 1 AND a.reminder_status = 'failed' THEN 1 ELSE 0 END) AS no_entregados,
                 SUM(CASE WHEN a.reminder_sent = 0 AND a.reminder_status = 'failed' THEN 1 ELSE 0 END) AS con_error,
                 SUM(CASE WHEN a.reminder_sent = 0 AND {$sinResolver} THEN 1 ELSE 0 END) AS por_enviar,
                 SUM(CASE WHEN a.reminder_sent = 1 AND {$sinResolver} THEN 1 ELSE 0 END) AS sin_respuesta,
                 SUM(CASE WHEN a.reminder_status = 'confirmed' THEN 1 ELSE 0 END) AS confirmadas,
                 SUM(CASE WHEN a.reminder_status = 'confirmed' AND (a.notes LIKE ? OR a.notes LIKE ?) THEN 1 ELSE 0 END) AS conf_llamada,
                 SUM(CASE WHEN a.reminder_status = 'cancelled' THEN 1 ELSE 0 END) AS canceladas,
                 SUM(CASE WHEN a.reminder_status = 'cancelled' AND (a.notes LIKE ? OR a.notes LIKE ?) THEN 1 ELSE 0 END) AS canc_llamada,
                 SUM(CASE WHEN a.reminder_status = 'cancelled' AND a.notes LIKE ? THEN 1 ELSE 0 END) AS canc_hospital,
                 SUM(CASE WHEN a.reminder_sent = 1 AND a.reminder_numero = 2 THEN 1 ELSE 0 END) AS telefono_2",
                [$c1, $c2, $k1, $k2, '%'.Recordatorios::NOTA_CANCELADA_HOSPITAL.'%']
            )
            ->get()
            ->keyBy(fn ($f) => (int) $f->envio_id)
            ->all();
    }

    /**
     * Resultado de la última llamada del robot de cada cita, contado por envío (la llamada va con el envío más
     * reciente de su cita). Se parte de llamadas (pocas) y no de las citas del envío (miles).
     *
     * @return array<int, array<string, int>>
     */
    private static function llamadas(array $ids): array
    {
        if ($ids === []) {
            return [];
        }
        [$caso, $enlaces] = self::sqlResultadoLlamada('l');

        $interna = DB::table('llamadas as l')
            ->join(self::CITAS.' as p', 'p.appointment_id', '=', 'l.cita_id')
            ->where('l.origen', 'robot')
            ->whereNotNull('l.cita_id')
            ->whereIntegerInRaw('p.envio_id', $ids)
            ->whereRaw("l.id = (SELECT MAX(l2.id) FROM llamadas l2 WHERE l2.origen = 'robot' AND l2.cita_id = l.cita_id)")
            ->whereNotExists(fn ($q) => $q->selectRaw('1')->from(self::CITAS.' as p2')
                ->whereColumn('p2.appointment_id', 'p.appointment_id')
                ->whereColumn('p2.envio_id', '>', 'p.envio_id'))
            ->selectRaw("p.envio_id AS envio_id, {$caso} AS resultado", $enlaces);

        $por = [];
        foreach (DB::query()->fromSub($interna, 't')->selectRaw('t.envio_id, t.resultado, COUNT(*) AS n')->groupBy('t.envio_id', 't.resultado')->get() as $r) {
            $por[(int) $r->envio_id][(string) $r->resultado] = (int) $r->n;
        }

        return $por;
    }

    /** Lo que recibe la pantalla de un envío (las horas en hora de Colombia, 'Y-m-d H:i'). */
    private static function fila(object $f, ?object $c, array $porResultado): array
    {
        $n = fn (string $k) => (int) ($c->{$k} ?? 0);
        $total = (int) $f->total;
        $llamadas = array_fill_keys(self::RESULTADOS_LLAMADA, 0);
        foreach ($porResultado as $resultado => $cuantas) {
            $llamadas[$resultado] = ($llamadas[$resultado] ?? 0) + $cuantas;
        }

        return [
            'id' => (int) $f->id,
            'batch_id' => $f->batch_id,
            'tipo' => $f->tipo,
            'fecha_citas' => $f->fecha_citas ? substr((string) $f->fecha_citas, 0, 10) : null,
            'fecha_hasta' => $f->fecha_hasta ? substr((string) $f->fecha_hasta, 0, 10) : null,
            'estado' => $f->estado,
            'motivo' => $f->motivo,
            'iniciado_por' => $f->iniciado_por,
            'inicio' => Recordatorios::horaCol($f->inicio_at),
            'fin' => Recordatorios::horaCol($f->fin_at),
            'total' => $total,
            'sin_celular' => (int) $f->sin_celular,
            'cifras' => [
                'llegaron' => $n('llegaron'),
                'no_entregados' => $n('no_entregados'),
                'con_error' => $n('con_error'),
                'por_enviar' => $n('por_enviar'),
                'sin_respuesta' => $n('sin_respuesta'),
                'confirmadas' => $n('confirmadas'),
                'conf_llamada' => $n('conf_llamada'),
                'canceladas' => $n('canceladas'),
                'canc_llamada' => $n('canc_llamada'),
                'canc_hospital' => $n('canc_hospital'),
                'telefono_2' => $n('telefono_2'),
                'borradas' => $n('borradas'),
                'reenviadas' => max(0, $total - $n('propias')),
            ],
            'llamadas' => ['total' => array_sum($llamadas)] + $llamadas,
        ];
    }

    /** 'Y-m-d H:i' en hora de Colombia → Carbon en UTC (como se guardan las horas). */
    private static function deColombia(string $ymdhm): Carbon
    {
        return Carbon::createFromFormat('Y-m-d H:i', substr($ymdhm, 0, 16), Recordatorios::ZONA)->utc();
    }

    /* ── Siembra del envío que ya existía (orden recordatorios:historial-sembrar) ────────────────── */

    /**
     * Pasa al historial el último envío del ámbito tal como quedó en settings (reminder_ultimo_envio y su lista exacta
     * de citas reminder_lote_ids). Los anteriores no tienen lista: no se inventan. Sin $aplicar solo dice qué haría.
     */
    public static function sembrarUltimo(string $service, bool $aplicar): array
    {
        $service = $service ?: 'general';
        $u = EnvioRecordatorios::ultimoEnvio($service);
        if (! $u || empty($u['batch_id'])) {
            return ['service' => $service, 'resultado' => 'sin_envio'];
        }
        $batchId = (string) $u['batch_id'];
        if (DB::table(self::TABLA)->where('batch_id', $batchId)->exists()) {
            return ['service' => $service, 'resultado' => 'ya_estaba', 'batch_id' => $batchId];
        }
        $ids = EnvioRecordatorios::idsDelLote($service, $batchId);
        if (! $ids) {
            return ['service' => $service, 'resultado' => 'sin_lista', 'batch_id' => $batchId];
        }

        $nombre = $u['iniciado_por'] ?? null;
        $usuarios = $nombre ? User::where('name', $nombre)->pluck('id') : collect();
        $resumen = [
            'service' => $service,
            'batch_id' => $batchId,
            'tipo' => $u['tipo'] ?? null,
            'fechas' => ($u['fecha_citas'] ?? '?').(! empty($u['fecha_hasta']) ? ' a '.$u['fecha_hasta'] : ''),
            'estado' => $u['estado'] ?? null,
            'inicio' => $u['inicio'] ?? null,
            'fin' => $u['fin'] ?? null,
            'citas' => count($ids),
            'usuario' => $usuarios->count() === 1 ? 'encontrado' : ($usuarios->isEmpty() ? 'sin usuario (solo el nombre)' : 'varios con ese nombre (solo el nombre)'),
        ];
        if (! $aplicar) {
            return $resumen + ['resultado' => 'simulado'];
        }

        $id = DB::transaction(function () use ($service, $batchId, $ids, $u, $usuarios) {
            $id = (int) DB::table(self::TABLA)->insertGetId([
                'service' => $service,
                'batch_id' => $batchId,
                'tipo' => (string) ($u['tipo'] ?? 'normal'),
                'fecha_citas' => $u['fecha_citas'] ?? null,
                'fecha_hasta' => $u['fecha_hasta'] ?? null,
                'total' => count($ids),
                'sin_celular' => (int) ($u['sin_celular'] ?? 0),
                'iniciado_por_id' => $usuarios->count() === 1 ? (int) $usuarios->first() : null,
                'iniciado_por' => $u['iniciado_por'] ?? null,
                'inicio_at' => ! empty($u['inicio']) ? self::deColombia($u['inicio']) : now(),
                'fin_at' => ! empty($u['fin']) ? self::deColombia($u['fin']) : null,
                'estado' => in_array($u['estado'] ?? null, ['en_curso', 'terminado', 'detenido', 'cortado'], true) ? $u['estado'] : 'terminado',
                'motivo' => $u['motivo'] ?? null,
                'enviados' => isset($u['enviados']) ? (int) $u['enviados'] : null,
                'con_error' => isset($u['con_error']) ? (int) $u['con_error'] : null,
                'sin_enviar' => isset($u['sin_enviar']) ? (int) $u['sin_enviar'] : null,
                'omitidas' => isset($u['omitidas']) ? (int) $u['omitidas'] : null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            foreach (array_chunk(array_values(array_unique($ids)), self::TROZO) as $trozo) {
                DB::table(self::CITAS)->insert(array_map(fn (int $cita) => ['envio_id' => $id, 'appointment_id' => $cita], $trozo));
            }

            return $id;
        });

        return $resumen + ['resultado' => 'sembrado', 'id' => $id];
    }
}
