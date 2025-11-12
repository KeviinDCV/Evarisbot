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
use Illuminate\Support\Facades\Log;

class SendAppointmentReminderJob implements ShouldQueue
{
    use Batchable, Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 300; // 5 minutos por job
    public $tries = 3; // Reintentar hasta 3 veces

    /**
     * Create a new job instance.
     */
    public function __construct(
        public int $appointmentId
    ) {}

    /**
     * Execute the job.
     */
    public function handle(AppointmentReminderService $reminderService): void
    {
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
                throw new \Exception($result['error'] ?? 'Error desconocido');
            }

            Log::info('Recordatorio enviado exitosamente', [
                'appointment_id' => $this->appointmentId,
                'message_id' => $result['message_id'] ?? null
            ]);
        } catch (\Exception $e) {
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

        Log::error('Job de recordatorio falló después de todos los reintentos', [
            'appointment_id' => $this->appointmentId,
            'error' => $exception->getMessage()
        ]);
    }
}

