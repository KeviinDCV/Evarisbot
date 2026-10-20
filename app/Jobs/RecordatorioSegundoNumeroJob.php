<?php

namespace App\Jobs;

use App\Models\Appointment;
use App\Services\AppointmentReminderService;
use App\Support\EnvioRecordatorios;
use App\Support\Recordatorios;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Manda el recordatorio al SEGUNDO teléfono de la cita cuando Meta avisa (webhook «failed») que el primero no lo
 * recibió: no tiene WhatsApp o WhatsApp lo rechazó. Lo encola WhatsAppWebhookController; corre en la cola, al ritmo de
 * los recordatorios, y antes de enviar comprueba que la cita siga igual (sin respuesta, no pasada, sin otro envío).
 */
class RecordatorioSegundoNumeroJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 60;
    public $backoff = [30, 60, 120];

    public function __construct(
        public int $appointmentId,
        public string $wamidFallido,
        public string $motivo
    ) {}

    public function middleware(): array
    {
        return [
            (new WithoutOverlapping('whatsapp-send'))->releaseAfter(10)->expireAfter(30),
        ];
    }

    public function retryUntil(): \DateTime
    {
        return now()->addHours(6);
    }

    public function handle(AppointmentReminderService $reminderService): void
    {
        $appointment = Appointment::find($this->appointmentId);
        if (!$appointment || !$this->sigueIgual($appointment)) {
            return;
        }

        // Pausado el envío de su ámbito: se retiene, como los recordatorios.
        $service = $appointment->service ?: 'general';
        if (DB::table('settings')->where('key', EnvioRecordatorios::prefijo($service).'reminder_paused')->value('value') === 'true') {
            $this->release(60);
            return;
        }

        sleep((int) config('recordatorios.pausa_entre_envios', 3));
        $appointment->refresh();
        if (!$this->sigueIgual($appointment)) {
            return;
        }

        $resultado = $reminderService->enviarAlSegundo($appointment, $this->motivo);
        if ($resultado === null) {
            return;
        }
        if ($resultado['success']) {
            Log::info('Recordatorio enviado al teléfono 2', ['appointment_id' => $appointment->id, 'message_id' => $resultado['message_id'] ?? null]);
            return;
        }

        $alcance = $resultado['alcance'] ?? 'cita';
        if ($alcance === 'reintentar') {
            // Falla temporal de Meta: se reintenta (backoff); al agotarse, la cita queda con el error del primero.
            throw new \RuntimeException($resultado['error'] ?? 'Falla temporal de WhatsApp');
        }
        if ($alcance === 'lote') {
            // Problema del hospital (plantilla, cuenta, límite), no del número: la cita conserva el error del primero.
            Log::warning('Teléfono 2 no enviado por un problema de la cuenta o la plantilla', ['appointment_id' => $appointment->id, 'motivo' => $resultado['motivo'] ?? null]);
            return;
        }

        // El segundo tampoco sirve: la cita queda con error, con los dos motivos.
        $error = in_array($resultado['motivo'] ?? null, Recordatorios::MOTIVOS_DEL_NUMERO, true)
            ? Recordatorios::error($resultado['motivo'], 'Ninguno de los dos números recibió el recordatorio', 'Teléfono: '.($appointment->reminder_error ?? $this->motivo).' · Teléfono 2: '.($resultado['error'] ?? ''))
            : ($resultado['error'] ?? Recordatorios::error('otro', 'No se pudo enviar al teléfono 2'));
        $appointment->markReminderFailed($error);
        Log::warning('El teléfono 2 tampoco recibió el recordatorio', ['appointment_id' => $appointment->id, 'motivo' => $resultado['motivo'] ?? null]);
    }

    /** ¿La cita sigue como la dejó el aviso de Meta? (sin respuesta del paciente, no pasada, sin otro envío desde entonces) */
    private function sigueIgual(Appointment $appointment): bool
    {
        $fecha = Recordatorios::fechaDe($appointment->getAttributes()['citfc'] ?? null);

        return $appointment->reminder_whatsapp_message_id === $this->wamidFallido
            && $appointment->reminder_status === 'failed'
            && (int) $appointment->reminder_numero !== 2
            && $fecha !== null && $fecha >= Recordatorios::hoy()
            && isset(Recordatorios::celularesCita($appointment->pactel, $appointment->pactel2)[1]);
    }
}
