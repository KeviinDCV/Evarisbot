<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Support\Facades\Log;
use Twilio\Rest\Client;

class TwilioService
{
    protected $client;
    protected $from;

    public function __construct()
    {
        $sid = config('services.twilio.sid');
        $token = config('services.twilio.token');
        $this->from = config('services.twilio.whatsapp_from');

        if ($sid && $token) {
            $this->client = new Client($sid, $token);
            Log::info('Twilio client initialized successfully');
        }
    }

    /**
     * Verifica si Twilio está configurado
     */
    public function isConfigured(): bool
    {
        return $this->client !== null && $this->from !== null;
    }

    /**
     * Envía un mensaje de texto por WhatsApp
     */
    public function sendTextMessage(string $to, string $message): bool
    {
        if (!$this->isConfigured()) {
            Log::error('Twilio no está configurado');
            return false;
        }

        try {
            // Formatear número si no tiene el prefijo whatsapp:
            if (strpos($to, 'whatsapp:') !== 0) {
                $to = 'whatsapp:' . $to;
            }

            $twilioMessage = $this->client->messages->create(
                $to,
                [
                    'from' => $this->from,
                    'body' => $message
                ]
            );

            Log::info('Twilio message sent successfully', [
                'sid' => $twilioMessage->sid,
                'to' => $to,
                'status' => $twilioMessage->status
            ]);

            return true;
        } catch (\Exception $e) {
            Log::error('Error sending Twilio message', [
                'error' => $e->getMessage(),
                'to' => $to
            ]);
            return false;
        }
    }

    /**
     * Procesa un mensaje entrante desde el webhook de Twilio
     */
    public function processIncomingMessage(array $data): void
    {
        try {
            // Extraer datos del webhook de Twilio
            $from = $data['From'] ?? null;
            $body = $data['Body'] ?? '';
            $messageSid = $data['MessageSid'] ?? null;
            $profileName = $data['ProfileName'] ?? null;

            if (!$from || !$messageSid) {
                Log::warning('Webhook de Twilio con datos incompletos', ['data' => $data]);
                return;
            }

            // Limpiar el número (remover whatsapp:)
            $phoneNumber = str_replace('whatsapp:', '', $from);
            $phoneNumber = $this->formatPhoneNumber($phoneNumber);

            Log::info('Twilio webhook received', ['payload' => $data]);

            // Verificar si el mensaje ya existe (evitar duplicados)
            $existingMessage = Message::where('whatsapp_message_id', $messageSid)->first();
            if ($existingMessage) {
                Log::info('Message already processed, skipping', ['message_id' => $messageSid]);
                return;
            }

            // Buscar o crear la conversación
            $conversation = Conversation::firstOrCreate(
                ['phone_number' => $phoneNumber],
                [
                    'contact_name' => $profileName ?? $phoneNumber,
                    'status' => 'in_progress', // Auto-iniciar como "en progreso"
                    'last_message_at' => now(),
                ]
            );

            // Si la conversación ya existía y estaba resuelta, reactivarla
            if ($conversation->status === 'resolved') {
                $conversation->update(['status' => 'in_progress']);
            }

            // Crear el mensaje
            $message = Message::create([
                'conversation_id' => $conversation->id,
                'content' => $body,
                'message_type' => 'text',
                'is_from_user' => true,
                'whatsapp_message_id' => $messageSid,
                'status' => 'delivered',
            ]);

            // Actualizar la conversación
            $conversation->update([
                'last_message_at' => now(),
                'unread_count' => $conversation->unread_count + 1,
            ]);

            Log::info('Incoming Twilio message processed', [
                'conversation_id' => $conversation->id,
                'message_id' => $message->id,
                'phone_number' => $phoneNumber
            ]);

            // Disparar evento de broadcasting para tiempo real
            event(new \App\Events\NewMessageReceived($message, $conversation));

        } catch (\Exception $e) {
            Log::error('Error processing Twilio incoming message', [
                'error' => $e->getMessage(),
                'data' => $data
            ]);
        }
    }

    /**
     * Procesa actualización de estado de mensaje
     */
    public function processStatusUpdate(array $data): void
    {
        try {
            $messageSid = $data['MessageSid'] ?? null;
            $status = $data['MessageStatus'] ?? null;

            if (!$messageSid || !$status) {
                return;
            }

            Log::info('Twilio status update received', ['payload' => $data]);

            // Mapear estados de Twilio a nuestros estados
            $statusMap = [
                'queued' => 'pending',
                'sending' => 'pending',
                'sent' => 'sent',
                'delivered' => 'delivered',
                'read' => 'read',
                'failed' => 'failed',
                'undelivered' => 'failed',
            ];

            $ourStatus = $statusMap[$status] ?? null;

            if (!$ourStatus) {
                return;
            }

            // Actualizar el mensaje
            $message = Message::where('whatsapp_message_id', $messageSid)->first();

            if ($message) {
                $message->update(['status' => $ourStatus]);
                Log::info('Message status updated', [
                    'message_id' => $messageSid,
                    'status' => $ourStatus
                ]);
            }

        } catch (\Exception $e) {
            Log::error('Error processing Twilio status update', [
                'error' => $e->getMessage(),
                'data' => $data
            ]);
        }
    }

    /**
     * Formatea un número de teléfono
     */
    private function formatPhoneNumber(string $phone): string
    {
        // Remover caracteres no numéricos excepto el +
        $phone = preg_replace('/[^0-9+]/', '', $phone);

        // Asegurar que empiece con +
        if (strpos($phone, '+') !== 0) {
            $phone = '+' . $phone;
        }

        return $phone;
    }
}
