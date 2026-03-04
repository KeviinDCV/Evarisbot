<?php

namespace App\Services;

use App\Events\MessageSent;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Setting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppService
{
    private string $apiUrl = 'https://graph.facebook.com/v21.0';
    private ?string $token;
    private ?string $phoneNumberId;

    public function __construct()
    {
        $this->token = Setting::get('whatsapp_token');
        $this->phoneNumberId = Setting::get('whatsapp_phone_id');
    }

    /**
     * Enviar mensaje de texto
     */
    public function sendTextMessage(string $to, string $message): array
    {
        if (!$this->isConfigured()) {
            return [
                'success' => false,
                'error' => 'WhatsApp API no está configurada',
            ];
        }

        try {
            $response = Http::withToken($this->token)
                ->post("{$this->apiUrl}/{$this->phoneNumberId}/messages", [
                    'messaging_product' => 'whatsapp',
                    'to' => $this->formatPhoneNumber($to),
                    'type' => 'text',
                    'text' => [
                        'body' => $message,
                    ],
                ]);

            if ($response->successful()) {
                $data = $response->json();
                
                Log::info('WhatsApp message sent', [
                    'to' => $to,
                    'message_id' => $data['messages'][0]['id'] ?? null,
                ]);

                return [
                    'success' => true,
                    'message_id' => $data['messages'][0]['id'] ?? null,
                    'data' => $data,
                ];
            }

            Log::error('WhatsApp API error', [
                'to' => $to,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            $errorJson = $response->json();
            $errorMsg = $errorJson['error']['message'] ?? 'Error desconocido';
            $errorCode = $errorJson['error']['code'] ?? null;
            $errorSubcode = $errorJson['error']['error_subcode'] ?? null;
            $errorDetail = $errorJson['error']['error_data']['details'] ?? null;
            
            $fullError = $errorMsg;
            if ($errorCode) $fullError .= " (code: {$errorCode}";
            if ($errorSubcode) $fullError .= ", subcode: {$errorSubcode}";
            if ($errorCode) $fullError .= ')';
            if ($errorDetail) $fullError .= " - {$errorDetail}";

            return [
                'success' => false,
                'error' => $fullError,
            ];

        } catch (\Exception $e) {
            Log::error('WhatsApp send message exception', [
                'error' => $e->getMessage(),
                'to' => $to,
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Enviar mensaje con imagen
     */
    public function sendImageMessage(string $to, string $imageUrl, ?string $caption = null): array
    {
        if (!$this->isConfigured()) {
            return ['success' => false, 'error' => 'WhatsApp API no está configurada'];
        }

        try {
            $payload = [
                'messaging_product' => 'whatsapp',
                'to' => $this->formatPhoneNumber($to),
                'type' => 'image',
                'image' => [
                    'link' => $imageUrl,
                ],
            ];

            if ($caption) {
                $payload['image']['caption'] = $caption;
            }

            Log::info('Sending image to WhatsApp', [
                'to' => $to,
                'url' => $imageUrl,
                'caption' => $caption,
                'payload' => $payload,
            ]);

            $response = Http::withToken($this->token)
                ->post("{$this->apiUrl}/{$this->phoneNumberId}/messages", $payload);

            Log::info('WhatsApp image response', [
                'status' => $response->status(),
                'body' => $response->json(),
            ]);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'message_id' => $response->json()['messages'][0]['id'] ?? null,
                ];
            }

            Log::error('WhatsApp API error sending image', [
                'status' => $response->status(),
                'response' => $response->json(),
                'url' => $imageUrl,
                'to' => $to,
            ]);

            return [
                'success' => false,
                'error' => $response->json()['error']['message'] ?? 'Error desconocido',
            ];

        } catch (\Exception $e) {
            Log::error('WhatsApp send image exception', [
                'error' => $e->getMessage(),
                'url' => $imageUrl,
                'to' => $to,
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Enviar mensaje con documento
     */
    public function sendDocumentMessage(string $to, string $documentUrl, string $filename, ?string $caption = null): array
    {
        if (!$this->isConfigured()) {
            return ['success' => false, 'error' => 'WhatsApp API no está configurada'];
        }

        try {
            $payload = [
                'messaging_product' => 'whatsapp',
                'to' => $this->formatPhoneNumber($to),
                'type' => 'document',
                'document' => [
                    'link' => $documentUrl,
                    'filename' => $filename,
                ],
            ];

            // Agregar caption si existe
            if ($caption) {
                $payload['document']['caption'] = $caption;
            }

            $response = Http::withToken($this->token)
                ->post("{$this->apiUrl}/{$this->phoneNumberId}/messages", $payload);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'message_id' => $response->json()['messages'][0]['id'] ?? null,
                ];
            }

            Log::error('WhatsApp API error sending document', [
                'status' => $response->status(),
                'response' => $response->json(),
                'url' => $documentUrl,
                'filename' => $filename,
                'to' => $to,
            ]);

            return [
                'success' => false,
                'error' => $response->json()['error']['message'] ?? 'Error desconocido',
            ];

        } catch (\Exception $e) {
            Log::error('WhatsApp send document exception', [
                'error' => $e->getMessage(),
                'url' => $documentUrl,
                'filename' => $filename,
                'to' => $to,
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Enviar mensaje con video
     */
    public function sendVideoMessage(string $to, string $videoUrl, ?string $caption = null): array
    {
        if (!$this->isConfigured()) {
            return ['success' => false, 'error' => 'WhatsApp API no está configurada'];
        }

        try {
            $payload = [
                'messaging_product' => 'whatsapp',
                'to' => $this->formatPhoneNumber($to),
                'type' => 'video',
                'video' => [
                    'link' => $videoUrl,
                ],
            ];

            if ($caption) {
                $payload['video']['caption'] = $caption;
            }

            $response = Http::withToken($this->token)
                ->post("{$this->apiUrl}/{$this->phoneNumberId}/messages", $payload);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'message_id' => $response->json()['messages'][0]['id'] ?? null,
                ];
            }

            Log::error('WhatsApp API error sending video', [
                'status' => $response->status(),
                'response' => $response->json(),
                'url' => $videoUrl,
                'to' => $to,
            ]);

            return [
                'success' => false,
                'error' => $response->json()['error']['message'] ?? 'Error desconocido',
            ];

        } catch (\Exception $e) {
            Log::error('WhatsApp send video exception', [
                'error' => $e->getMessage(),
                'url' => $videoUrl,
                'to' => $to,
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Enviar mensaje con audio
     */
    public function sendAudioMessage(string $to, string $audioUrl): array
    {
        if (!$this->isConfigured()) {
            return ['success' => false, 'error' => 'WhatsApp API no está configurada'];
        }

        try {
            $response = Http::withToken($this->token)
                ->post("{$this->apiUrl}/{$this->phoneNumberId}/messages", [
                    'messaging_product' => 'whatsapp',
                    'to' => $this->formatPhoneNumber($to),
                    'type' => 'audio',
                    'audio' => [
                        'link' => $audioUrl,
                    ],
                ]);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'message_id' => $response->json()['messages'][0]['id'] ?? null,
                ];
            }

            Log::error('WhatsApp API error sending audio', [
                'status' => $response->status(),
                'response' => $response->json(),
                'url' => $audioUrl,
                'to' => $to,
            ]);

            return [
                'success' => false,
                'error' => $response->json()['error']['message'] ?? 'Error desconocido',
            ];

        } catch (\Exception $e) {
            Log::error('WhatsApp send audio exception', [
                'error' => $e->getMessage(),
                'url' => $audioUrl,
                'to' => $to,
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Marcar mensaje como leído
     */
    public function markAsRead(string $messageId): bool
    {
        if (!$this->isConfigured()) {
            return false;
        }

        try {
            $response = Http::withToken($this->token)
                ->post("{$this->apiUrl}/{$this->phoneNumberId}/messages", [
                    'messaging_product' => 'whatsapp',
                    'status' => 'read',
                    'message_id' => $messageId,
                ]);

            return $response->successful();

        } catch (\Exception $e) {
            Log::error('WhatsApp mark as read exception', ['error' => $e->getMessage()]);
            return false;
        }
    }

    /**
     * Descargar media desde WhatsApp API usando media ID
     */
    /**
     * Mapa de MIME types comunes a extensiones de archivo
     */
    private const MIME_EXTENSIONS = [
        // Documentos Office
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
        'application/vnd.ms-excel' => 'xls',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
        'application/msword' => 'doc',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation' => 'pptx',
        'application/vnd.ms-powerpoint' => 'ppt',
        // PDF
        'application/pdf' => 'pdf',
        // Imágenes
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
        'image/svg+xml' => 'svg',
        // Audio
        'audio/ogg' => 'ogg',
        'audio/mpeg' => 'mp3',
        'audio/mp4' => 'm4a',
        'audio/amr' => 'amr',
        'audio/aac' => 'aac',
        // Video
        'video/mp4' => 'mp4',
        'video/3gpp' => '3gp',
        // Texto
        'text/plain' => 'txt',
        'text/csv' => 'csv',
        // Comprimidos
        'application/zip' => 'zip',
        'application/x-rar-compressed' => 'rar',
        'application/x-7z-compressed' => '7z',
    ];

    /**
     * Obtener extensión a partir del MIME type
     */
    private function getExtensionFromMime(?string $mimeType): string
    {
        if (!$mimeType) {
            return 'bin';
        }

        // Quitar parámetros del mime type (ej: "audio/ogg; codecs=opus" → "audio/ogg")
        $cleanMime = strtolower(trim(explode(';', $mimeType)[0]));

        if (isset(self::MIME_EXTENSIONS[$cleanMime])) {
            return self::MIME_EXTENSIONS[$cleanMime];
        }

        // Fallback: usar la parte después del / si es simple (ej: image/png → png)
        $parts = explode('/', $cleanMime);
        $sub = $parts[1] ?? 'bin';

        // Si la sub-parte es corta (5 chars o menos), probablemente es una extensión válida
        if (strlen($sub) <= 5 && preg_match('/^[a-z0-9]+$/', $sub)) {
            return $sub;
        }

        return 'bin';
    }

    public function downloadMedia(string $mediaId, ?string $originalFilename = null): ?string
    {
        try {
            // Paso 1: Obtener URL del media
            $response = Http::withToken($this->token)
                ->get("{$this->apiUrl}/{$mediaId}");

            if (!$response->successful()) {
                Log::error('Failed to get media URL', [
                    'media_id' => $mediaId,
                    'response' => $response->json(),
                ]);
                return null;
            }

            $mediaUrl = $response->json()['url'] ?? null;
            $apiMimeType = $response->json()['mime_type'] ?? null;
            
            if (!$mediaUrl) {
                Log::error('Media URL not found in response', ['response' => $response->json()]);
                return null;
            }

            // Paso 2: Descargar el archivo
            $fileResponse = Http::withToken($this->token)
                ->timeout(30)
                ->get($mediaUrl);

            if (!$fileResponse->successful()) {
                Log::error('Failed to download media file', ['url' => $mediaUrl]);
                return null;
            }

            // Paso 3: Determinar extensión correcta
            $mimeType = $apiMimeType ?? $fileResponse->header('Content-Type');
            
            // Si tenemos un archivo original con extensión, usarla
            if ($originalFilename && pathinfo($originalFilename, PATHINFO_EXTENSION)) {
                $extension = pathinfo($originalFilename, PATHINFO_EXTENSION);
            } else {
                $extension = $this->getExtensionFromMime($mimeType);
            }

            // Paso 4: Generar nombre de archivo preservando el nombre original si es posible
            if ($originalFilename) {
                // Sanitizar nombre: quitar caracteres especiales, mantener legible
                $safeName = preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', pathinfo($originalFilename, PATHINFO_FILENAME));
                $safeName = substr($safeName, 0, 100); // limitar longitud
                $storageName = 'whatsapp_media/' . uniqid() . '_' . $safeName . '.' . $extension;
            } else {
                $storageName = 'whatsapp_media/' . uniqid() . '.' . $extension;
            }
            
            \Storage::disk('public')->put($storageName, $fileResponse->body());

            // Usar ruta relativa para compatibilidad con IP local y ngrok
            $localUrl = '/storage/' . $storageName;
            
            Log::info('Media downloaded successfully', [
                'media_id' => $mediaId,
                'local_url' => $localUrl,
                'original_filename' => $originalFilename,
                'mime_type' => $mimeType,
                'extension' => $extension,
            ]);

            return $localUrl;

        } catch (\Exception $e) {
            Log::error('Download media exception', [
                'media_id' => $mediaId,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Formatear número de teléfono (eliminar + y espacios)
     */
    private function formatPhoneNumber(string $phone): string
    {
        return preg_replace('/[^0-9]/', '', $phone);
    }

    /**
     * Enviar plantilla de saludo de asesor
     * Esta plantilla debe estar aprobada en Meta con el nombre 'saludo_asesor'
     */
    public function sendGreetingTemplate(string $to, string $advisorName): array
    {
        if (!$this->isConfigured()) {
            return ['success' => false, 'error' => 'WhatsApp API no está configurada'];
        }

        try {
            $payload = [
                'messaging_product' => 'whatsapp',
                'recipient_type' => 'individual',
                'to' => $this->formatPhoneNumber($to),
                'type' => 'template',
                'template' => [
                    'name' => 'saludo_asesor',
                    'language' => ['code' => 'es_CO'],
                    'components' => [
                        [
                            'type' => 'body',
                            'parameters' => [
                                ['type' => 'text', 'text' => $advisorName],
                            ]
                        ]
                    ]
                ]
            ];

            Log::info('Enviando plantilla de saludo', [
                'to' => $to,
                'advisor' => $advisorName,
            ]);

            $response = Http::withToken($this->token)
                ->post("{$this->apiUrl}/{$this->phoneNumberId}/messages", $payload);

            if ($response->successful()) {
                $data = $response->json();
                Log::info('Plantilla de saludo enviada', [
                    'to' => $to,
                    'message_id' => $data['messages'][0]['id'] ?? null,
                ]);

                return [
                    'success' => true,
                    'message_id' => $data['messages'][0]['id'] ?? null,
                    'data' => $data,
                ];
            }

            Log::error('Error enviando plantilla de saludo', [
                'to' => $to,
                'formatted_to' => $this->formatPhoneNumber($to),
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            $errorJson = $response->json();
            $errorMsg = $errorJson['error']['message'] ?? 'Error desconocido';
            $errorCode = $errorJson['error']['code'] ?? null;
            $errorSubcode = $errorJson['error']['error_subcode'] ?? null;
            $errorDetail = $errorJson['error']['error_data']['details'] ?? null;
            
            $fullError = $errorMsg;
            if ($errorCode) $fullError .= " (code: {$errorCode}";
            if ($errorSubcode) $fullError .= ", subcode: {$errorSubcode}";
            if ($errorCode) $fullError .= ')';
            if ($errorDetail) $fullError .= " - {$errorDetail}";

            return [
                'success' => false,
                'error' => $fullError,
            ];

        } catch (\Exception $e) {
            Log::error('Excepción enviando plantilla de saludo', [
                'error' => $e->getMessage(),
                'to' => $to,
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Enviar mensaje interactivo con botones de respuesta rápida
     * WhatsApp permite máximo 3 botones con un título de hasta 20 caracteres
     */
    public function sendInteractiveButtonMessage(string $to, string $bodyText, array $buttons): array
    {
        if (!$this->isConfigured()) {
            return ['success' => false, 'error' => 'WhatsApp API no está configurada'];
        }

        try {
            // Construir los botones en formato WhatsApp API
            $whatsappButtons = array_map(function ($button) {
                return [
                    'type' => 'reply',
                    'reply' => [
                        'id' => $button['id'],
                        'title' => mb_substr($button['title'], 0, 20), // WhatsApp límite 20 chars
                    ],
                ];
            }, $buttons);

            $payload = [
                'messaging_product' => 'whatsapp',
                'recipient_type' => 'individual',
                'to' => $this->formatPhoneNumber($to),
                'type' => 'interactive',
                'interactive' => [
                    'type' => 'button',
                    'body' => [
                        'text' => $bodyText,
                    ],
                    'action' => [
                        'buttons' => $whatsappButtons,
                    ],
                ],
            ];

            Log::info('Sending interactive button message', [
                'to' => $to,
                'buttons_count' => count($buttons),
            ]);

            $response = Http::withToken($this->token)
                ->post("{$this->apiUrl}/{$this->phoneNumberId}/messages", $payload);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'message_id' => $response->json()['messages'][0]['id'] ?? null,
                ];
            }

            Log::error('WhatsApp API error sending interactive buttons', [
                'status' => $response->status(),
                'response' => $response->json(),
                'to' => $to,
            ]);

            return [
                'success' => false,
                'error' => $response->json()['error']['message'] ?? 'Error desconocido',
            ];

        } catch (\Exception $e) {
            Log::error('WhatsApp send interactive buttons exception', [
                'error' => $e->getMessage(),
                'to' => $to,
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Enviar mensaje interactivo con lista desplegable
     * WhatsApp permite hasta 10 secciones con hasta 10 opciones cada una
     */
    public function sendInteractiveListMessage(string $to, string $bodyText, string $buttonText, array $sections): array
    {
        if (!$this->isConfigured()) {
            return ['success' => false, 'error' => 'WhatsApp API no está configurada'];
        }

        try {
            // Construir secciones en formato WhatsApp API
            // Nota: WhatsApp limita a 10 filas TOTALES entre todas las secciones
            $totalRows = 0;
            $whatsappSections = [];

            foreach ($sections as $section) {
                $rows = [];
                foreach ($section['rows'] ?? [] as $row) {
                    if ($totalRows >= 10) break;
                    $rowData = [
                        'id' => $row['id'],
                        'title' => mb_substr($row['title'], 0, 24),
                    ];
                    // Solo incluir description si tiene contenido (WhatsApp rechaza strings vacíos)
                    if (!empty($row['description'])) {
                        $rowData['description'] = mb_substr($row['description'], 0, 72);
                    }
                    $rows[] = $rowData;
                    $totalRows++;
                }

                if (!empty($rows)) {
                    $sectionData = ['rows' => $rows];
                    // Solo incluir title si hay múltiples secciones
                    if (count($sections) > 1 && !empty($section['title'])) {
                        $sectionData['title'] = mb_substr($section['title'], 0, 24);
                    }
                    $whatsappSections[] = $sectionData;
                }
            }

            if (empty($whatsappSections)) {
                return ['success' => false, 'error' => 'No hay filas para enviar en la lista'];
            }

            $payload = [
                'messaging_product' => 'whatsapp',
                'recipient_type' => 'individual',
                'to' => $this->formatPhoneNumber($to),
                'type' => 'interactive',
                'interactive' => [
                    'type' => 'list',
                    'body' => [
                        'text' => $bodyText,
                    ],
                    'action' => [
                        'button' => mb_substr($buttonText, 0, 20),
                        'sections' => $whatsappSections,
                    ],
                ],
            ];

            Log::info('Sending interactive list message', [
                'to' => $to,
                'sections_count' => count($whatsappSections),
                'total_rows' => $totalRows,
            ]);

            $response = Http::withToken($this->token)
                ->post("{$this->apiUrl}/{$this->phoneNumberId}/messages", $payload);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'message_id' => $response->json()['messages'][0]['id'] ?? null,
                ];
            }

            Log::error('WhatsApp API error sending interactive list', [
                'status' => $response->status(),
                'response' => $response->json(),
                'to' => $to,
                'payload_sections' => count($whatsappSections),
                'payload_rows' => $totalRows,
            ]);

            return [
                'success' => false,
                'error' => $response->json()['error']['message'] ?? 'Error desconocido',
            ];

        } catch (\Exception $e) {
            Log::error('WhatsApp send interactive list exception', [
                'error' => $e->getMessage(),
                'to' => $to,
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Enviar el flujo de bienvenida (primer paso) a un contacto nuevo
     */
    public function sendWelcomeFlow(string $phoneNumber, Conversation $conversation): bool
    {
        $welcomeFlow = \App\Models\WelcomeFlow::getActive();
        
        if (!$welcomeFlow) {
            return false;
        }

        // Buscar el paso de entrada (entry point)
        $entryStep = $welcomeFlow->getEntryStep();
        
        if (!$entryStep) {
            // Fallback: usar el mensaje del flujo principal (compatibilidad)
            $buttons = $welcomeFlow->buttons ?? [];
            $message = $welcomeFlow->message;

            if (empty($buttons)) {
                $result = $this->sendTextMessage($phoneNumber, $message);
            } else {
                $result = $this->sendInteractiveButtonMessage($phoneNumber, $message, $buttons);
            }

            if ($result['success'] ?? false) {
                Message::create([
                    'conversation_id' => $conversation->id,
                    'content' => $message,
                    'message_type' => 'text',
                    'is_from_user' => false,
                    'whatsapp_message_id' => $result['message_id'] ?? null,
                    'status' => 'sent',
                    'sent_by' => null,
                ]);
                return true;
            }
            return false;
        }

        // Enviar el paso de entrada
        return $this->sendFlowStep($entryStep, $phoneNumber, $conversation);
    }

    /**
     * Enviar un paso específico del flujo
     */
    private function sendFlowStep(\App\Models\WelcomeFlowStep $step, string $phoneNumber, Conversation $conversation): bool
    {
        try {
            $message = $step->message;
            $result = null;

            switch ($step->message_type) {
                case 'interactive_buttons':
                    $buttons = $step->buttons ?? [];
                    if (!empty($buttons)) {
                        $result = $this->sendInteractiveButtonMessage($phoneNumber, $message, $buttons);
                    } else {
                        $result = $this->sendTextMessage($phoneNumber, $message);
                    }
                    break;

                case 'interactive_list':
                    $options = $step->options ?? [];
                    if (!empty($options)) {
                        $buttonText = $options['button_text'] ?? 'Seleccionar';
                        $sections = $options['sections'] ?? [];
                        $result = $this->sendInteractiveListMessage($phoneNumber, $message, $buttonText, $sections);
                    } else {
                        $result = $this->sendTextMessage($phoneNumber, $message);
                    }
                    break;

                case 'text':
                case 'wait_response':
                    $result = $this->sendTextMessage($phoneNumber, $message);
                    break;
            }

            if ($result && ($result['success'] ?? false)) {
                // Guardar mensaje en la conversación
                Message::create([
                    'conversation_id' => $conversation->id,
                    'content' => $message,
                    'message_type' => 'text',
                    'is_from_user' => false,
                    'whatsapp_message_id' => $result['message_id'] ?? null,
                    'status' => 'sent',
                    'sent_by' => null,
                ]);

                // Actualizar el estado de la conversación
                $conversation->update([
                    'welcome_flow_step' => $step->step_key,
                ]);

                Log::info('Welcome flow step sent', [
                    'conversation_id' => $conversation->id,
                    'step_key' => $step->step_key,
                    'phone' => $phoneNumber,
                ]);

                return true;
            } else {
                Log::error('Failed to send flow step', [
                    'step_key' => $step->step_key,
                    'phone' => $phoneNumber,
                    'error' => $result['error'] ?? 'Unknown',
                ]);
            }

        } catch (\Exception $e) {
            Log::error('Send flow step exception', [
                'error' => $e->getMessage(),
                'step_key' => $step->step_key,
            ]);
        }

        return false;
    }

    /**
     * Procesar interacción del usuario con el flujo de bienvenida (botón o texto)
     * Devuelve true si se procesó como parte del flujo
     */
    public function processWelcomeFlowInteraction(
        string $phoneNumber, 
        Conversation $conversation, 
        ?string $buttonId = null,
        ?string $userText = null
    ): bool {
        // Si ya completó el flujo, no procesar
        if ($conversation->welcome_flow_completed) {
            return false;
        }

        // Si no está en ningún paso del flujo, no procesar
        $currentStepKey = $conversation->welcome_flow_step;
        if (!$currentStepKey) {
            return false;
        }

        $welcomeFlow = \App\Models\WelcomeFlow::getActive();
        if (!$welcomeFlow) {
            return false;
        }

        $currentStep = $welcomeFlow->getStepByKey($currentStepKey);
        if (!$currentStep) {
            return false;
        }

        try {
            $nextStepKey = null;

            // Si recibimos texto y el paso espera botones/lista, intentar hacer match
            // Esto permite responder con texto cuando el interactivo se envió como fallback de texto
            if ($userText && !$buttonId && in_array($currentStep->message_type, ['interactive_buttons', 'interactive_list'])) {
                $matchedId = $this->matchTextToStepOption($currentStep, $userText);
                if ($matchedId) {
                    $buttonId = $matchedId;
                    Log::info('Welcome flow: text matched to option', [
                        'conversation_id' => $conversation->id,
                        'step' => $currentStepKey,
                        'text' => $userText,
                        'matched_id' => $matchedId,
                    ]);
                }
            }

            // Determinar siguiente paso según tipo de interacción
            if ($buttonId && $currentStep->next_steps) {
                $nextStepKey = $currentStep->next_steps[$buttonId] ?? null;

                // Guardar la selección del usuario
                $flowData = $conversation->welcome_flow_data ?? [];
                $flowData[$currentStepKey] = [
                    'button_id' => $buttonId,
                    'timestamp' => now()->toISOString(),
                ];
                $conversation->update(['welcome_flow_data' => $flowData]);

                Log::info('Welcome flow button pressed', [
                    'conversation_id' => $conversation->id,
                    'step' => $currentStepKey,
                    'button_id' => $buttonId,
                    'next_step' => $nextStepKey,
                ]);

            } elseif ($userText && $currentStep->message_type === 'wait_response') {
                $nextStepKey = $currentStep->next_step_on_text;

                // Guardar la respuesta de texto del usuario
                $flowData = $conversation->welcome_flow_data ?? [];
                $flowData[$currentStepKey] = [
                    'text' => $userText,
                    'timestamp' => now()->toISOString(),
                ];
                $conversation->update(['welcome_flow_data' => $flowData]);

                Log::info('Welcome flow text response', [
                    'conversation_id' => $conversation->id,
                    'step' => $currentStepKey,
                    'text' => mb_substr($userText, 0, 50),
                    'next_step' => $nextStepKey,
                ]);
            } else {
                // Si el paso actual espera botones/lista pero recibimos texto sin match, enviar fallback
                if (in_array($currentStep->message_type, ['interactive_buttons', 'interactive_list']) && $userText && !$buttonId) {
                    $fallback = $currentStep->fallback_message ?? 'Por favor, selecciona una de las opciones disponibles.';
                    $result = $this->sendTextMessage($phoneNumber, $fallback);
                    if ($result['success'] ?? false) {
                        Message::create([
                            'conversation_id' => $conversation->id,
                            'content' => $fallback,
                            'message_type' => 'text',
                            'is_from_user' => false,
                            'whatsapp_message_id' => $result['message_id'] ?? null,
                            'status' => 'sent',
                            'sent_by' => null,
                        ]);
                    }
                    return true; // Procesado como parte del flujo
                }
                return false;
            }

            // Si hay un siguiente paso, enviarlo
            if ($nextStepKey) {
                if ($nextStepKey === '__complete__') {
                    // Flujo completado
                    $conversation->update([
                        'welcome_flow_completed' => true,
                        'welcome_flow_step' => null,
                    ]);

                    Log::info('Welcome flow completed', [
                        'conversation_id' => $conversation->id,
                        'flow_data' => $conversation->welcome_flow_data,
                    ]);

                    return true;
                }

                if ($nextStepKey === '__reset__') {
                    // Flujo rechazado: resetear para que al escribir de nuevo inicie desde 0
                    $conversation->update([
                        'welcome_flow_completed' => false,
                        'welcome_flow_step' => null,
                        'welcome_flow_data' => null,
                    ]);

                    Log::info('Welcome flow reset (rejected by user)', [
                        'conversation_id' => $conversation->id,
                    ]);

                    return true;
                }

                if ($nextStepKey === '__complete_assign_advisor__') {
                    // Flujo completado + asignar a asesor de turno aleatorio
                    $conversation->update([
                        'welcome_flow_completed' => true,
                        'welcome_flow_step' => null,
                    ]);

                    // Buscar asesores de turno activos
                    $onDutyAdvisors = \App\Models\User::where('role', 'advisor')
                        ->where('is_on_duty', true)
                        ->pluck('id')
                        ->toArray();

                    if (!empty($onDutyAdvisors)) {
                        // Asignar aleatoriamente a un asesor de turno
                        $assignedAdvisorId = $onDutyAdvisors[array_rand($onDutyAdvisors)];
                        $conversation->update(['assigned_to' => $assignedAdvisorId]);

                        $advisor = \App\Models\User::find($assignedAdvisorId);
                        Log::info('Welcome flow: assigned to on-duty advisor', [
                            'conversation_id' => $conversation->id,
                            'advisor_id' => $assignedAdvisorId,
                            'advisor_name' => $advisor?->name,
                        ]);
                    } else {
                        // Sin asesores de turno, dejar sin asignar
                        // El admin lo asignará manualmente
                        Log::info('Welcome flow: no on-duty advisors, leaving unassigned', [
                            'conversation_id' => $conversation->id,
                        ]);
                    }

                    return true;
                }

                $nextStep = $welcomeFlow->getStepByKey($nextStepKey);
                if (!$nextStep) {
                    Log::error('Welcome flow: next step not found', [
                        'conversation_id' => $conversation->id,
                        'current_step' => $currentStepKey,
                        'next_step_key' => $nextStepKey,
                    ]);
                    return false;
                }

                $sent = $this->sendFlowStep($nextStep, $phoneNumber, $conversation);

                // Si falló el envío (ej: WhatsApp API rechazó lista interactiva),
                // intentar enviar como texto plano para no perder el flujo
                if (!$sent && in_array($nextStep->message_type, ['interactive_list', 'interactive_buttons'])) {
                    Log::warning('Welcome flow: interactive message failed, retrying as text', [
                        'conversation_id' => $conversation->id,
                        'step_key' => $nextStep->step_key,
                        'message_type' => $nextStep->message_type,
                    ]);

                    $fallbackText = $nextStep->message;
                    // Agregar opciones como texto si es lista
                    if ($nextStep->message_type === 'interactive_list' && !empty($nextStep->options['sections'])) {
                        foreach ($nextStep->options['sections'] as $section) {
                            foreach ($section['rows'] ?? [] as $row) {
                                $fallbackText .= "\n• " . $row['title'];
                            }
                        }
                        $fallbackText .= "\n\n_Escribe el nombre de la opción que deseas._";
                    } elseif ($nextStep->message_type === 'interactive_buttons' && !empty($nextStep->buttons)) {
                        foreach ($nextStep->buttons as $btn) {
                            $fallbackText .= "\n• " . $btn['title'];
                        }
                        $fallbackText .= "\n\n_Escribe la opción que deseas._";
                    }

                    $textResult = $this->sendTextMessage($phoneNumber, $fallbackText);
                    if ($textResult['success'] ?? false) {
                        Message::create([
                            'conversation_id' => $conversation->id,
                            'content' => $fallbackText,
                            'message_type' => 'text',
                            'is_from_user' => false,
                            'whatsapp_message_id' => $textResult['message_id'] ?? null,
                            'status' => 'sent',
                            'sent_by' => null,
                        ]);
                        $conversation->update(['welcome_flow_step' => $nextStep->step_key]);
                        $sent = true;
                    }
                }

                if ($sent) {
                    // Si el paso enviado es de tipo 'text' (mensaje terminal sin interacción),
                    // verificar si debe resetear el flujo para reiniciar desde 0
                    if ($nextStep->message_type === 'text' && $nextStep->next_step_on_text === '__reset__') {
                        $conversation->update([
                            'welcome_flow_completed' => false,
                            'welcome_flow_step' => null,
                            'welcome_flow_data' => null,
                        ]);

                        Log::info('Welcome flow auto-reset after terminal step', [
                            'conversation_id' => $conversation->id,
                            'step_key' => $nextStep->step_key,
                        ]);
                    }
                }

                return $sent;
            }

            // Si no hay siguiente paso, marcar como completado
            $conversation->update([
                'welcome_flow_completed' => true,
                'welcome_flow_step' => null,
            ]);

            return true;

        } catch (\Exception $e) {
            Log::error('Process welcome flow interaction exception', [
                'error' => $e->getMessage(),
                'conversation_id' => $conversation->id,
                'step' => $currentStepKey,
            ]);
        }

        return false;
    }

    /**
     * Procesar respuesta de botón del flujo de bienvenida (compatibilidad)
     */
    public function processWelcomeFlowResponse(string $buttonId, string $phoneNumber, Conversation $conversation): bool
    {
        return $this->processWelcomeFlowInteraction($phoneNumber, $conversation, $buttonId);
    }

    /**
     * Intentar hacer match de texto libre del usuario con las opciones de un paso interactivo.
     * Permite que el usuario responda con texto cuando el mensaje interactivo se envió como fallback de texto.
     */
    private function matchTextToStepOption(\App\Models\WelcomeFlowStep $step, string $userText): ?string
    {
        $normalizedText = mb_strtolower(trim($userText));
        // Quitar emojis del texto del usuario para comparación limpia
        $cleanText = trim(preg_replace('/[\x{1F000}-\x{1FFFF}\x{2600}-\x{27FF}\x{FE00}-\x{FE0F}]/u', '', $normalizedText));

        // Buscar en botones
        if ($step->message_type === 'interactive_buttons' && !empty($step->buttons)) {
            foreach ($step->buttons as $button) {
                $title = mb_strtolower(trim($button['title'] ?? ''));
                $cleanTitle = trim(preg_replace('/[\x{1F000}-\x{1FFFF}\x{2600}-\x{27FF}\x{FE00}-\x{FE0F}]/u', '', $title));

                if ($cleanTitle === $cleanText || $title === $normalizedText) {
                    return $button['id'];
                }
            }
        }

        // Buscar en opciones de lista
        if ($step->message_type === 'interactive_list' && !empty($step->options['sections'])) {
            foreach ($step->options['sections'] as $section) {
                foreach ($section['rows'] ?? [] as $row) {
                    $title = mb_strtolower(trim($row['title'] ?? ''));
                    if ($title === $normalizedText || $title === $cleanText) {
                        return $row['id'];
                    }
                }
            }
        }

        return null;
    }

    /**
     * Verificar si WhatsApp está configurado
     */
    public function isConfigured(): bool
    {
        return !empty($this->token) && !empty($this->phoneNumberId);
    }

    /**
     * Procesar mensaje entrante desde webhook
     */
    public function processIncomingMessage(array $messageData, array $contacts = []): ?Message
    {
        try {
            $from = $messageData['from'] ?? null;
            $messageId = $messageData['id'] ?? null;
            $timestamp = $messageData['timestamp'] ?? null;

            if (!$from || !$messageId) {
                Log::warning('Invalid incoming message data', $messageData);
                return null;
            }

            // Verificar si el mensaje ya fue procesado (evitar duplicados)
            $existingMessage = Message::where('whatsapp_message_id', $messageId)->first();
            if ($existingMessage) {
                Log::info('Message already processed, skipping', ['message_id' => $messageId]);
                return $existingMessage;
            }

            // Buscar si hay un appointment asociado (sin enviar respuesta todavía)
            $appointment = $this->findAppointmentForResponse($from, $messageData);

            // Extraer información del contacto
            $contactName = null;
            $profilePictureUrl = null;
            
            foreach ($contacts as $contact) {
                if (isset($contact['wa_id']) && $contact['wa_id'] === $from) {
                    $contactName = $contact['profile']['name'] ?? null;
                    break;
                }
            }

            // Si es respuesta de appointment y tiene conversación asociada, usar esa
            $conversation = null;
            if ($appointment && $appointment->conversation_id) {
                $conversation = Conversation::find($appointment->conversation_id);
                
                if ($conversation) {
                    Log::info('Using appointment conversation', [
                        'conversation_id' => $conversation->id,
                        'appointment_id' => $appointment->id
                    ]);
                }
            }

            // Si no hay conversación del appointment, buscar primero si hay alguna conversación existente
            // asociada a un appointment reciente del mismo número
            if (!$conversation) {
                // Normalizar número de teléfono para búsqueda
                // El $from viene de WhatsApp y puede tener formato "+573001234567" o "573001234567"
                $normalizedFrom = ltrim($from, '+');
                $phoneDigits = substr(preg_replace('/[^0-9]/', '', $normalizedFrom), -10);
                
                // Buscar appointment reciente (últimos 30 días) con conversación asociada
                $recentAppointment = \App\Models\Appointment::where('pactel', 'LIKE', '%' . $phoneDigits . '%')
                    ->whereNotNull('conversation_id')
                    ->where('reminder_sent', true)
                    ->whereDate('citfc', '>=', now()->subDays(30))
                    ->orderBy('citfc', 'desc')
                    ->first();
                
                if ($recentAppointment && $recentAppointment->conversation_id) {
                    $conversation = Conversation::find($recentAppointment->conversation_id);
                    
                    if ($conversation) {
                        Log::info('Using recent appointment conversation', [
                            'conversation_id' => $conversation->id,
                            'appointment_id' => $recentAppointment->id,
                            'phone' => $from,
                            'normalized_phone' => $normalizedFrom,
                            'phone_digits' => $phoneDigits
                        ]);
                    }
                }
            }

            // Si aún no hay conversación, buscar o crear por teléfono
            if (!$conversation) {
                // Normalizar formato del número para que coincida con el formato usado al crear conversaciones
                // Las conversaciones se crean con formato "+573001234567" en AppointmentReminderService
                $normalizedPhone = $from;
                if (!str_starts_with($normalizedPhone, '+')) {
                    // Si no tiene +, agregarlo
                    $normalizedPhone = '+' . ltrim($normalizedPhone, '+');
                }
                
                // Buscar o crear conversación
                $conversationData = [
                    'status' => 'active',
                    'last_message_at' => now(),
                ];

                // Agregar nombre del contacto si existe
                if ($contactName) {
                    $conversationData['contact_name'] = $contactName;
                }

                $conversation = Conversation::firstOrCreate(
                    ['phone_number' => $normalizedPhone],
                    $conversationData
                );

                // Detectar si es una conversación completamente nueva (primer contacto)
                $isNewConversation = $conversation->wasRecentlyCreated;
                
                Log::info('Created or found conversation by phone', [
                    'conversation_id' => $conversation->id,
                    'phone' => $from,
                    'normalized_phone' => $normalizedPhone,
                    'is_new' => $isNewConversation,
                ]);
            }

            // Actualizar nombre si cambió y no estaba vacío antes
            if ($contactName && $conversation->contact_name !== $contactName) {
                $conversation->update(['contact_name' => $contactName]);
            }

            // Si la conversación estaba resuelta, reactivarla cuando llega un mensaje nuevo
            // Quitar asignación para que entre al pool compartido de asesores de turno
            // Y resetear el flujo de bienvenida para recopilar datos nuevamente
            if ($conversation->status === 'resolved') {
                $conversation->update([
                    'status' => 'active',
                    'assigned_to' => null,
                    'last_message_at' => now(),
                    'welcome_flow_completed' => false,
                    'welcome_flow_step' => null,
                    'welcome_flow_data' => null,
                    'notes' => ($conversation->notes ? $conversation->notes . "\n\n" : '') . 
                              'Conversación reactivada automáticamente por mensaje entrante el ' . now()->format('Y-m-d H:i:s')
                ]);
                
                Log::info('Conversation reactivated from resolved (flow reset)', [
                    'conversation_id' => $conversation->id,
                    'phone_number' => $conversation->phone_number,
                ]);
            }

            // Extraer contenido según tipo de mensaje
            $content = '';
            $messageType = 'text';
            $mediaUrl = null;

            if (isset($messageData['text'])) {
                $content = $messageData['text']['body'];
                $messageType = 'text';
            } elseif (isset($messageData['interactive'])) {
                // Mensaje de respuesta interactiva (botones de reply)
                $interactiveType = $messageData['interactive']['type'] ?? '';
                if ($interactiveType === 'button_reply') {
                    $content = $messageData['interactive']['button_reply']['title'] ?? 'Botón presionado';
                    $buttonReplyId = $messageData['interactive']['button_reply']['id'] ?? null;
                } elseif ($interactiveType === 'list_reply') {
                    $content = $messageData['interactive']['list_reply']['title'] ?? 'Opción seleccionada';
                    $buttonReplyId = $messageData['interactive']['list_reply']['id'] ?? null;
                } else {
                    $content = 'Respuesta interactiva';
                }
                $messageType = 'text';
            } elseif (isset($messageData['button'])) {
                // Mensaje de respuesta de botón (legacy / template buttons)
                $content = $messageData['button']['text'] ?? $messageData['button']['payload'] ?? 'Botón presionado';
                $messageType = 'text';
            } elseif (isset($messageData['image'])) {
                $content = $messageData['image']['caption'] ?? 'Imagen';
                $messageType = 'image';
                $mediaId = $messageData['image']['id'] ?? null;
                
                // Descargar la imagen desde WhatsApp
                if ($mediaId) {
                    $mediaUrl = $this->downloadMedia($mediaId);
                }
            } elseif (isset($messageData['video'])) {
                $content = $messageData['video']['caption'] ?? 'Video';
                $messageType = 'video';
                $mediaId = $messageData['video']['id'] ?? null;
                
                // Descargar el video desde WhatsApp
                if ($mediaId) {
                    $mediaUrl = $this->downloadMedia($mediaId);
                }
            } elseif (isset($messageData['document'])) {
                $content = $messageData['document']['filename'] ?? 'Documento';
                $messageType = 'document';
                $mediaId = $messageData['document']['id'] ?? null;
                
                // Descargar el documento desde WhatsApp (preservar nombre original)
                if ($mediaId) {
                    $mediaUrl = $this->downloadMedia($mediaId, $content);
                }
            } elseif (isset($messageData['audio'])) {
                $content = 'Audio';
                $messageType = 'audio';
                $mediaId = $messageData['audio']['id'] ?? null;
                
                // Descargar el audio desde WhatsApp
                if ($mediaId) {
                    $mediaUrl = $this->downloadMedia($mediaId);
                }
            } elseif (isset($messageData['sticker'])) {
                $content = 'Sticker';
                $messageType = 'sticker';
                $mediaId = $messageData['sticker']['id'] ?? null;
                
                // Descargar el sticker desde WhatsApp
                if ($mediaId) {
                    $mediaUrl = $this->downloadMedia($mediaId);
                }
            } elseif (isset($messageData['location'])) {
                $latitude = $messageData['location']['latitude'] ?? '';
                $longitude = $messageData['location']['longitude'] ?? '';
                $name = $messageData['location']['name'] ?? '';
                $address = $messageData['location']['address'] ?? '';
                
                $content = $name ?: 'Ubicación';
                if ($address) {
                    $content .= "\n" . $address;
                }
                $messageType = 'location';
                $mediaUrl = "https://www.google.com/maps?q={$latitude},{$longitude}";
            } elseif (isset($messageData['contacts'])) {
                $contacts = $messageData['contacts'] ?? [];
                $contactNames = array_map(function($contact) {
                    return $contact['name']['formatted_name'] ?? 'Contacto';
                }, $contacts);
                $content = 'Contacto: ' . implode(', ', $contactNames);
                $messageType = 'contact';
            }

            // Crear mensaje
            $message = $conversation->messages()->create([
                'content' => $content,
                'message_type' => $messageType,
                'media_url' => $mediaUrl,
                'is_from_user' => true,
                'whatsapp_message_id' => $messageId,
                'status' => 'delivered',
            ]);

            // Si es audio, intentar transcribir en background
            if ($messageType === 'audio' && $mediaUrl) {
                $this->transcribeAudioMessage($message);
            }

            // Actualizar conversación
            $conversation->update([
                'last_message_at' => now(),
            ]);

            $conversation->incrementUnread();

            // Marcar como leído en WhatsApp
            $this->markAsRead($messageId);

            // Emitir evento de broadcasting para actualización en tiempo real
            broadcast(new MessageSent($message, $conversation->fresh(['lastMessage', 'assignedUser'])));

            Log::info('Incoming message processed', [
                'conversation_id' => $conversation->id,
                'message_id' => $message->id,
            ]);

            // DESPUÉS de guardar el mensaje del usuario, procesar respuesta automática de appointment
            if ($appointment) {
                $this->sendAppointmentAutoResponse($from, $messageData, $appointment, $conversation);
            }

            // --- Flujo de bienvenida ---
            // Refrescar la conversación para tener datos actualizados
            $conversation->refresh();

            // 1. Iniciar el flujo si:
            //    - Es una conversación nueva O
            //    - La conversación nunca ha completado ni empezado el flujo
            $shouldStartFlow = false;
            if (isset($isNewConversation) && $isNewConversation) {
                $shouldStartFlow = true;
            } elseif (!$conversation->welcome_flow_completed && !$conversation->welcome_flow_step) {
                $shouldStartFlow = true;
            }

            if ($shouldStartFlow) {
                Log::info('Starting welcome flow', [
                    'conversation_id' => $conversation->id,
                    'phone' => $from,
                    'is_new' => $isNewConversation ?? false,
                ]);
                $this->sendWelcomeFlow($from, $conversation);
                // No continuar procesando: el mensaje inicial del usuario no es una respuesta al flujo
                return $message;
            }

            // 2. Si la conversación está en medio de un flujo de bienvenida, procesar la interacción
            if (!$conversation->welcome_flow_completed && $conversation->welcome_flow_step) {
                if (isset($buttonReplyId) && $buttonReplyId) {
                    // Respuesta por botón interactivo o lista
                    $this->processWelcomeFlowInteraction($from, $conversation, $buttonReplyId);
                } elseif ($messageType === 'text' && $content) {
                    // Respuesta de texto libre (ej: número de documento)
                    $this->processWelcomeFlowInteraction($from, $conversation, null, $content);
                }
            }

            return $message;

        } catch (\Exception $e) {
            Log::error('Process incoming message exception', [
                'error' => $e->getMessage(),
                'data' => $messageData,
            ]);
            return null;
        }
    }

    /**
     * Busca un appointment asociado a este mensaje (sin enviar respuesta)
     */
    private function findAppointmentForResponse(string $from, array $messageData): ?\App\Models\Appointment
    {
        try {
            // Obtener el contenido del mensaje
            $messageText = $messageData['text']['body'] ?? 
                          $messageData['button']['text'] ?? 
                          $messageData['button']['payload'] ?? 
                          null;

            if (!$messageText) {
                return null;
            }

            // Verificar si el mensaje contiene palabras clave de respuesta
            $messageText = trim($messageText);
            if (!preg_match('/confirmar|confirmo|asistir|asisto|cancelar|cancelo|✅|❌/i', $messageText)) {
                return null;
            }

            // Buscar cita con recordatorio enviado
            $phoneDigits = substr(preg_replace('/[^0-9]/', '', $from), -10);
            
            // Primero, priorizar citas que AÚN NO han sido confirmadas o canceladas
            $appointment = \App\Models\Appointment::where('pactel', 'LIKE', '%' . $phoneDigits . '%')
                ->where('reminder_sent', true)
                ->whereNotIn('reminder_status', ['confirmed', 'cancelled'])
                ->whereDate('citfc', '>=', now())
                ->orderBy('citfc', 'asc')
                ->first();

            // Si no hay ninguna pendiente por responder, buscar la cita más recientemente actualizada
            // (por si el usuario está interactuando nuevamente con una cita que ya respondió)
            if (!$appointment) {
                $appointment = \App\Models\Appointment::where('pactel', 'LIKE', '%' . $phoneDigits . '%')
                    ->where('reminder_sent', true)
                    ->orderBy('updated_at', 'desc')
                    ->first();
            }

            return $appointment;

        } catch (\Exception $e) {
            Log::error('Find appointment exception', [
                'error' => $e->getMessage(),
                'from' => $from,
            ]);
            return null;
        }
    }

    /**
     * Envía y guarda la respuesta automática del appointment
     */
    private function sendAppointmentAutoResponse(string $from, array $messageData, \App\Models\Appointment $appointment, \App\Models\Conversation $conversation): void
    {
        try {
            // Obtener el contenido del mensaje
            $messageText = $messageData['text']['body'] ?? 
                          $messageData['button']['text'] ?? 
                          $messageData['button']['payload'] ?? 
                          null;

            if (!$messageText) {
                return;
            }

            // Normalizar el texto
            $messageText = trim($messageText);

            // Usar transacción con bloqueo pesimista para evitar condiciones de carrera
            // (ej: usuario presiona "Confirmar" y luego "Cancelar" rápidamente)
            \Illuminate\Support\Facades\DB::transaction(function () use ($from, $messageText, $appointment, $conversation) {
                // Recargar el appointment con bloqueo FOR UPDATE para evitar lecturas concurrentes
                $lockedAppointment = \App\Models\Appointment::where('id', $appointment->id)
                    ->lockForUpdate()
                    ->first();

                if (!$lockedAppointment) {
                    Log::warning('Appointment not found during locked read', [
                        'appointment_id' => $appointment->id,
                    ]);
                    return;
                }

                // Verificar si la cita ya fue confirmada o cancelada previamente
                // Esta verificación se hace CON el bloqueo, así que es atómica
                $responseMessage = null;

                // Formatear hora para respuestas
                $horaFormateada = $this->formatHoraForResponse($lockedAppointment->cithor);

                // Verificar si la cita ya fue confirmada o cancelada previamente
                if (in_array($lockedAppointment->reminder_status, ['confirmed', 'cancelled'])) {
                    // Verificamos si ya hemos enviado el mensaje de advertencia previamente
                    if (str_contains($lockedAppointment->notes ?? '', '[Advertencia de estado final enviada]')) {
                        Log::info('Final status warning already sent, ignoring new response', [
                            'appointment_id' => $lockedAppointment->id,
                            'phone' => $from
                        ]);
                        return;
                    }

                    $statusStr = $lockedAppointment->reminder_status === 'confirmed' ? 'CONFIRMADA' : 'CANCELADA';
                    
                    $responseMessage = "⚠️ *Estado: {$statusStr}*\n\nEsta cita ya se encuentra registrada como *{$statusStr}*.\n\nEl sistema ya ha procesado su respuesta anteriormente. Si necesita realizar cambios adicionales, por favor contacte con un asesor.\n\n_HUV - Evaristo García_";

                    // Actualizar las notas para no volver a enviar este mensaje
                    $lockedAppointment->update([
                        'notes' => ($lockedAppointment->notes ?? '') . "\n[" . now()->format('Y-m-d H:i') . "] [Advertencia de estado final enviada]"
                    ]);

                    Log::info('Appointment already has final status, sending info message', [
                        'appointment_id' => $lockedAppointment->id,
                        'current_status' => $lockedAppointment->reminder_status,
                        'phone' => $from,
                        'attempted_action' => $messageText
                    ]);
                }
                // Detectar tipo de respuesta
                elseif (preg_match('/confirmar|confirmo|asistir|asisto|✅/i', $messageText)) {
                    // Confirmación de asistencia
                    $lockedAppointment->update([
                        'reminder_status' => 'confirmed',
                        'notes' => ($lockedAppointment->notes ?? '') . "\n[" . now()->format('Y-m-d H:i') . "] Paciente confirmó asistencia vía WhatsApp"
                    ]);

                    $responseMessage = "✅ *Confirmación recibida*\n\nGracias por confirmar su asistencia a la cita del {$lockedAppointment->citfc->format('d/m/Y')} a las {$horaFormateada}.\n\nLo esperamos en el Hospital Universitario del Valle.\n\n_HUV - Evaristo García_";

                    Log::info('Appointment confirmed by patient', [
                        'appointment_id' => $lockedAppointment->id,
                        'phone' => $from,
                    ]);

                } elseif (preg_match('/cancelar|cancelo|no.*asistir|no.*podré|❌/i', $messageText)) {
                    // Cancelación
                    $lockedAppointment->update([
                        'reminder_status' => 'cancelled',
                        'notes' => ($lockedAppointment->notes ?? '') . "\n[" . now()->format('Y-m-d H:i') . "] Paciente canceló vía WhatsApp"
                    ]);

                    $responseMessage = "❌ *Cancelación registrada*\n\nHemos registrado que no podrá asistir a su cita del {$lockedAppointment->citfc->format('d/m/Y')} a las {$horaFormateada}.\n\nPara programar tu nueva cita, recuerda nuestros canales:\n\n🌐 *Página web de citas:*\nhttps://citas.huv.gov.co/login\n\n📞 *Teléfono:* 6206275\n\nPara cancelación de la cita me regala su información:\n📄 Documento de identidad del paciente\n📝 Motivo de cancelación\n👤 Nombre completo de quien cancela la cita\n👥 Parentesco\n\n_HUV - Evaristo García_";

                    Log::info('Appointment cancelled by patient', [
                        'appointment_id' => $lockedAppointment->id,
                        'phone' => $from,
                    ]);

                } else {
                    // Respuesta no reconocida
                    return;
                }

                // Enviar respuesta automática y guardar en BD
                if ($responseMessage) {
                    // Enviar mensaje a WhatsApp
                    $result = $this->sendTextMessage($from, $responseMessage);
                    
                    Log::info('Send automatic response result', [
                        'success' => $result['success'] ?? false,
                        'message_id' => $result['message_id'] ?? null,
                        'error' => $result['error'] ?? null
                    ]);
                    
                    // Guardar mensaje en la conversación
                    if (($result['success'] ?? false) && isset($result['message_id'])) {
                        $messageId = $result['message_id'];
                        
                        \App\Models\Message::create([
                            'conversation_id' => $conversation->id,
                            'content' => $responseMessage,
                            'message_type' => 'text',
                            'is_from_user' => false,
                            'whatsapp_message_id' => $messageId,
                            'status' => 'sent',
                            'sent_by' => null // Sistema automático
                        ]);
                        
                        Log::info('Automatic response saved to database', [
                            'conversation_id' => $conversation->id,
                            'message_id' => $messageId,
                            'appointment_id' => $lockedAppointment->id
                        ]);
                    } else {
                        Log::error('Failed to save automatic response', [
                            'result' => $result,
                            'from' => $from
                        ]);
                    }
                }
            });

        } catch (\Exception $e) {
            Log::error('Send appointment auto response exception', [
                'error' => $e->getMessage(),
                'from' => $from,
            ]);
        }
    }
    
    /**
     * Formatea la hora de 24h a 12h con AM/PM para respuestas
     */
    private function formatHoraForResponse($cithor): string
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
            return (string)$cithor;
        }
        
        return 'No especificada';
    }

    /**
     * Transcribir mensaje de audio usando Groq Whisper
     */
    private function transcribeAudioMessage(Message $message): void
    {
        try {
            $transcriptionService = new TranscriptionService();
            
            if (!$transcriptionService->isConfigured()) {
                Log::info('TranscriptionService not configured, skipping audio transcription');
                return;
            }

            $audioPath = $message->media_url;
            if (!$audioPath) {
                return;
            }

            $transcription = $transcriptionService->transcribe($audioPath);
            
            if ($transcription) {
                $message->update(['transcription' => $transcription]);
                
                Log::info('Audio transcribed successfully', [
                    'message_id' => $message->id,
                    'transcription_length' => strlen($transcription),
                ]);

                // Re-emitir evento para actualizar la UI con la transcripción
                $conversation = $message->conversation->fresh(['lastMessage', 'assignedUser']);
                broadcast(new \App\Events\MessageSent($message->fresh(), $conversation));
            }
        } catch (\Exception $e) {
            Log::error('Audio transcription failed', [
                'message_id' => $message->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
