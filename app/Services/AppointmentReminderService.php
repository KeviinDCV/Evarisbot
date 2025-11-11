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
        $templateName = Setting::get('reminder_template_name', 'appointment_reminder');
        
        // Formatear número de teléfono (eliminar caracteres no numéricos)
        $phoneNumber = preg_replace('/[^0-9]/', '', $appointment->pactel);
        
        // Agregar código de país si no lo tiene (Colombia = 57)
        if (strlen($phoneNumber) === 10) {
            // Número colombiano de 10 dígitos (ej: 3045782893)
            $phoneNumber = '57' . $phoneNumber;
        }
        
        // Preparar parámetros del template
        $parameters = $this->prepareTemplateParameters($appointment);
        
        try {
            // Enviar mensaje usando template
            $response = $this->sendTemplateMessage($phoneNumber, $templateName, $parameters);
            
            if (isset($response['messages'][0]['id'])) {
                $messageId = $response['messages'][0]['id'];
                
                // Buscar o crear conversación (con formato internacional +57...)
                $conversation = Conversation::firstOrCreate(
                    ['phone_number' => '+' . $phoneNumber],
                    [
                        'contact_name' => $appointment->nom_paciente,
                        'status' => 'active',
                        'last_message_at' => now()
                    ]
                );
                
                // Crear mensaje en la conversación
                Message::create([
                    'conversation_id' => $conversation->id,
                    'content' => $this->generateReminderText($appointment),
                    'message_type' => 'text',
                    'is_from_user' => false,
                    'whatsapp_message_id' => $messageId,
                    'status' => 'sent',
                    'sent_by' => null // Sistema automático
                ]);
                
                // Actualizar appointment
                $appointment->update(['conversation_id' => $conversation->id]);
                $appointment->markReminderSent($messageId);
                
                return ['success' => true, 'message_id' => $messageId];
            }
            
            return ['success' => false, 'error' => 'No se recibió ID de mensaje'];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
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
        
        return [
            [
                'type' => 'body',
                'parameters' => [
                    ['type' => 'text', 'text' => $appointment->nom_paciente ?? 'Paciente'],
                    ['type' => 'text', 'text' => $fecha],
                    ['type' => 'text', 'text' => $hora],
                    ['type' => 'text', 'text' => $appointment->mednom ?? 'No especificado'],
                    ['type' => 'text', 'text' => $appointment->espnom ?? 'No especificada'],
                ]
            ]
        ];
    }

    /**
     * Genera texto del recordatorio para guardar en BD
     */
    protected function generateReminderText(Appointment $appointment): string
    {
        $fecha = $appointment->citfc ? $appointment->citfc->locale('es')->isoFormat('dddd D [de] MMMM [de] YYYY') : 'No especificada';
        
        // Formatear hora usando el mismo método
        $hora = $this->formatHora($appointment->cithor);
        
        return "🏥 *Recordatorio de Cita Médica*\n\n" .
               "Hola {$appointment->nom_paciente}, le recordamos su cita médica:\n\n" .
               "📅 *Fecha:* {$fecha}\n" .
               "⏰ *Hora:* {$hora}\n" .
               "👨‍⚕️ *Médico:* {$appointment->mednom}\n" .
               "🏥 *Especialidad:* {$appointment->espnom}\n\n" .
               "Por favor, llegue 15 minutos antes de su cita.\n\n" .
               "Si no puede asistir, responda a este mensaje para reprogramar.";
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
        
        if (!$token || !$phoneNumberId) {
            throw new \Exception('WhatsApp no configurado');
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
        
        $response = Http::withToken($token)
            ->post($url, $payload);
        
        if (!$response->successful()) {
            throw new \Exception('Error en API de WhatsApp: ' . $response->body());
        }
        
        return $response->json();
    }
}
