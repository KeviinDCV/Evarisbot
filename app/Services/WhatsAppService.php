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
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return [
                'success' => false,
                'error' => $response->json()['error']['message'] ?? 'Error desconocido',
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
                
                Log::info('Created or found conversation by phone', [
                    'conversation_id' => $conversation->id,
                    'phone' => $from,
                    'normalized_phone' => $normalizedPhone
                ]);
            }

            // Actualizar nombre si cambió y no estaba vacío antes
            if ($contactName && $conversation->contact_name !== $contactName) {
                $conversation->update(['contact_name' => $contactName]);
            }

            // Si la conversación estaba resuelta, reactivarla cuando llega un mensaje nuevo
            // Quitar asignación para que entre al pool compartido de asesores de turno
            if ($conversation->status === 'resolved') {
                $conversation->update([
                    'status' => 'active',
                    'assigned_to' => null,
                    'last_message_at' => now(),
                    'notes' => ($conversation->notes ? $conversation->notes . "\n\n" : '') . 
                              'Conversación reactivada automáticamente por mensaje entrante el ' . now()->format('Y-m-d H:i:s')
                ]);
                
                Log::info('Conversation reactivated from resolved', [
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
            } elseif (isset($messageData['button'])) {
                // Mensaje de respuesta de botón
                $content = $messageData['button']['text'] ?? $messageData['button']['payload'] ?? 'Botón presionado';
                $messageType = 'text'; // Los botones se tratan como texto
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
            
            $appointment = \App\Models\Appointment::where('pactel', 'LIKE', '%' . $phoneDigits . '%')
                ->where('reminder_sent', true)
                ->whereDate('citfc', '>=', now())
                ->orderBy('citfc', 'asc')
                ->first();

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
                if (in_array($lockedAppointment->reminder_status, ['confirmed', 'cancelled'])) {
                    Log::info('Appointment already has final status, ignoring new response', [
                        'appointment_id' => $lockedAppointment->id,
                        'current_status' => $lockedAppointment->reminder_status,
                        'phone' => $from,
                        'attempted_action' => $messageText
                    ]);
                    // No enviar respuesta automática, ya respondió previamente
                    return;
                }

                $responseMessage = null;

                // Formatear hora para respuestas
                $horaFormateada = $this->formatHoraForResponse($lockedAppointment->cithor);

                // Detectar tipo de respuesta
                if (preg_match('/confirmar|confirmo|asistir|asisto|✅/i', $messageText)) {
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

                    $responseMessage = "❌ *Cancelación registrada*\n\nHemos registrado que no podrá asistir a su cita del {$lockedAppointment->citfc->format('d/m/Y')} a las {$horaFormateada}.\n\nPara programar tu nueva cita, recuerda nuestros canales:\n\n🌐 *Página web de citas:*\nhttps://citas.huv.gov.co/login\n\n📞 *Teléfono:* 6206275\n\n_HUV - Evaristo García_";

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
