<?php

namespace App\Support;

use App\Models\Appointment;
use Illuminate\Bus\Batch;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Estado de un envío de recordatorios, por ámbito (general u oncología).
 *
 * Una sola fuente para index(), getReminderStatus(), iniciar, pausar/reanudar/detener, el «finally» del lote y el
 * trabajo de la cola, para que nunca den respuestas distintas. Todo se lee y escribe DIRECTO en la tabla settings
 * (sin la caché de Setting::get): el trabajo corre en otro proceso y la caché vieja ya hizo que la pantalla dijera
 * «Sin proceso activo» con un envío en marcha. Al escribir se borra igual la clave de caché de Setting.
 *
 * Claves (con el prefijo del ámbito: '' en general, 'oncology_' en oncología):
 *   reminder_processing / reminder_paused  'true' | 'false'
 *   reminder_batch_id                      id del lote vivo
 *   reminder_lote_ids                      {"batch_id": "...", "ids": [...]}  las citas que se encolaron
 *   reminder_ultimo_envio                  resumen del último envío (ver iniciar() y cerrar())
 */
class EnvioRecordatorios
{
    /** Así empieza el nombre de los lotes de la pantalla Citas: 'Recordatorios de citas (general) - …'. */
    public const NOMBRE_LOTE = 'Recordatorios de citas';

    /** Tiempo sin ninguna actividad en la cola tras el que la pantalla avisa «Sin avanzar». */
    private const SEGUNDOS_SIN_AVANZAR = 120;

    public static function prefijo(?string $service): string
    {
        $service = $service ?: 'general';

        return $service === 'general' ? '' : $service.'_';
    }

    public static function leer(string $service, string $clave): ?string
    {
        $valor = DB::table('settings')->where('key', self::prefijo($service).$clave)->value('value');

        return $valor === null ? null : (string) $valor;
    }

    /** Escribe (o borra, con null) una clave del ámbito y olvida su caché de Setting::get. */
    public static function guardar(string $service, string $clave, ?string $valor): void
    {
        $key = self::prefijo($service).$clave;

        if ($valor === null) {
            DB::table('settings')->where('key', $key)->delete();
        } elseif (DB::table('settings')->where('key', $key)->exists()) {
            DB::table('settings')->where('key', $key)->update(['value' => $valor, 'updated_at' => now()]);
        } else {
            DB::table('settings')->insert(['key' => $key, 'value' => $valor, 'is_encrypted' => false, 'created_at' => now(), 'updated_at' => now()]);
        }

        Cache::forget('setting.'.$key);
    }

    /** El resumen del último envío del ámbito (o null). */
    public static function ultimoEnvio(string $service): ?array
    {
        $u = json_decode((string) self::leer($service, 'reminder_ultimo_envio'), true);

        return is_array($u) ? $u : null;
    }

    private static function guardarUltimo(string $service, array $u): void
    {
        self::guardar($service, 'reminder_ultimo_envio', json_encode($u, JSON_UNESCAPED_UNICODE));
    }

    /**
     * Deja el envío en marcha: ids encolados, resumen «en_curso», lote, sin pausa y processing = true, todo en una
     * transacción para que nadie lea a medias (p. ej. processing sin lote).
     *
     * @param  array{tipo: string, fecha_citas: string, sin_celular: int, iniciado_por: ?string}  $datos
     */
    public static function iniciar(string $service, string $batchId, array $ids, array $datos): array
    {
        $ultimo = [
            'batch_id' => $batchId,
            'tipo' => $datos['tipo'],
            'fecha_citas' => $datos['fecha_citas'],
            'total' => count($ids),
            'sin_celular' => (int) $datos['sin_celular'],
            'iniciado_por' => $datos['iniciado_por'],
            'inicio' => Recordatorios::ahoraCol(),
            'estado' => 'en_curso',
            'motivo' => null,
            'fin' => null,
            'enviados' => 0,
            'con_error' => 0,
            'sin_enviar' => 0,
            'omitidas' => 0,
        ];

        DB::transaction(function () use ($service, $batchId, $ids, $ultimo) {
            self::guardar($service, 'reminder_lote_ids', json_encode(['batch_id' => $batchId, 'ids' => array_values(array_map('intval', $ids))]));
            self::guardarUltimo($service, $ultimo);
            self::guardar($service, 'reminder_batch_id', $batchId);
            self::guardar($service, 'reminder_paused', 'false');
            self::guardar($service, 'reminder_processing', 'true');
        });

        return $ultimo;
    }

