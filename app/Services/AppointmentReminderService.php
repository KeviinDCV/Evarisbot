<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Setting;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;

class AppointmentReminderService
{
    protected WhatsAppService $whatsappService;

    public function __construct(WhatsAppService $whatsappService)
    {
        $this->whatsappService = $whatsappService;
    }

    /**
     * Procesa el envío de recordatorios para el día
     */
    public function processReminders(): array
    {
        // Verificar si los recordatorios están habilitados
        if (!Setting::get('reminder_enabled', 'true') === 'true') {
            Log::info('Recordatorios deshabilitados en configuración');
            return ['sent' => 0, 'failed' => 0, 'skipped' => 0];
        }

        // Por defecto 2 días: si hoy es 12/11, busca citas para 14/11 (pasado mañana)
        $daysInAdvance = (int) Setting::get('reminder_days_in_advance', '2');
        $maxPerDay = (int) Setting::get('reminder_max_per_day', '500');
        
        // Obtener citas que necesitan recordatorio
        $appointments = $this->getAppointmentsNeedingReminder($daysInAdvance, $maxPerDay);
        
        $sent = 0;
        $failed = 0;
        $skipped = 0;

        foreach ($appointments as $appointment) {
            try {
                // Validar número de teléfono
                if (empty($appointment->pactel)) {
                    Log::warning("Cita sin teléfono", ['appointment_id' => $appointment->id]);
                    $skipped++;
                    continue;
                }

                // Enviar recordatorio
                $result = $this->sendReminder($appointment);
                
                if ($result['success']) {
                    $sent++;
                    Log::info("Recordatorio enviado", [
                        'appointment_id' => $appointment->id,
                        'phone' => $appointment->pactel,
                        'message_id' => $result['message_id']
                    ]);
                } else {
                    $failed++;
                    $appointment->markReminderFailed($result['error']);
                    Log::error("Error enviando recordatorio", [
                        'appointment_id' => $appointment->id,
                        'error' => $result['error']
                    ]);
                }
            } catch (\Exception $e) {
                $failed++;
                $appointment->markReminderFailed($e->getMessage());
                Log::error("Excepción enviando recordatorio", [
                    'appointment_id' => $appointment->id,
                    'exception' => $e->getMessage()
                ]);
            }
        }

        Log::info("Proceso de recordatorios completado", [
            'sent' => $sent,
            'failed' => $failed,
            'skipped' => $skipped,
            'total' => count($appointments)
        ]);

        return compact('sent', 'failed', 'skipped');
    }

    /**
     * Obtiene citas que necesitan recordatorio
     */
    protected function getAppointmentsNeedingReminder(int $daysInAdvance, int $limit): \Illuminate\Database\Eloquent\Collection
    {
        $targetDate = now()->addDays($daysInAdvance)->startOfDay();

        return Appointment::query()
            ->whereDate('citfc', $targetDate)
            ->where('reminder_sent', false)
            ->whereNull('reminder_error') // Excluir las que ya fallaron permanentemente
            ->whereNotNull('citfc')
            ->whereNotNull('pactel')
            ->limit($limit)
            ->get();
    }

