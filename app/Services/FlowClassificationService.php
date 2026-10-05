<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\FlowClassification;
use Carbon\Carbon;

/**
 * Normaliza la data del menú de bienvenida (welcome_flow_data, guardada como JSON por paso)
 * en una fila por conversación lista para reportes/estadísticas de demanda.
 *
 * Se llama cada vez que avanza el flujo. La clasificación se deriva del CAMINO recorrido
 * (no requiere que el flujo esté "completado"): así también capta journeys parciales/abandonos.
 */
class FlowClassificationService
{
    private const EPS = [
        'eps_nueva_eps' => 'NUEVA EPS', 'eps_coosalud' => 'COOSALUD', 'eps_emssanar' => 'EMSSANAR',
        'eps_sura' => 'SURA', 'eps_sanitas' => 'SANITAS', 'eps_salud_total' => 'SALUD TOTAL',
        'eps_comfenalco' => 'COMFENALCO', 'eps_famisanar' => 'FAMISANAR', 'eps_sos' => 'SOS',
    ];

    private const SERVICE = [
        'svc_agendamiento' => 'agendamiento', 'svc_cancelacion' => 'cancelacion',
        'svc_informacion' => 'informacion', 'svc_asesor' => 'asesor',
    ];

    private const SUB_SERVICE = [
        'agenda_especializada' => 'Medicina especializada', 'agenda_anestesia' => 'Cita de anestesia',
        'agenda_colposcopia' => 'Colposcopia/conización', 'agenda_cistoscopia' => 'Cistoscopia/urodinamia',
        'agenda_cirugia' => 'Programación de cirugía', 'agenda_particular' => 'Cita particular',
        'agenda_recordatorio' => 'Recordatorios de citas', 'agenda_cancelacion' => 'Cancelación de servicios',
        'info_recordatorio' => 'Recordatorio de cita', 'info_resultados' => 'Resultados', 'info_general' => 'Información general',
    ];

    public static function sync(Conversation $conversation): void
    {
        $data = $conversation->welcome_flow_data ?? [];
        if (empty($data)) {
            return;
        }

        $btn = fn (string $k) => $data[$k]['button_id'] ?? null;
        $txt = fn (string $k) => $data[$k]['text'] ?? null;

        // Documento
        $docType = match ($btn('document_type')) {
            'doc_cc' => 'CC',
            'doc_ti' => 'TI',
            'doc_other' => $txt('document_type_other'),
            default => null,
        };

        // EPS
        $epsId = $btn('eps_selection');
        $eps = $epsId === 'eps_otro' ? $txt('eps_other') : (self::EPS[$epsId] ?? null);

        // Régimen
        $regimen = match ($btn('regimen')) {
            'regimen_subsidiado' => 'subsidiado',
            'regimen_contributivo' => 'contributivo',
            default => null,
        };

        // Servicio y sub-servicio
        $service = self::SERVICE[$btn('service_menu')] ?? null;
        $sub = self::SUB_SERVICE[$btn('agendamiento_submenu')]
            ?? self::SUB_SERVICE[$btn('informacion_menu')]
            ?? null;

        // Desenlace, derivado del camino recorrido
        $outcome = 'in_progress';
        if ($btn('welcome') === 'reject_privacy') {
            $outcome = 'rejected';
        } elseif ($service === 'asesor' || ($service === 'agendamiento' && $btn('agendamiento_submenu'))) {
            $outcome = 'advisor';
        } elseif ($service === 'cancelacion' || ($service === 'informacion' && $btn('informacion_menu'))) {
            $outcome = 'self_service';
        }

        $startedAt = isset($data['welcome']['timestamp'])
            ? Carbon::parse($data['welcome']['timestamp'])
            : null;

        FlowClassification::updateOrCreate(
            ['conversation_id' => $conversation->id],
            [
                'accepted_privacy' => $btn('welcome') === 'accept_privacy',
                'document_type' => $docType,
                'eps' => $eps,
                'regimen' => $regimen,
                'service' => $service,
                'sub_service' => $sub,
                'outcome' => $outcome,
                'last_step' => $conversation->welcome_flow_step,
                'started_at' => $startedAt,
                'completed_at' => in_array($outcome, ['advisor', 'self_service', 'rejected'], true) ? now() : null,
            ]
        );
    }
}