    /** Sin envío: processing y pausa en false y sin lote (solo si el lote guardado es $batchId, o con null). */
    public static function limpiar(string $service, ?string $batchId = null): void
    {
        DB::transaction(function () use ($service, $batchId) {
            $guardado = self::leer($service, 'reminder_batch_id');
            if ($batchId !== null && $guardado !== null && $guardado !== $batchId) {
                return; // El estado ya lo lleva otro lote.
            }
            self::guardar($service, 'reminder_processing', 'false');
            self::guardar($service, 'reminder_paused', 'false');
            self::guardar($service, 'reminder_batch_id', null);
        });
    }

    /**
     * Cifras del envío, contadas en la base sobre las citas que se encolaron (una consulta por clave primaria):
     *   sent     aceptados por WhatsApp (reminder_sent = 1 con id de mensaje)
     *   failed   con error
     *   pending  faltan (ni enviadas, ni con error, ni canceladas/confirmadas)
     *   skipped  el resto: ya tenían recordatorio, se cancelaron o eran duplicadas de otra cita
     * percentage va con floor: nunca dice 100 % con una pendiente.
     * Si falta la lista de ids, se usa la fórmula del lote (sent = processedJobs, que ya no cuenta los fallidos).
     */
    public static function progreso(string $service, ?Batch $batch = null, ?string $batchId = null): ?array
    {
        $batchId ??= $batch?->id;
        $lote = json_decode((string) self::leer($service, 'reminder_lote_ids'), true);

        if (is_array($lote) && ! empty($lote['ids']) && ($batchId === null || ($lote['batch_id'] ?? null) === $batchId)) {
            $ids = array_values(array_map('intval', (array) $lote['ids']));
            $total = count($ids);
            $fila = DB::table('appointments')->whereIntegerInRaw('id', $ids)->selectRaw(
                "SUM(CASE WHEN reminder_sent = 1 AND reminder_whatsapp_message_id IS NOT NULL THEN 1 ELSE 0 END) AS sent,
                 SUM(CASE WHEN reminder_sent = 0 AND reminder_status = 'failed' THEN 1 ELSE 0 END) AS failed,
                 SUM(CASE WHEN reminder_sent = 0 AND (reminder_status IS NULL OR reminder_status NOT IN ('failed', 'cancelled', 'confirmed')) THEN 1 ELSE 0 END) AS pending"
            )->first();
            $sent = (int) ($fila->sent ?? 0);
            $failed = (int) ($fila->failed ?? 0);
            $pending = (int) ($fila->pending ?? 0);

            return [
                'total' => $total,
                'sent' => $sent,
                'failed' => $failed,
                'pending' => $pending,
                'skipped' => max(0, $total - $sent - $failed - $pending),
                'percentage' => $total > 0 ? (int) floor(($total - $pending) / $total * 100) : 0,
            ];
        }

        if ($batch) {
            $total = $batch->totalJobs;
            $sent = $batch->processedJobs();
            $failed = $batch->failedJobs;
            $pending = max(0, $total - $sent - $failed);

            return [
                'total' => $total,
                'sent' => $sent,
                'failed' => $failed,
                'pending' => $pending,
                'skipped' => 0,
                'percentage' => $total > 0 ? (int) floor(($total - $pending) / $total * 100) : 0,
            ];
        }

        return null;
    }

    /** Filas del lote que siguen en la cola: cuántas, el id más alto y la suma de intentos. */
    private static function filasEnCola(string $batchId): object
    {
        $f = DB::table('jobs')->where('payload', 'like', '%'.$batchId.'%')
            ->selectRaw('COUNT(*) AS c, MAX(id) AS m, SUM(attempts) AS a')->first();

        return (object) ['c' => (int) ($f->c ?? 0), 'm' => (int) ($f->m ?? 0), 'a' => (int) ($f->a ?? 0)];
    }