    /**
     * Envía recordatorio de cita individual
     */
    public function sendReminder(Appointment $appointment): array
    {
        Log::info('Iniciando envío de recordatorio', [
            'appointment_id' => $appointment->id,
            'phone' => $appointment->pactel,
            'patient' => $appointment->nom_paciente
        ]);

        $templateName = Setting::get('reminder_template_name', 'appointment_reminder');
        
        // Formatear número de teléfono (eliminar caracteres no numéricos)
        $phoneNumber = preg_replace('/[^0-9]/', '', $appointment->pactel);
        
        Log::info('Número de teléfono procesado', [
            'original' => $appointment->pactel,
            'processed' => $phoneNumber,
            'length' => strlen($phoneNumber)
        ]);
        
        // Validar longitud mínima ANTES de intentar enviar
        // Un número válido colombiano tiene mínimo 10 dígitos (sin código de país)
        if (strlen($phoneNumber) < 10) {
            $errorMsg = 'Número de teléfono inválido: ' . $appointment->pactel . ' (muy corto, mínimo 10 dígitos)';
            Log::warning($errorMsg, [
                'appointment_id' => $appointment->id,
                'phone' => $phoneNumber
            ]);
            // Marcar como fallido permanentemente para no reintentar
            $appointment->markReminderFailed($errorMsg);
            return ['success' => false, 'error' => $errorMsg];
        }
        
        // Agregar código de país si no lo tiene (Colombia = 57)
        if (strlen($phoneNumber) === 10) {
            // Número colombiano de 10 dígitos (ej: 3045782893)
            $phoneNumber = '57' . $phoneNumber;
            Log::info('Código de país agregado', ['phone' => $phoneNumber]);
        }
        
        // Validar longitud final (con código de país debe ser 12 para Colombia)
        if (strlen($phoneNumber) < 12 || strlen($phoneNumber) > 15) {
            $errorMsg = 'Número de teléfono con formato inválido: ' . $appointment->pactel . ' (longitud: ' . strlen($phoneNumber) . ')';
            Log::warning($errorMsg, [
                'phone' => $phoneNumber,
                'appointment_id' => $appointment->id
            ]);
            $appointment->markReminderFailed($errorMsg);
            return ['success' => false, 'error' => $errorMsg];
        }
        
        // Preparar parámetros del template
        $parameters = $this->prepareTemplateParameters($appointment);
        
        Log::info('Parámetros del template preparados', [
            'template_name' => $templateName,
            'parameters_count' => count($parameters)
        ]);
        
        try {
            // Enviar mensaje usando template
            Log::info('Enviando mensaje a WhatsApp API', [
                'to' => $phoneNumber,
                'template' => $templateName
            ]);
            
            $response = $this->sendTemplateMessage($phoneNumber, $templateName, $parameters);
            
            Log::info('Respuesta de WhatsApp API recibida', [
                'response' => $response
            ]);
            
            if (isset($response['messages'][0]['id'])) {
                $messageId = $response['messages'][0]['id'];
                $messageStatus = $response['messages'][0]['message_status'] ?? 'unknown';
                
                Log::info('Mensaje enviado exitosamente', [
                    'message_id' => $messageId,
                    'phone' => $phoneNumber,
                    'message_status' => $messageStatus,
                    'full_response' => $response
                ]);
                
                // Buscar o crear conversación (con formato internacional +57...)
                $conversation = Conversation::firstOrCreate(
                    ['phone_number' => '+' . $phoneNumber],
                    [
                        'contact_name' => $appointment->nom_paciente,
                        'status' => 'active',
                        'last_message_at' => now()
                    ]
                );
                
                Log::info('Conversación encontrada/creada', [
                    'conversation_id' => $conversation->id,
                    'phone_number' => '+' . $phoneNumber
                ]);
                
                // Crear mensaje en la conversación
                $message = Message::create([
                    'conversation_id' => $conversation->id,
                    'content' => $this->generateReminderText($appointment),
                    'message_type' => 'text',
                    'is_from_user' => false,
                    'whatsapp_message_id' => $messageId,
                    'status' => 'sent',
                    'sent_by' => null // Sistema automático
                ]);
                
                Log::info('Mensaje guardado en BD', [
                    'message_id' => $message->id,
                    'conversation_id' => $conversation->id
                ]);
                
                // Actualizar appointment
                $appointment->update(['conversation_id' => $conversation->id]);
                $appointment->markReminderSent($messageId);
                
                Log::info('Appointment actualizado', [
                    'appointment_id' => $appointment->id,
                    'reminder_sent' => true
                ]);
                
                return ['success' => true, 'message_id' => $messageId];
            }
            
            Log::warning('No se recibió ID de mensaje en la respuesta', [
                'response' => $response
            ]);
            
            return ['success' => false, 'error' => 'No se recibió ID de mensaje. Respuesta: ' . json_encode($response)];
        } catch (\Exception $e) {
            Log::error('Excepción al enviar recordatorio', [
                'appointment_id' => $appointment->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Limpia texto para cumplir requisitos de Meta WhatsApp
     * - Sin saltos de línea
     * - Sin tabs
     * - Máximo 4 espacios consecutivos
     */
    protected function cleanTextForWhatsApp(string $text): string
    {
        // Eliminar saltos de línea y tabs
        $text = str_replace(["\n", "\r", "\t"], ' ', $text);
        
        // Reducir múltiples espacios a máximo 2 (para ser conservadores)
        $text = preg_replace('/\s{3,}/', '  ', $text);
        
        // Trim espacios al inicio y final
        $text = trim($text);
        
        return $text;
    }

    /**
     * Prepara parámetros para el template
     */
    protected function prepareTemplateParameters(Appointment $appointment): array
    {
        // Formatear fecha
        $fecha = $appointment->citfc ? $appointment->citfc->locale('es')->isoFormat('dddd D [de] MMMM [de] YYYY') : 'No especificada';
        
        // Formatear hora usando el método centralizado
        $hora = $this->formatHora($appointment->cithor);
        
        // Limpiar todos los textos para cumplir requisitos de Meta
        $paciente = $this->cleanTextForWhatsApp($appointment->nom_paciente ?? 'Paciente');
        $medico = $this->cleanTextForWhatsApp($appointment->mednom ?? 'No especificado');
        $especialidad = $this->cleanTextForWhatsApp($appointment->espnom ?? 'No especificada');
        
        return [
            [
                'type' => 'body',
                'parameters' => [
                    ['type' => 'text', 'text' => $paciente],
                    ['type' => 'text', 'text' => $fecha],
                    ['type' => 'text', 'text' => $hora],
                    ['type' => 'text', 'text' => $medico],
                    ['type' => 'text', 'text' => $especialidad],
                ]
            ]
        ];
    }

    /**
     * Genera texto del recordatorio para guardar en BD
     * Este texto debe coincidir con la plantilla aprobada por Meta
     */
    protected function generateReminderText(Appointment $appointment): string
    {
        $fecha = $appointment->citfc ? $appointment->citfc->locale('es')->isoFormat('dddd D [de] MMMM [de] YYYY') : 'No especificada';
        
        // Formatear hora usando el mismo método
        $hora = $this->formatHora($appointment->cithor);
        
        return "Estimado(a) {$appointment->nom_paciente}\n" .
               "Reciba un cordial saludo.\n" .
               "Le recordamos que tiene una cita médica programada en el Hospital Universitario del Valle, con los siguientes detalles:\n" .
               "Fecha: {$fecha}\n" .
               "Hora: {$hora}\n" .
               "Médico: {$appointment->mednom}\n" .
               "Especialidad: {$appointment->espnom}\n" .
               "Dirección: Calle 5 #36-08, barrio San Fernando.\n" .
               "Le solicitamos presentarse con 40 minutos de anticipación y portar su documento de identificación, autorización de la eps, orden médica e historia clínica.\n" .
               "Para cualquier inquietud o si necesita reprogramar su cita, por favor comuníquese con nosotros.\n" .
               "Atentamente,\n" .
               "Hospital Universitario del Valle";
    }
    
    /**
     * Formatea la hora de 24h a 12h con AM/PM
     */
    protected function formatHora($cithor): string
    {
        if (!$cithor) {
            return 'No especificada';
        }
        
        try {
            // Intentar parsear como Carbon si es datetime
            if ($cithor instanceof \Carbon\Carbon) {
                return $cithor->format('h:i A');
            } else {
                // Es string, convertir de 24h a 12h con AM/PM
                $timeParts = explode(':', $cithor);
                if (count($timeParts) >= 2) {
                    $hours = (int)$timeParts[0];
                    $minutes = $timeParts[1];
                    $ampm = $hours >= 12 ? 'PM' : 'AM';
                    $hours12 = $hours % 12;
                    if ($hours12 === 0) $hours12 = 12;
                    return sprintf('%02d:%s %s', $hours12, $minutes, $ampm);
                }
            }
        } catch (\Exception $e) {
            // Si falla, usar el valor original
            return $cithor;
        }
        
        return 'No especificada';
    }

    /**
     * Envía mensaje usando template de WhatsApp
     */
    protected function sendTemplateMessage(string $to, string $templateName, array $components): array
    {
        $token = Setting::get('whatsapp_token');
        $phoneNumberId = Setting::get('whatsapp_phone_number_id');
        
        Log::info('Verificando configuración de WhatsApp', [
            'has_token' => !empty($token),
            'has_phone_number_id' => !empty($phoneNumberId),
            'phone_number_id' => $phoneNumberId
        ]);
        
        if (!$token || !$phoneNumberId) {
            throw new \Exception('WhatsApp no configurado. Token: ' . (!empty($token) ? 'Sí' : 'No') . ', Phone Number ID: ' . (!empty($phoneNumberId) ? 'Sí' : 'No'));
        }
        
        $url = "https://graph.facebook.com/v18.0/{$phoneNumberId}/messages";
        
        $payload = [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $to,
            'type' => 'template',
            'template' => [
                'name' => $templateName,
                'language' => ['code' => 'es_CO'],
                'components' => $components
            ]
        ];
        
        Log::info('Enviando request a WhatsApp API', [
            'url' => $url,
            'to' => $to,
            'template' => $templateName,
            'payload' => $payload
        ]);
        
        $response = Http::withToken($token)
            ->post($url, $payload);
        
        Log::info('Respuesta HTTP recibida', [
            'status' => $response->status(),
            'successful' => $response->successful(),
            'body' => $response->body()
        ]);
        
        if (!$response->successful()) {
            $errorBody = $response->body();
            Log::error('Error en API de WhatsApp', [
                'status' => $response->status(),
                'body' => $errorBody
            ]);
            throw new \Exception('Error en API de WhatsApp (Status: ' . $response->status() . '): ' . $errorBody);
        }
        
        $jsonResponse = $response->json();
        Log::info('Respuesta JSON parseada', ['response' => $jsonResponse]);
        
        return $jsonResponse;
    }
}
