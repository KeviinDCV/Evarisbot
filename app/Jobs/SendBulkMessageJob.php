<?php

namespace App\Jobs;

use App\Models\BulkSend;
use App\Models\BulkSendRecipient;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Setting;
use Illuminate\Bus\Batchable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SendBulkMessageJob implements ShouldQueue
{
    use Batchable, Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 60;
    public $maxExceptions = 3;
    public $backoff = [5, 10, 30];

    public function __construct(
        public int $recipientId,
        public int $bulkSendId
    ) {}

    /**
     * Rate limiting: evitar enviar demasiados mensajes al mismo tiempo
     */
    public function middleware(): array
    {
        return [
            (new WithoutOverlapping('whatsapp-send'))->releaseAfter(10)->expireAfter(30),
        ];
    }

    public function retryUntil(): \DateTime
    {
        return now()->addHours(3);
    }

    public function handle(): void
    {
        // Rate limiting: 3 segundos entre mensajes
        sleep(3);

        // Verificar si el batch fue cancelado
        if ($this->batch() && $this->batch()->cancelled()) {
            Log::info('Bulk send batch cancelado', ['recipient_id' => $this->recipientId]);
            return;
        }

        $recipient = BulkSendRecipient::find($this->recipientId);
        if (!$recipient) {
            Log::warning('Destinatario no encontrado', ['recipient_id' => $this->recipientId]);
            return;
        }

        // Si ya fue enviado, saltar
        if ($recipient->status === 'sent') {
            return;
        }

        $bulkSend = BulkSend::find($this->bulkSendId);
        if (!$bulkSend) {
            Log::warning('Envío masivo no encontrado', ['bulk_send_id' => $this->bulkSendId]);
            return;
        }

        // Verificar si el envío fue cancelado
        if ($bulkSend->status === 'cancelled') {
            return;
        }

        try {
            // Formatear y validar número
            $phoneNumber = preg_replace('/[^0-9]/', '', $recipient->phone_number);

            if (strlen($phoneNumber) < 10) {
                $error = 'Número de teléfono inválido: ' . $recipient->phone_number . ' (muy corto)';
                $recipient->markAsFailed($error);
                $bulkSend->incrementFailed();
                $this->fail(new \Exception($error));
                return;
            }

            // Agregar código de país Colombia si no lo tiene
            if (strlen($phoneNumber) === 10) {
                $phoneNumber = '57' . $phoneNumber;
            }

            if (strlen($phoneNumber) < 12 || strlen($phoneNumber) > 15) {
                $error = 'Número con formato inválido: ' . $recipient->phone_number . ' (longitud: ' . strlen($phoneNumber) . ')';
                $recipient->markAsFailed($error);
                $bulkSend->incrementFailed();
                $this->fail(new \Exception($error));
                return;
            }

            // Preparar componentes del template
            $components = [];
            if (!empty($bulkSend->template_params)) {
                $params = $bulkSend->template_params;
                $bodyParams = [];
                foreach ($params as $param) {
                    $bodyParams[] = ['type' => 'text', 'text' => $param];
                }
                if (!empty($bodyParams)) {
                    $components[] = [
                        'type' => 'body',
                        'parameters' => $bodyParams,
                    ];
                }
            }

            // Enviar template via WhatsApp API
            $response = $this->sendTemplateMessage($phoneNumber, $bulkSend->template_name, $components);

            if (isset($response['messages'][0]['id'])) {
                $messageId = $response['messages'][0]['id'];

                // Marcar como enviado
                $recipient->markAsSent();
                $bulkSend->incrementSent();

                // Crear/actualizar conversación y mensaje
                $conversation = Conversation::firstOrCreate(
                    ['phone_number' => '+' . $phoneNumber],
                    [
                        'contact_name' => $recipient->contact_name ?? 'Contacto',
                        'status' => 'active',
                        'last_message_at' => now(),
                    ]
                );

                Message::create([
                    'conversation_id' => $conversation->id,
                    'content' => '[Envío masivo: ' . ($bulkSend->name ?? $bulkSend->template_name) . ']',
                    'message_type' => 'text',
                    'is_from_user' => false,
                    'whatsapp_message_id' => $messageId,
                    'status' => 'sent',
                    'sent_by' => $bulkSend->created_by,
                ]);

                Log::info('Mensaje masivo enviado', [
                    'recipient_id' => $this->recipientId,
                    'phone' => $phoneNumber,
                    'message_id' => $messageId,
                ]);
            } else {
                $error = 'No se recibió ID de mensaje: ' . json_encode($response);
                $recipient->markAsFailed($error);
                $bulkSend->incrementFailed();
                throw new \Exception($error);
            }
        } catch (\Exception $e) {
            if ($recipient->status !== 'failed') {
                $recipient->markAsFailed($e->getMessage());
                $bulkSend->incrementFailed();
            }

            Log::error('Error enviando mensaje masivo', [
                'recipient_id' => $this->recipientId,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    public function failed(\Throwable $exception): void
    {
        $recipient = BulkSendRecipient::find($this->recipientId);
        if ($recipient && $recipient->status !== 'failed') {
            $recipient->markAsFailed($exception->getMessage());
            
            $bulkSend = BulkSend::find($this->bulkSendId);
            if ($bulkSend) {
                $bulkSend->incrementFailed();
            }
        }

        Log::error('Job de mensaje masivo falló definitivamente', [
            'recipient_id' => $this->recipientId,
            'error' => $exception->getMessage(),
        ]);
    }

    /**
     * Enviar template via WhatsApp Business API (mismo patrón que AppointmentReminderService)
     */
    private function sendTemplateMessage(string $to, string $templateName, array $components): array
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
            ],
        ];

        // Solo agregar components si hay parámetros
        if (!empty($components)) {
            $payload['template']['components'] = $components;
        }

        $response = Http::withToken($token)->post($url, $payload);

        if (!$response->successful()) {
            throw new \Exception('Error en API de WhatsApp (Status: ' . $response->status() . '): ' . $response->body());
        }

        return $response->json();
    }
}