    /**
     * ¿El envío lleva 2 minutos sin NINGUNA actividad? Se mide actividad, no antigüedad en la cola: cualquier envío,
     * salto, reintento o «release» cambia la firma. (Mirar cuánto lleva un trabajo esperando daba falsos avisos en
     * todos los lotes grandes, que se procesan de uno en uno.)
     */
    private static function sinAvanzar(Batch $batch, object $filas): bool
    {
        $firma = $batch->pendingJobs.'|'.$batch->failedJobs.'|'.$filas->c.'|'.$filas->m.'|'.$filas->a;
        $clave = 'recordatorios.firma.'.$batch->id;
        $ahora = now()->timestamp;

        try {
            $guardada = Cache::get($clave);
            if (! is_array($guardada) || ($guardada['firma'] ?? null) !== $firma) {
                Cache::put($clave, ['firma' => $firma, 'desde' => $ahora], 86400);

                return false;
            }
        } catch (\Throwable $e) {
            return false;
        }

        return $filas->c > 0 && ($ahora - (int) ($guardada['desde'] ?? $ahora)) >= self::SEGUNDOS_SIN_AVANZAR;
    }

    /**
     * Estado del envío del ámbito: {processing, paused, batch, progress, sin_avanzar}.
     * Si el lote ya no existe, terminó, se canceló o no le quedan trabajos en la cola, limpia el estado y cierra el
     * «último envío». La pausa solo puede ser true con un envío en marcha (si no, se apaga: no queda pegada).
     */
    public static function estado(string $service): array
    {
        $sinEnvio = ['processing' => false, 'paused' => false, 'batch' => null, 'progress' => null, 'sin_avanzar' => false];

        $processing = self::leer($service, 'reminder_processing') === 'true';
        $paused = self::leer($service, 'reminder_paused') === 'true';
        $batchId = self::leer($service, 'reminder_batch_id');

        if (! $processing) {
            if ($paused) {
                self::guardar($service, 'reminder_paused', 'false');
            }

            return $sinEnvio;
        }

        if (! $batchId) {
            Log::warning('Recordatorios: envío marcado en curso sin lote; se limpia', ['service' => $service]);
            self::limpiar($service);

            return $sinEnvio;
        }

        try {
            $batch = Bus::findBatch($batchId);
            $filas = self::filasEnCola($batchId);
        } catch (\Throwable $e) {
            // No se pudo mirar el lote: se sigue mostrando en marcha (puede estar enviando).
            Log::error('Recordatorios: no se pudo leer el lote', ['batch_id' => $batchId, 'error' => $e->getMessage()]);

            return ['processing' => true, 'paused' => $paused, 'batch' => $batchId, 'progress' => self::progreso($service, null, $batchId), 'sin_avanzar' => false];
        }

        $terminado = ! $batch
            || $batch->finished()
            || $batch->cancelled()
            || ($batch->pendingJobs - $batch->failedJobs) <= 0
            || $filas->c === 0;

        if ($terminado) {
            self::limpiar($service, $batchId);
            self::cerrar($service, $batchId, 'terminado');

            return $sinEnvio;
        }

        $sinAvanzar = self::sinAvanzar($batch, $filas);

        return [
            'processing' => true,
            'paused' => $paused,
            'batch' => $batchId,
            'progress' => self::progreso($service, $batch),
            'sin_avanzar' => $sinAvanzar && ! $paused,
        ];
    }

    /**
     * Cierra el «último envío» de ese lote (idempotente): estado, hora de fin y cifras. Solo si el resumen es de
     * ESE lote y sigue «en_curso»: nunca cambia un «detenido» o un «cortado» por «terminado».
     */
    public static function cerrar(string $service, string $batchId, string $estado, ?array $progreso = null): ?array
    {
        $u = self::ultimoEnvio($service);
        if (! $u || ($u['batch_id'] ?? null) !== $batchId || ($u['estado'] ?? null) !== 'en_curso') {
            return $u;
        }

        $p = $progreso ?? self::progreso($service, null, $batchId) ?? ['sent' => 0, 'failed' => 0, 'pending' => 0, 'skipped' => 0];
        $u['estado'] = $estado;
        $u['fin'] = Recordatorios::ahoraCol();
        $u['enviados'] = (int) $p['sent'];
        $u['con_error'] = (int) $p['failed'];
        $u['sin_enviar'] = (int) $p['pending'];
        $u['omitidas'] = (int) $p['skipped'];
        self::guardarUltimo($service, $u);

        return $u;
    }

