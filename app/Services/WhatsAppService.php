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
    private string $apiUrl = 'https://graph.facebook.com/v18.0';
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
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return [
                'success' => false,
                'error' => $response->json()['error']['message'] ?? 'Error desconocido',
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

            $response = Http::withToken($this->token)
                ->post("{$this->apiUrl}/{$this->phoneNumberId}/messages", $payload);

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
    public function downloadMedia(string $mediaId): ?string
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

            // Paso 3: Guardar archivo en storage
            $mimeType = $fileResponse->header('Content-Type');
            $extension = explode('/', $mimeType)[1] ?? 'jpg';
            $filename = 'whatsapp_media/' . uniqid() . '.' . $extension;
            
            \Storage::disk('public')->put($filename, $fileResponse->body());

            // Usar ruta relativa para compatibilidad con IP local y ngrok
            $localUrl = '/storage/' . $filename;
            
            Log::info('Media downloaded successfully', [
                'media_id' => $mediaId,
                'local_url' => $localUrl,
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

            // Extraer información del contacto
            $contactName = null;
            $profilePictureUrl = null;
            
            foreach ($contacts as $contact) {
                if (isset($contact['wa_id']) && $contact['wa_id'] === $from) {
                    $contactName = $contact['profile']['name'] ?? null;
                    break;
                }
            }

            // Buscar o crear conversación
            $conversationData = [
                'status' => 'in_progress',
                'last_message_at' => now(),
            ];

            // Agregar nombre del contacto si existe
            if ($contactName) {
                $conversationData['contact_name'] = $contactName;
            }

            $conversation = Conversation::firstOrCreate(
                ['phone_number' => '+' . $from],
                $conversationData
            );

            // Actualizar nombre si cambió y no estaba vacío antes
            if ($contactName && $conversation->contact_name !== $contactName) {
                $conversation->update(['contact_name' => $contactName]);
            }

            // Si la conversación estaba cerrada/resuelta, reactivarla cuando llega un mensaje nuevo
            if (in_array($conversation->status, ['resolved', 'closed'])) {
                $conversation->update([
                    'status' => 'in_progress',
                    'last_message_at' => now(),
                    'notes' => ($conversation->notes ? $conversation->notes . "\n\n" : '') . 
                              'Conversación reactivada automáticamente por mensaje entrante el ' . now()->format('Y-m-d H:i:s')
                ]);
                
                Log::info('Conversation reactivated from closed/resolved', [
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
                
                // Descargar el documento desde WhatsApp
                if ($mediaId) {
                    $mediaUrl = $this->downloadMedia($mediaId);
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

            return $message;

        } catch (\Exception $e) {
            Log::error('Process incoming message exception', [
                'error' => $e->getMessage(),
                'data' => $messageData,
            ]);
            return null;
        }
    }
}
