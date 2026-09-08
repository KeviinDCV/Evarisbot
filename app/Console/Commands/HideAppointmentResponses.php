<?php

namespace App\Console\Commands;

use App\Models\Message;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Backfill: oculta (is_hidden = 1) los mensajes históricos que son respuestas
 * automáticas de cita, para que dejen de inundar la lista de "Conversaciones".
 *
 * Alta precisión (criterio conservador, ante la duda NO oculta):
 *  - Respuestas del SISTEMA: texto generado por el bot (prefijos exactos conocidos).
 *  - Mensajes del PACIENTE: contenido EXACTO de confirmar/cancelar (no frases largas)
 *    y SOLO en conversaciones que además tienen una respuesta automática del sistema
 *    (garantiza que fue un flujo de cita y no un mensaje real que necesita asesoría).
 */
class HideAppointmentResponses extends Command
{
    protected $signature = 'conversations:hide-appointment-responses {--dry-run : Solo muestra cuántos ocultaría, sin tocar nada}';

    protected $description = 'Oculta de los asesores los mensajes históricos de confirmación/cancelación automática de citas.';

    /** Prefijos exactos de las respuestas automáticas del sistema (ver WhatsAppService). */
    private array $systemPrefixes = [
        '✅ *Confirmación recibida*%',
        '❌ *Cancelación%',          // cubre "Cancelación" y "Cancelación registrada"
        '⚠️ *Citas ya procesadas*%',
    ];

    /** Contenido EXACTO (minúsculas, sin espacios) de un confirmar/cancelar del paciente. */
    private array $patientKeywords = [
        'confirmar', 'confirmo', 'confirmado', 'confirmada',
        'asistir', 'asisto', 'asistire', 'asistiré',
        'cancelar', 'cancelo', 'cancelado', 'cancelada',
        'si confirmo', 'sí confirmo', 'si asisto', 'sí asisto',
        '✅', '❌',
    ];

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        // --- 1) Respuestas automáticas del SISTEMA ---
        $systemQuery = Message::query()
            ->where('is_hidden', false)
            ->where('is_from_user', false)
            ->whereNull('sent_by')
            ->where(function ($q) {
                foreach ($this->systemPrefixes as $like) {
                    $q->orWhere('content', 'like', $like);
                }
            });

        // Conversaciones que tuvieron una respuesta automática (evidencia de flujo de cita).
        $appointmentConvoIds = (clone $systemQuery)->distinct()->pluck('conversation_id');

        // --- 2) Mensajes del PACIENTE: confirmar/cancelar exactos en esas conversaciones ---
        $patientQuery = Message::query()
            ->where('is_hidden', false)
            ->where('is_from_user', true)
            ->whereIn('conversation_id', $appointmentConvoIds)
            ->whereIn(DB::raw('LOWER(TRIM(content))'), $this->patientKeywords);

        $systemCount = (clone $systemQuery)->count();
        $patientCount = (clone $patientQuery)->count();

        $this->info("Respuestas automáticas del sistema a ocultar: {$systemCount}");
        $this->info("Mensajes de paciente (confirmar/cancelar exactos) a ocultar: {$patientCount}");
        $this->info('Conversaciones con flujo de cita detectadas: ' . $appointmentConvoIds->count());

        if ($dryRun) {
            $this->warn('[DRY-RUN] No se modificó nada.');
            return self::SUCCESS;
        }

        $hiddenSystem = (clone $systemQuery)->update(['is_hidden' => true]);
        $hiddenPatient = (clone $patientQuery)->update(['is_hidden' => true]);

        $this->info("Ocultados — sistema: {$hiddenSystem}, paciente: {$hiddenPatient}");
        Log::info('Backfill de mensajes de cita ocultados', [
            'sistema' => $hiddenSystem,
            'paciente' => $hiddenPatient,
        ]);

        return self::SUCCESS;
    }
}