    /**
     * El trabajo cortó el lote por un problema de plantilla, de cuenta o de límite: queda como «cortado» con el
     * motivo (el «último error» que muestra la pantalla hasta el próximo envío). Ninguna cita queda marcada.
     */
    public static function cortar(string $service, ?string $batchId, string $motivo): void
    {
        if (! $batchId) {
            return;
        }
        $u = self::ultimoEnvio($service);
        if (! $u || ($u['batch_id'] ?? null) !== $batchId || ($u['estado'] ?? null) !== 'en_curso') {
            return;
        }

        $p = self::progreso($service, null, $batchId) ?? ['sent' => 0, 'failed' => 0, 'pending' => 0, 'skipped' => 0];
        $u['estado'] = 'cortado';
        $u['motivo'] = $motivo;
        $u['fin'] = Recordatorios::ahoraCol();
        $u['enviados'] = (int) $p['sent'];
        $u['con_error'] = (int) $p['failed'];
        $u['sin_enviar'] = (int) $p['pending'];
        $u['omitidas'] = (int) $p['skipped'];
        self::guardarUltimo($service, $u);
    }

    /** «finally» del lote: solo limpia si sigue siendo el lote vigente del ámbito (otro lote puede llevar el estado). */
    public static function alTerminarLote(string $service, Batch $batch): void
    {
        try {
            self::limpiar($service, $batch->id);
            self::cerrar($service, $batch->id, 'terminado');

            Log::info('Lote de recordatorios terminado', [
                'service' => $service,
                'batch_id' => $batch->id,
                'total_jobs' => $batch->totalJobs,
                'pending_jobs' => $batch->pendingJobs,
                'failed_jobs' => $batch->failedJobs,
            ]);
        } catch (\Throwable $e) {
            Log::error('Recordatorios: fallo al cerrar el lote', ['batch_id' => $batch->id, 'error' => $e->getMessage()]);
        }
    }

    /**
     * Detener: cancela TODOS los lotes vivos del ámbito (también los huérfanos de un segundo lote) y borra de la cola
     * los trabajos cuyas citas son de ESTE ámbito. Nunca borra por nombre de clase: el otro ámbito sigue enviando.
     *
     * @return array{ultimo_envio: ?array, borrados: int}
     */
    public static function detener(string $service): array
    {
        $batchId = self::leer($service, 'reminder_batch_id');
        $progreso = $batchId ? self::progreso($service, null, $batchId) : null; // ANTES de cancelar.

        $lotes = DB::table('job_batches')
            ->where('name', 'like', self::NOMBRE_LOTE.' ('.($service ?: 'general').')%')
            ->whereNull('cancelled_at')
            ->whereNull('finished_at')
            ->where('created_at', '>=', now()->subDays(2)->timestamp)
            ->pluck('id');
        if ($batchId) {
            $lotes->push($batchId);
        }
        foreach ($lotes->unique() as $id) {
            try {
                Bus::findBatch($id)?->cancel();
            } catch (\Throwable $e) {
                Log::warning('Recordatorios: no se pudo cancelar un lote', ['batch_id' => $id, 'error' => $e->getMessage()]);
            }
        }

        // Trabajos de recordatorio en la cola → id de su cita → solo las de este ámbito.
        $trabajos = [];
        foreach (DB::table('jobs')->where('payload', 'like', '%SendAppointmentReminderJob%')->get(['id', 'payload']) as $fila) {
            $comando = data_get(json_decode($fila->payload, true), 'data.command');
            if (is_string($comando) && preg_match('/"appointmentId";i:(\d+);/', $comando, $m)) {
                $trabajos[(int) $fila->id] = (int) $m[1];
            }
        }
        $borrados = 0;
        if ($trabajos) {
            $delAmbito = Appointment::whereIntegerInRaw('id', array_values(array_unique($trabajos)))
                ->where('service', $service ?: 'general')->pluck('id')->flip();
            $aBorrar = array_keys(array_filter($trabajos, fn ($cita) => isset($delAmbito[$cita])));
            foreach (array_chunk($aBorrar, 500) as $trozo) {
                $borrados += DB::table('jobs')->whereIntegerInRaw('id', $trozo)->delete();
            }
        }

        self::limpiar($service);
        $ultimo = $batchId ? self::cerrar($service, $batchId, 'detenido', $progreso) : self::ultimoEnvio($service);

        return ['ultimo_envio' => $ultimo, 'borrados' => $borrados];
    }
}
