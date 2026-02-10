<?php

namespace App\Jobs;

use App\Models\Appointment;
use App\Models\Setting;
use App\Services\AppointmentReminderService;
use Illuminate\Bus\Batchable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class SendAppointmentReminderJob implements ShouldQueue
{
    use Batchable, Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 60; // 1 minuto por job
    public $maxExceptions = 3; // Solo fallar después de 3 ERRORES REALES (no lock contention)
    public $backoff = [5, 10, 30]; // Esperar 5s, 10s, 30s entre reintentos

    /**
     * Create a new job instance.
     */
    public function __construct(
        public int $appointmentId
    ) {}

    /**
     * Get the middleware the job should pass through.
     * Rate limiting: máximo 20 mensajes por minuto (1 cada 3 segundos)
     */
    public function middleware(): array
    {
        return [
            (new WithoutOverlapping('whatsapp-send'))->releaseAfter(10)->expireAfter(30),
        ];
    }

    /**
     * Determine the time at which the job should timeout.
     */
    public function retryUntil(): \DateTime
    {
        return now()->addHours(3); // Permitir hasta 3 horas para lotes grandes (1000+ citas)
    }

    /**
     * Execute the job.
     */
    public function handle(AppointmentReminderService $reminderService): void
    {
        // Rate limiting: esperar 3 segundos entre mensajes
        // Meta permite ~80 mensajes/segundo en Business API, pero es bueno ir conservador
        // Con 3s entre mensajes = ~20 mensajes/minuto, seguro para cualquier tier
        sleep(3);
        
        // Verificar si el batch fue cancelado
        if ($this->batch() && $this->batch()->cancelled()) {
            Log::info('Batch cancelado, cancelando job', [
                'appointment_id' => $this->appointmentId
            ]);
            return;
        }

        // Verificar si los recordatorios están pausados
        if (Setting::get('reminder_paused', 'false') === 'true') {
            Log::info('Recordatorios pausados, cancelando job', [
                'appointment_id' => $this->appointmentId
            ]);
            return;
        }

        $appointment = Appointment::find($this->appointmentId);

        if (!$appointment) {
            Log::warning('Cita no encontrada', ['appointment_id' => $this->appointmentId]);
            return;
        }

        // Verificar si ya fue enviado
        if ($appointment->reminder_sent) {
            Log::info('Recordatorio ya enviado', ['appointment_id' => $this->appointmentId]);
            return;
        }

        try {
            $result = $reminderService->sendReminder($appointment);
            
            if (!$result['success']) {
                $error = $result['error'] ?? 'Error desconocido';
                
                // Errores permanentes: no reintentar (teléfono inválido, formato incorrecto)
                if (str_contains($error, 'Número de teléfono inválido') || str_contains($error, 'formato inválido')) {
                    $this->updateProgress(false);
                    Log::warning('Error permanente, no se reintentará', [
                        'appointment_id' => $this->appointmentId,
                        'error' => $error
                    ]);
                    $this->fail(new \Exception($error));
                    return;
                }
                
                // Errores temporales: reintentar
                $this->updateProgress(false);
                throw new \Exception($error);
            }

            // Actualizar progreso de enviados exitosamente
            $this->updateProgress(true);

            Log::info('Recordatorio enviado exitosamente', [
                'appointment_id' => $this->appointmentId,
                'message_id' => $result['message_id'] ?? null
            ]);
        } catch (\Exception $e) {
            // Si no se actualizó antes, actualizar ahora como fallido
            if (!isset($result) || !$result['success']) {
                $this->updateProgress(false);
            }
            
            Log::error('Error enviando recordatorio', [
                'appointment_id' => $this->appointmentId,
                'error' => $e->getMessage()
            ]);
            
            // Re-lanzar para que el sistema de reintentos funcione
            throw $e;
        }
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        $appointment = Appointment::find($this->appointmentId);
        
        if ($appointment) {
            $appointment->markReminderFailed($exception->getMessage());
        }

        // Actualizar progreso como fallido
        $this->updateProgress(false);

        Log::error('Job de recordatorio falló después de todos los reintentos', [
            'appointment_id' => $this->appointmentId,
            'error' => $exception->getMessage()
        ]);
    }

    /**
     * Actualizar progreso del envío masivo
     */
    private function updateProgress(bool $success): void
    {
        try {
            if ($success) {
                // Incrementar contador de enviados directamente en BD sin caché
                $currentSent = (int) DB::table('settings')->where('key', 'reminder_progress_sent')->value('value') ?? 0;
                $newSent = $currentSent + 1;
                DB::table('settings')->updateOrInsert(
                    ['key' => 'reminder_progress_sent'],
                    ['value' => (string) $newSent, 'updated_at' => now()]
                );
                Cache::forget('setting.reminder_progress_sent');
            } else {
                // Incrementar contador de fallidos directamente en BD sin caché
                $currentFailed = (int) DB::table('settings')->where('key', 'reminder_progress_failed')->value('value') ?? 0;
                $newFailed = $currentFailed + 1;
                DB::table('settings')->updateOrInsert(
                    ['key' => 'reminder_progress_failed'],
                    ['value' => (string) $newFailed, 'updated_at' => now()]
                );
                Cache::forget('setting.reminder_progress_failed');
            }
        } catch (\Exception $e) {
            // No fallar el job si hay error actualizando progreso
            Log::warning('Error actualizando progreso', [
                'appointment_id' => $this->appointmentId,
                'error' => $e->getMessage()
            ]);
        }
    }
}

