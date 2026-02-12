<?php

namespace App\Console\Commands;

use App\Jobs\SendAppointmentReminderJob;
use App\Models\Appointment;
use App\Models\Setting;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AutoSendAppointmentReminders extends Command
{
    protected $signature = 'appointments:auto-send
                            {--dry-run : Mostrar qué se enviaría sin enviar realmente}';

    protected $description = 'Envía automáticamente recordatorios para citas de mañana y pasado mañana que aún no se han enviado';

    public function handle(): int
    {
        // ---------------------------------------------------------------
        // 1. Verificar que no haya un batch activo (no duplicar envíos)
        //    Usar 'auto_send_batch_id' separado para NO activar el
        //    polling agresivo del frontend (reminder_processing).
        // ---------------------------------------------------------------

        // Verificar primero si hay un envío MANUAL activo
        $isManualProcessing = Setting::get('reminder_processing', 'false') === 'true';
        if ($isManualProcessing) {
            $this->info('⏳ Ya hay un envío manual en curso. Se reintentará en la próxima ejecución.');
            return Command::SUCCESS;
        }

        // Verificar si hay un envío AUTOMÁTICO previo activo
        $autoBatchId = Setting::get('auto_send_batch_id');
        if ($autoBatchId) {
            $batch = DB::table('job_batches')->where('id', $autoBatchId)->first();
            $hasActiveBatch = $batch && !$batch->cancelled_at && !$batch->finished_at;

            if ($hasActiveBatch) {
                $this->info('⏳ Ya hay un envío automático en curso. Se reintentará en la próxima ejecución.');
                return Command::SUCCESS;
            }

            // Batch terminó o muerto → limpiar
            Setting::remove('auto_send_batch_id');
        }

        // ---------------------------------------------------------------
        // 2. Buscar citas pendientes para mañana (1 día) y pasado mañana (2 días)
        // ---------------------------------------------------------------
        $maxPerDay = (int) Setting::get('reminder_max_per_day', '1000');

        $tomorrowDate = now()->addDay()->startOfDay()->format('Y-m-d');
        $dayAfterDate = now()->addDays(2)->startOfDay()->format('Y-m-d');

        $pendingAppointments = Appointment::query()
            ->where(function ($q) use ($tomorrowDate, $dayAfterDate) {
                $q->whereDate('citfc', '=', $tomorrowDate)
                  ->orWhereDate('citfc', '=', $dayAfterDate);
            })
            ->where('reminder_sent', false)
            ->where(function ($q) {
                // Excluir solo fallos permanentes; permitir reintentar temporales
                $q->whereNull('reminder_error')
                  ->orWhere('reminder_error', 'like', '%attempted too many%')
                  ->orWhere('reminder_error', 'like', '%Something went wrong%');
            })
            ->whereNotNull('citfc')
            ->whereNotNull('pactel')
            ->where('pactel', '!=', '')
            ->orderBy('citfc', 'asc')
            ->limit($maxPerDay)
            ->pluck('id');

        if ($pendingAppointments->isEmpty()) {
            $this->info('✅ No hay citas pendientes de recordatorio para mañana ni pasado mañana.');
            return Command::SUCCESS;
        }

        $total = $pendingAppointments->count();

        $this->info("📋 Se encontraron {$total} citas pendientes de recordatorio:");
        $this->info("   - Mañana ({$tomorrowDate})");
        $this->info("   - Pasado mañana ({$dayAfterDate})");

        // ---------------------------------------------------------------
        // Dry-run: solo mostrar, no enviar
        // ---------------------------------------------------------------
        if ($this->option('dry-run')) {
            $this->warn('⚠️  Modo DRY-RUN: No se enviarán mensajes.');
            $sample = Appointment::whereIn('id', $pendingAppointments->take(10))->get();
            $this->table(
                ['ID', 'Paciente', 'Teléfono', 'Fecha', 'Hora'],
                $sample->map(fn ($a) => [
                    $a->id,
                    $a->nom_paciente,
                    $a->pactel,
                    $a->citfc?->format('Y-m-d'),
                    $a->cithor?->format('H:i'),
                ])
            );
            return Command::SUCCESS;
        }

        // ---------------------------------------------------------------
        // 3. Limpiar errores temporales para permitir reintento
        // ---------------------------------------------------------------
        Appointment::whereIn('id', $pendingAppointments)
            ->whereNotNull('reminder_error')
            ->where(function ($q) {
                $q->where('reminder_error', 'like', '%attempted too many%')
                  ->orWhere('reminder_error', 'like', '%Something went wrong%');
            })
            ->update([
                'reminder_error' => null,
                'reminder_status' => 'pending',
            ]);

        // ---------------------------------------------------------------
        // 4. Crear batch de jobs SIN activar reminder_processing
        //    para NO disparar el polling del frontend.
        //    Los jobs corren silenciosamente en segundo plano.
        // ---------------------------------------------------------------
        $jobs = $pendingAppointments->map(fn ($id) => new SendAppointmentReminderJob($id))->toArray();

        $batch = Bus::batch($jobs)
            ->name('Auto-recordatorios - ' . now()->format('Y-m-d H:i'))
            ->allowFailures()
            ->finally(function ($batch) {
                // Solo limpiar nuestro propio flag de re-entrada
                Setting::remove('auto_send_batch_id');

                Log::info('Batch automático de recordatorios completado', [
                    'batch_id'     => $batch->id,
                    'total_jobs'   => $batch->totalJobs,
                    'pending_jobs' => $batch->pendingJobs,
                    'failed_jobs'  => $batch->failedJobs,
                ]);
            })
            ->dispatch();

        // Guardar batch_id solo para evitar re-entrada (NO activar reminder_processing)
        Setting::set('auto_send_batch_id', $batch->id);

        Log::info('Envío automático de recordatorios iniciado', [
            'batch_id'    => $batch->id,
            'total'       => $total,
            'tomorrow'    => $tomorrowDate,
            'day_after'   => $dayAfterDate,
        ]);

        $this->info("🚀 Batch creado ({$batch->id}). Se enviarán {$total} recordatorios en segundo plano.");

        return Command::SUCCESS;
    }
}
