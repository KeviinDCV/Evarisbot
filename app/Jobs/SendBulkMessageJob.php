<?php

namespace App\Jobs;

use App\Models\BulkSend;
use App\Models\BulkSendRecipient;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Setting;
use App\Models\WhatsappTemplate;
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

            // Obtener el template para header_format
            $template = WhatsappTemplate::where('meta_template_name', $bulkSend->template_name)->first();

            // Header component para DOCUMENT/IMAGE/VIDEO
            if ($template && in_array($template->header_format, ['DOCUMENT', 'IMAGE', 'VIDEO']) && $template->header_media_url) {
                $headerType = strtolower($template->header_format);
                $headerParam = ['type' => $headerType];

                if ($headerType === 'document') {
                    $headerParam[$headerType] = ['link' => $template->header_media_url, 'filename' => $template->name . '.pdf'];
                } else {
                    $headerParam[$headerType] = ['link' => $template->header_media_url];
                }

                $components[] = [
                    'type' => 'header',
                    'parameters' => [$headerParam],
                ];
            }

            // Body params: usar column_mapping si existe, sino fallback al comportamiento anterior
            $paramValues = [];
            $columnMapping = $bulkSend->column_mapping;

            if (!empty($columnMapping) && is_array($columnMapping)) {
                // Mapeo explícito: { "1": { "source": "nombre" }, "2": { "source": "column", "column": "especialidad" }, "3": { "source": "static", "value": "Dr. Gómez" } }
                $maxParam = max(array_map('intval', array_keys($columnMapping)));
                for ($i = 1; $i <= $maxParam; $i++) {
                    $mapping = $columnMapping[(string) $i] ?? null;
                    if (!$mapping) {
                        $paramValues[] = '';
                        continue;
                    }

                    $source = $mapping['source'] ?? '';
                    if ($source === 'nombre') {
                        $paramValues[] = $recipient->contact_name ?? '';
                    } elseif ($source === 'column' && isset($mapping['column'])) {
                        $columnName = $mapping['column'];
                        $rawValue = $recipient->params[$columnName] ?? '';
                        // Si la columna mapea a una "hora", saneamos: si Excel envió "DD/MM/YYYY HH:MM AM/PM" dejamos solo la hora.
                        $paramValues[] = $this->sanitizeParamValue($columnName, $rawValue);
                    } elseif ($source === 'static' && isset($mapping['value'])) {
                        $paramValues[] = $mapping['value'];
                    } else {
                        $paramValues[] = '';
                    }
                }
            } elseif (!empty($recipient->params) && is_array($recipient->params)) {
                // Fallback: params dinámicos sin mapeo explícito (comportamiento anterior)
                $paramValues[] = $recipient->contact_name ?? '';
                foreach ($recipient->params as $value) {
                    $paramValues[] = $value;
                }
            } elseif (!empty($bulkSend->template_params)) {
                $paramValues = $bulkSend->template_params;
            }

            if (!empty($paramValues)) {
                // Filtrar valores null/vacíos para evitar enviar parámetros inválidos
                $paramValues = array_map(fn($v) => $v ?? '', $paramValues);
                $bodyParams = [];
                foreach ($paramValues as $param) {
                    $bodyParams[] = ['type' => 'text', 'text' => (string) $param];
                }
                $components[] = [
                    'type' => 'body',
                    'parameters' => $bodyParams,
                ];
            }

            // Enviar template via WhatsApp API
            $response = $this->sendTemplateMessage($phoneNumber, $bulkSend->template_name, $components, $bulkSend->template_language ?? 'es_CO');

            if (isset($response['messages'][0]['id'])) {
                $messageId = $response['messages'][0]['id'];

                // Marcar como enviado (esto es lo crítico - el mensaje ya salió)
                $recipient->markAsSent();
                $bulkSend->incrementSent();

                // Registrar en conversación local (no debe afectar el conteo si falla)
                try {
                    $conversation = Conversation::firstOrCreate(
                        ['phone_number' => '+' . $phoneNumber],
                        [
                            'contact_name' => $recipient->contact_name ?? 'Contacto',
                            'status' => 'active',
                            'last_message_at' => now(),
                        ]
                    );

                    // Obtener el preview_text del template para mostrar en el chat
                    $previewText = $template?->preview_text ?? '';

                    // Si hay params dinámicos, reemplazar {{1}}, {{2}}, etc. en el preview
                    if ($previewText && !empty($paramValues)) {
                        foreach ($paramValues as $index => $paramValue) {
                            $placeholder = '{{' . ($index + 1) . '}}';
                            $previewText = str_replace($placeholder, (string) $paramValue, $previewText);
                        }
                    }

                    $bulkSendLabel = '[Envío masivo: ' . ($bulkSend->name ?? $bulkSend->template_name) . ']';
                    $messageContent = $previewText
                        ? $bulkSendLabel . "\n" . $previewText
                        : $bulkSendLabel;

                    Message::create([
                        'conversation_id' => $conversation->id,
                        'content' => $messageContent,
                        'message_type' => 'text',
                        'is_from_user' => false,
                        'whatsapp_message_id' => $messageId,
                        'status' => 'sent',
                        'sent_by' => $bulkSend->created_by,
                    ]);
                } catch (\Exception $localErr) {
                    Log::warning('Mensaje masivo enviado pero error al registrar localmente', [
                        'recipient_id' => $this->recipientId,
                        'phone' => $phoneNumber,
                        'message_id' => $messageId,
                        'error' => $localErr->getMessage(),
                    ]);
                }

                // Si era una cancelación, dejar la cita en 'cancelled'. Sin esto el mensaje
                // salía pero la cita seguía "confirmada" y el bot contradecía al asesor.
                \App\Services\AppointmentCancellationSync::fromTemplate(
                    $phoneNumber,
                    $bulkSend->template_name,
                    $paramValues,
                    'envío masivo #' . $bulkSend->id
                );

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
            // Solo marcar como fallido si NO fue enviado exitosamente
            if ($recipient->status !== 'failed' && $recipient->status !== 'sent') {
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
        // No marcar como fallido si ya fue enviado exitosamente
        if ($recipient && $recipient->status !== 'failed' && $recipient->status !== 'sent') {
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
    private function sendTemplateMessage(string $to, string $templateName, array $components, string $language = 'es_CO'): array
    {
        $token = Setting::get('whatsapp_token');
        $phoneNumberId = Setting::get('whatsapp_phone_number_id');

        if (!$token || !$phoneNumberId) {
            throw new \Exception('WhatsApp no configurado');
        }

        $url = "https://graph.facebook.com/v21.0/{$phoneNumberId}/messages";

        $payload = [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $to,
            'type' => 'template',
            'template' => [
                'name' => $templateName,
                'language' => ['code' => $language],
            ],
        ];

        // Solo agregar components si hay parámetros
        if (!empty($components)) {
            $payload['template']['components'] = $components;
        }

        $response = Http::withToken($token)->post($url, $payload);

        Log::info('WhatsApp API response for bulk send', [
            'recipient' => $to,
            'template' => $templateName,
            'status' => $response->status(),
            'body' => $response->json(),
        ]);

        if (!$response->successful()) {
            $err = $response->json()['error'] ?? [];
            throw new \Exception(\App\Support\WhatsAppErrorTranslator::human(
                $err['code'] ?? null,
                $err['message'] ?? null,
                $err['error_data']['details'] ?? null
            ));
        }

        return $response->json();
    }

    /**
     * Sanea el valor de un parámetro según el nombre de la columna.
     * Caso típico: Excel exporta celdas formateadas como "Hora" con la fecha pegada
     * (p.ej. "30/04/2026 10:00 AM"). Si la columna se llama "hora ...", extraemos solo la hora.
     * También limpia espacios redundantes y devuelve string.
     */
    private function sanitizeParamValue(string $columnName, $rawValue): string
    {
        if ($rawValue === null) {
            return '';
        }
        $value = trim((string) $rawValue);
        if ($value === '') {
            return '';
        }

        $columnLower = mb_strtolower($columnName);
        $isHoraColumn = str_contains($columnLower, 'hora');
        $isFechaColumn = str_contains($columnLower, 'fecha');

        // Si la columna es de hora pero el valor incluye una fecha al inicio (DD/MM/YYYY o YYYY-MM-DD), removerla.
        if ($isHoraColumn && !$isFechaColumn) {
            // Patrón: fecha + espacio + resto (la hora real)
            if (preg_match('#^\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}\s+(.+)$#u', $value, $m)) {
                $value = trim($m[1]);
            } elseif (preg_match('#^\d{4}[/\-]\d{1,2}[/\-]\d{1,2}\s+(.+)$#u', $value, $m)) {
                $value = trim($m[1]);
            }
        }

        // Si la columna es de fecha y trae también la hora pegada, dejar solo la fecha.
        if ($isFechaColumn && !$isHoraColumn) {
            if (preg_match('#^(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})\s+\d{1,2}:\d{2}#u', $value, $m)) {
                $value = $m[1];
            } elseif (preg_match('#^(\d{4}[/\-]\d{1,2}[/\-]\d{1,2})\s+\d{1,2}:\d{2}#u', $value, $m)) {
                $value = $m[1];
            }
        }

        // Colapsar espacios múltiples y saltos de línea (Meta no acepta \n en parámetros).
        $value = preg_replace('/\s+/u', ' ', $value);
        return trim($value);
    }
}
