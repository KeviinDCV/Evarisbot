<?php

namespace App\Jobs;

use App\Models\Appointment;
use App\Services\AppointmentReminderService;
use App\Support\EnvioRecordatorios;
use App\Support\Recordatorios;
use Illuminate\Bus\Batchable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\MaxAttemptsExceededException;
use Illuminate\Queue\SerializesModels;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SendAppointmentReminderJob implements ShouldQueue
{
    use Batchable, Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 60; // 1 minuto por job
    public $maxExceptions = 3; // Solo fallar después de 3 ERRORES REALES (no lock contention)
    public $backoff = [5, 10, 30]; // Esperar 5s, 10s, 30s entre reintentos

    /**
     * Create a new job instance.
     *
     * OJO: el constructor no se cambia. Los trabajos ya encolados se deserializan con estas propiedades; una
     * propiedad promovida nueva quedaría sin inicializar en ellos y el trabajo fallaría.
     */
    public function __construct(
        public int $appointmentId
    ) {}

    /**
     * Envío «todas las citas cargadas»: en vez de meter miles de trabajos de golpe en la única cola (los masivos y el
     * segundo número esperarían horas detrás), hay UN trabajo del envío en la cola. Cada uno, cuando ya va a seguir
     * (sin pausa y de día), deja en la fila al de la siguiente cita del lote (EnvioRecordatorios::idsDelLote). Así se
     * turna con los demás trabajos, como los masivos. De noche espera hasta Recordatorios::HORA_INICIO_ENVIO.
     *
     * Propiedades con valor por defecto (no en el constructor): los trabajos ya encolados se deserializan sin ellas y
     * quedan en false/null, como siempre.
     */
    public bool $encadenado = false;

    public ?string $ambito = null;

    public function encadenar(string $service): static
    {
        $this->encadenado = true;
        $this->ambito = $service;

        return $this;
    }

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
        // En cadena el trabajo entra a la cola justo a su turno, pero puede dormir la noche o una pausa larga: si
        // venciera en esa espera, su cita se saltaría.
        if ($this->encadenado) {
            return now()->addDays(3);
        }

        return now()->addHours(3); // Permitir hasta 3 horas para lotes grandes (1000+ citas)
    }

    /**
     * En cadena: deja en la cola el trabajo de la siguiente cita del lote. Una sola vez por cita y lote (un trabajo
     * liberado o reintentado no la vuelve a dejar) y nunca con el lote cancelado («Detener» o un corte).
     */
    private function encadenarSiguiente(): void
    {
        if (! $this->encadenado || ! $this->batchId) {
            return;
        }

        try {
            $lote = $this->batch();
            if (! $lote || $lote->cancelled()) {
                return;
            }
            if (! Cache::add('recordatorios:'.$this->batchId.':cadena:'.$this->appointmentId, 1, now()->addDays(4))) {
                return;
            }

            $ids = EnvioRecordatorios::idsDelLote($this->ambito ?: 'general', $this->batchId);
            if ($ids === null) {
                // La lista del lote aún no está guardada (el inicio la escribe justo después de encolar): reintentar.
                throw new \RuntimeException('La lista de citas del envío todavía no está guardada');
            }
            $posicion = array_search($this->appointmentId, $ids, true);
            if ($posicion === false || ! isset($ids[$posicion + 1])) {
                return; // Era la última: el lote termina cuando acabe este trabajo.
            }

            $lote->add([(new self($ids[$posicion + 1]))->encadenar($this->ambito ?: 'general')]);
        } catch (\Throwable $e) {
            // Sin el siguiente la cadena se cortaría: se suelta la marca para que el reintento lo deje.
            Cache::forget('recordatorios:'.$this->batchId.':cadena:'.$this->appointmentId);
            Log::error('Recordatorios en cadena: no se pudo dejar el siguiente', [
                'appointment_id' => $this->appointmentId,
                'batch_id' => $this->batchId,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Execute the job.
     */
    public function handle(AppointmentReminderService $reminderService): void
    {
        // Verificaciones ANTES del rate-limit: así cancelar/pausar/saltar es inmediato
        // y no se gastan 3s en jobs que no van a enviar.

        // Lote cancelado («Detener», o cortado por un error de cuenta o plantilla) → consumir el job sin enviar.
        if ($this->batch() && $this->batch()->cancelled()) {
            Log::info('Batch cancelado, cancelando job', [
                'appointment_id' => $this->appointmentId
            ]);
            return;
        }

        $appointment = Appointment::find($this->appointmentId);

        if (!$appointment) {
            Log::warning('Cita no encontrada', ['appointment_id' => $this->appointmentId]);
            $this->encadenarSiguiente();
            return;
        }

        $service = $appointment->service ?: 'general';

        // Pausado → RETENER el job en la cola (release), NO consumirlo. La pausa es la del ámbito de ESTA cita
        // (oncology_reminder_paused en Oncología): pausar General ya no frena Oncología ni al revés. Se lee directo
        // de la tabla, sin la caché de Setting::get, para que pausar sea inmediato.
        if (DB::table('settings')->where('key', EnvioRecordatorios::prefijo($service).'reminder_paused')->value('value') === 'true') {
            $this->release(15);
            return;
        }

        // Envío «todas»: de noche no se les escribe a los pacientes. El trabajo duerme hasta la apertura (sin dejar
        // al siguiente: la cadena sigue en la mañana).
        if ($this->encadenado && ($apertura = Recordatorios::proximaApertura())) {
            EnvioRecordatorios::anotarEspera($service, $apertura->format('Y-m-d H:i'));
            $this->release(max(60, $apertura->getTimestamp() - now()->getTimestamp()));
            return;
        }

        // Va a seguir: deja en la fila al de la siguiente cita (solo en cadena).
        $this->encadenarSiguiente();

        // Ya enviado → saltar (sin gastar el rate-limit).
        if ($appointment->reminder_sent) {
            Log::info('Recordatorio ya enviado', ['appointment_id' => $this->appointmentId]);
            return;
        }

        // Cancelada (por el paciente o por el hospital) o confirmada → no se manda «le recordamos su cita».
        if (in_array($appointment->reminder_status, Recordatorios::RESUELTAS, true)) {
            Log::info('Cita ya resuelta: no se envía recordatorio', [
                'appointment_id' => $this->appointmentId,
                'estado' => $appointment->reminder_status,
            ]);
            return;
        }

        // Cita de un día que ya pasó (o sin fecha): nunca se le manda «le recordamos su cita». Red de seguridad para
        // trabajos viejos que sigan en la cola; no se marca nada.
        $fecha = Recordatorios::fechaDe($appointment->getAttributes()['citfc'] ?? null);
        if ($fecha === null || $fecha < Recordatorios::hoy()) {
            Log::info('Cita sin fecha o ya pasada: no se envía recordatorio', ['appointment_id' => $this->appointmentId, 'citfc' => $fecha]);
            return;
        }

        // Fila gemela ya avisada: la misma cita (misma cédula, fecha y hora en el mismo ámbito) cargada dos veces.
        // Solo por cédula, nunca por teléfono: hermanos con el mismo celular a la misma hora son citas distintas.
        if ($this->marcarSiEsGemela($appointment)) {
            return;
        }

        // Rate limiting: 3 segundos entre ENVÍOS reales (Meta). ~20 mensajes/minuto,
        // seguro para cualquier tier. Solo se aplica a los que de verdad se envían.
        sleep((int) config('recordatorios.pausa_entre_envios', 3));

        // En esos segundos pudieron detener o pausar el envío, o cancelar la cita: se vuelve a mirar antes de llamar
        // a Meta (si no, salía igual un mensaje que ya no debía salir).
        if ($this->batch() && $this->batch()->cancelled()) {
            return;
        }
        if (DB::table('settings')->where('key', EnvioRecordatorios::prefijo($service).'reminder_paused')->value('value') === 'true') {
            $this->release(15);
            return;
        }
        $appointment->refresh();
        if ($appointment->reminder_sent || in_array($appointment->reminder_status, Recordatorios::RESUELTAS, true)) {
            Log::info('La cita cambió mientras esperaba turno: no se envía', ['appointment_id' => $this->appointmentId, 'estado' => $appointment->reminder_status]);
            return;
        }

        $result = $reminderService->sendReminder($appointment);

        if ($result['success']) {
            Log::info('Recordatorio enviado exitosamente', [
                'appointment_id' => $this->appointmentId,
                'message_id' => $result['message_id'] ?? null
            ]);
            return;
        }

        $error = $result['error'] ?? Recordatorios::error('otro', 'No se pudo enviar');
        $motivo = $result['motivo'] ?? Recordatorios::motivo($error) ?? 'otro';
        $alcance = $result['alcance'] ?? (Recordatorios::ALCANCE[$motivo] ?? 'cita');

        // Problema del hospital (plantilla, cuenta, límite): cortar el lote entero SIN marcar la cita, que vuelve a
        // contar en «Por enviar». Primero se deja el «cortado» con su motivo y luego se cancela, para que la pantalla
        // no lo cierre antes como «terminado». El resto del lote retorna sin llamar a Meta.
        if ($alcance === 'lote') {
            EnvioRecordatorios::cortar($service, $this->batchId, $motivo);
            $this->batch()?->cancel();
            Log::warning('Envío de recordatorios cortado: el problema no es de la cita', [
                'appointment_id' => $this->appointmentId,
                'batch_id' => $this->batchId,
                'motivo' => $motivo,
                'error' => $error,
            ]);
            return;
        }

        // Falla temporal (Meta caído, sin conexión): reintentar con espera; al agotarse, failed() la marca con un
        // error reintentable, que vuelve a contar en «Por enviar».
        if ($alcance === 'reintentar') {
            Log::warning('Falla temporal enviando recordatorio, se reintentará', [
                'appointment_id' => $this->appointmentId,
                'error' => $error,
            ]);
            throw new \RuntimeException($error);
        }

        // Error de la cita (teléfono, número sin WhatsApp, dato que no sirve, Meta no respondió…): no reintentar.
        Log::warning('Error permanente, no se reintentará', [
            'appointment_id' => $this->appointmentId,
            'error' => $error
        ]);
        $this->fail(new \RuntimeException($error));
    }

    /**
     * Si otra cita del mismo ámbito con la misma cédula, fecha y hora ya recibió el recordatorio, esta se marca como
     * avisada (con la hora y la conversación de la gemela, sin id de mensaje) y no se envía nada.
     */
    private function marcarSiEsGemela(Appointment $appointment): bool
    {
        $cedula = trim((string) $appointment->citide);
        $fecha = Recordatorios::fechaDe($appointment->getAttributes()['citfc'] ?? null);
        $hora = $appointment->getAttributes()['cithor'] ?? null;
        if ($cedula === '' || $fecha === null || $hora === null || $hora === '') {
            return false;
        }

        $gemela = Appointment::where('service', $appointment->service)
            ->where('citide', $appointment->citide)
            ->where('citfc', $fecha)
            ->where('cithor', $hora)
            ->where('id', '!=', $appointment->id)
            ->where('reminder_sent', true)
            // Si a la gemela Meta luego no se lo entregó ('failed'), el paciente no quedó avisado: esta sí se envía.
            ->where(fn ($q) => $q->whereNull('reminder_status')->orWhere('reminder_status', '!=', 'failed'))
            ->orderBy('id')
            ->first();

        if (!$gemela) {
            return false;
        }

        Appointment::whereKey($appointment->id)->update([
            'reminder_sent' => true,
            'reminder_status' => 'sent',
            'reminder_sent_at' => $gemela->reminder_sent_at,
            'conversation_id' => $gemela->conversation_id,
            'notes' => trim(($appointment->notes ?? '').' [Duplicada de la cita #'.$gemela->id.': no se envió otro recordatorio]'),
        ]);

        Log::info('Cita duplicada de otra ya avisada: no se envía otro recordatorio', [
            'appointment_id' => $appointment->id,
            'gemela_id' => $gemela->id,
        ]);

        return true;
    }

    /**
     * Handle a job failure.
     *
     * Si el trabajo se agotó por tiempo o intentos (pausa larga, servicio detenido: MaxAttemptsExceeded, que incluye
     * TimeoutExceeded) NO se marca la cita: no es culpa del paciente y debe seguir en «Por enviar».
     */
    public function failed(\Throwable $exception): void
    {
        // En cadena, un trabajo que muere sin haber dejado al siguiente cortaría el envío: se deja aquí.
        try {
            $this->encadenarSiguiente();
        } catch (\Throwable) {
            // Ya quedó en el log; el envío se puede volver a iniciar desde la pantalla.
        }

        if ($exception instanceof MaxAttemptsExceededException) {
            Log::warning('Recordatorio agotado por tiempo o intentos: la cita queda por enviar', [
                'appointment_id' => $this->appointmentId,
                'error' => $exception->getMessage(),
            ]);
            return;
        }

        $mensaje = $exception->getMessage();
        if (!str_starts_with($mensaje, '[')) {
            // Una excepción que no vino del envío (p. ej. la base): se guarda etiquetada para que la pantalla la explique.
            $mensaje = Recordatorios::error('otro', 'No se pudo enviar', $mensaje);
        }

        $appointment = Appointment::find($this->appointmentId);

        if ($appointment && !$appointment->reminder_sent) {
            $appointment->markReminderFailed($mensaje);
        }

        Log::error('Job de recordatorio falló después de todos los reintentos', [
            'appointment_id' => $this->appointmentId,
            'error' => $mensaje
        ]);
    }
}
