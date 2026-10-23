<?php

namespace App\Services;

use App\Events\MessageReactionUpdated;
use App\Events\MessageSent;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageReaction;
use App\Models\Setting;
use Illuminate\Support\Facades\DB;
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
     * Cliente HTTP preconfigurado con timeout y reintentos automáticos
     * para manejar errores de red transitorios (cURL 28 timeout, cURL 56 reset, etc.)
     */
    private function httpClient()
    {
        return Http::withToken($this->token)
            ->timeout(10)
            ->connectTimeout(5)
            ->retry(2, 500, function ($exception) {
                // Solo reintentar en errores de conexión (timeouts, resets, DNS).
                // NO reintentar errores de Meta (400/403/rate limit) — esos requieren intervención.
                return $exception instanceof \Illuminate\Http\Client\ConnectionException;
            }, throw: false);
    }

    /**
     * Sube un archivo multimedia LOCAL directamente a Meta y devuelve su media_id.
     *
     * Esto reemplaza el envío por "link": antes le pasábamos a Meta la URL pública
     * (túnel de Tailscale) y Meta venía a descargar el archivo, lo que fallaba de forma
     * intermitente con el error 131053 "Media upload error / Downloading media from
     * weblink failed (DNS resolution timed out / DNS query shed)". Subiendo los bytes
     * nosotros, Meta ya no depende de poder resolver/alcanzar nuestro túnel.
     *
     * Devuelve null si no puede subir (archivo externo o fallo) → el método que llama
     * hace fallback a enviar por 'link', así nunca se rompe el envío.
     */
    public function uploadMedia(string $mediaUrl): ?string
    {
        try {
            // Resolver la ruta local desde la URL pública (.../storage/whatsapp_media/xxx.png)
            $pos = strpos($mediaUrl, '/storage/');
            if ($pos === false) {
                return null; // No es un archivo servido por nosotros
            }
            $relative = explode('?', substr($mediaUrl, $pos + strlen('/storage/')))[0];

            $disk = \Illuminate\Support\Facades\Storage::disk('public');
            if (!$disk->exists($relative)) {
                return null;
            }

            $mime = $disk->mimeType($relative) ?: 'application/octet-stream';

            $response = Http::withToken($this->token)
                ->timeout(60)
                ->connectTimeout(10)
                ->attach('file', $disk->get($relative), basename($relative), ['Content-Type' => $mime])
                ->post("{$this->apiUrl}/{$this->phoneNumberId}/media", [
                    'messaging_product' => 'whatsapp',
                    'type' => $mime,
                ]);

            $mediaId = $response->json()['id'] ?? null;
            if ($response->successful() && $mediaId) {
                Log::info('Media subida directamente a Meta', ['media_id' => $mediaId, 'file' => basename($relative)]);
                return $mediaId;
            }

            Log::warning('No se pudo subir media a Meta; se usará enlace como respaldo', [
                'status' => $response->status(),
                'body' => $response->json(),
                'file' => basename($relative),
            ]);
            return null;
        } catch (\Throwable $e) {
            Log::warning('Excepción subiendo media a Meta; se usará enlace', ['error' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Enviar mensaje de texto
     */
    public function sendTextMessage(string $to, string $message, ?string $replyToWamid = null): array
    {
        if (!$this->isConfigured()) {
            return [
                'success' => false,
                'error' => 'WhatsApp API no está configurada',
            ];
        }

        try {
            $payload = [
                'messaging_product' => 'whatsapp',
                'to' => $this->formatPhoneNumber($to),
                'type' => 'text',
                'text' => [
                    'body' => $message,
                ],
            ];

            if ($replyToWamid) {
                $payload['context'] = ['message_id' => $replyToWamid];
            }

            $response = $this->httpClient()
                ->post("{$this->apiUrl}/{$this->phoneNumberId}/messages", $payload);

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
     * Enviar una reacción (emoji) a un mensaje existente.
     * Un emoji vacío ('') elimina la reacción previa, igual que en WhatsApp.
     */
    public function sendReaction(string $to, string $targetWamid, string $emoji): array
    {
        if (!$this->isConfigured()) {
            return ['success' => false, 'error' => 'WhatsApp API no está configurada'];
        }

        try {
            $payload = [
                'messaging_product' => 'whatsapp',
                'to' => $this->formatPhoneNumber($to),
                'type' => 'reaction',
                'reaction' => [
                    'message_id' => $targetWamid,
                    'emoji' => $emoji, // '' = quitar reacción
                ],
            ];

            $response = $this->httpClient()
                ->post("{$this->apiUrl}/{$this->phoneNumberId}/messages", $payload);

            if ($response->successful()) {
                $data = $response->json();
                return [
                    'success' => true,
                    'message_id' => $data['messages'][0]['id'] ?? null,
                    'data' => $data,
                ];
            }

            $errorJson = $response->json();
            $errorMsg = $errorJson['error']['message'] ?? 'Error desconocido';
            Log::error('WhatsApp reaction error', [
                'to' => $to,
                'target' => $targetWamid,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return ['success' => false, 'error' => $errorMsg];
        } catch (\Exception $e) {
            Log::error('WhatsApp send reaction exception', [
                'error' => $e->getMessage(),
                'to' => $to,
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Bloquea un número en WhatsApp vía el Block Users API de Meta.
     * El bloqueo es REAL: Meta deja de entregarnos los mensajes de ese usuario
     * y cuenta del lado de Meta. Requisito de Meta: el usuario debe haber escrito
     * en las últimas 24h; si no, Meta lo rechaza (lo reportamos en 'error').
     */
    public function blockUser(string $phone): array
    {
        return $this->toggleBlockUser($phone, true);
    }

    /**
     * Desbloquea un número previamente bloqueado en WhatsApp (DELETE block_users).
     */
    public function unblockUser(string $phone): array
    {
        return $this->toggleBlockUser($phone, false);
    }

    /**
     * Lógica compartida block/unblock contra POST|DELETE /{phone-number-id}/block_users.
     * Meta responde 200 aunque algún número falle: hay que revisar 'failed_users'.
     */
    private function toggleBlockUser(string $phone, bool $block): array
    {
        if (!$this->isConfigured()) {
            return ['success' => false, 'error' => 'WhatsApp API no está configurada'];
        }

        $user = $this->formatPhoneNumber($phone);
        $payload = [
            'messaging_product' => 'whatsapp',
            'block_users' => [['user' => $user]],
        ];
        $url = "{$this->apiUrl}/{$this->phoneNumberId}/block_users";

        try {
            $response = $block
                ? $this->httpClient()->post($url, $payload)
                : $this->httpClient()->delete($url, $payload);

            $data = $response->json();

            if ($response->successful()) {
                // Meta puede devolver 200 con números que fallaron individualmente.
                $failed = $data['block_users']['failed_users'] ?? [];
                if (!empty($failed)) {
                    $errObj = $failed[0]['errors'][0] ?? [];
                    $err = $errObj['error_data']['details']
                        ?? $errObj['message']
                        ?? 'Meta rechazó la operación (posible causa: el usuario no ha escrito en las últimas 24h).';
                    Log::warning('WhatsApp block_users falló para el número', [
                        'phone' => $user,
                        'block' => $block,
                        'failed' => $failed,
                    ]);
                    return ['success' => false, 'error' => $err, 'data' => $data];
                }

                Log::info('WhatsApp block_users OK', ['phone' => $user, 'block' => $block]);
                return ['success' => true, 'data' => $data];
            }

            $errorMsg = $data['error']['message'] ?? 'Error desconocido';
            $errorCode = $data['error']['code'] ?? null;
            if ($errorCode) {
                $errorMsg .= " (code: {$errorCode})";
            }
            Log::error('WhatsApp block_users error', [
                'phone' => $user,
                'block' => $block,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            return ['success' => false, 'error' => $errorMsg, 'data' => $data];

        } catch (\Exception $e) {
            Log::error('WhatsApp block_users exception', [
                'error' => $e->getMessage(),
                'phone' => $user,
                'block' => $block,
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Enviar mensaje con imagen
     */
    public function sendImageMessage(string $to, string $imageUrl, ?string $caption = null, ?string $replyToWamid = null): array
    {
        if (!$this->isConfigured()) {
            return ['success' => false, 'error' => 'WhatsApp API no está configurada'];
        }

        try {
            // Subir el archivo a Meta y enviar por media_id (más confiable que el enlace).
            $mediaId = $this->uploadMedia($imageUrl);
            $image = $mediaId ? ['id' => $mediaId] : ['link' => $imageUrl];
            if ($caption) {
                $image['caption'] = $caption;
            }

            $payload = [
                'messaging_product' => 'whatsapp',
                'to' => $this->formatPhoneNumber($to),
                'type' => 'image',
                'image' => $image,
            ];

            if ($replyToWamid) {
                $payload['context'] = ['message_id' => $replyToWamid];
            }

            Log::info('Sending image to WhatsApp', [
                'to' => $to,
                'url' => $imageUrl,
                'caption' => $caption,
                'payload' => $payload,
            ]);

            $response = $this->httpClient()
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
    public function sendDocumentMessage(string $to, string $documentUrl, string $filename, ?string $caption = null, ?string $replyToWamid = null): array
    {
        if (!$this->isConfigured()) {
            return ['success' => false, 'error' => 'WhatsApp API no está configurada'];
        }

        try {
            $mediaId = $this->uploadMedia($documentUrl);
            $document = $mediaId ? ['id' => $mediaId, 'filename' => $filename] : ['link' => $documentUrl, 'filename' => $filename];
            // Agregar caption si existe
            if ($caption) {
                $document['caption'] = $caption;
            }

            $payload = [
                'messaging_product' => 'whatsapp',
                'to' => $this->formatPhoneNumber($to),
                'type' => 'document',
                'document' => $document,
            ];

            if ($replyToWamid) {
                $payload['context'] = ['message_id' => $replyToWamid];
            }

            $response = $this->httpClient()
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
    public function sendVideoMessage(string $to, string $videoUrl, ?string $caption = null, ?string $replyToWamid = null): array
    {
        if (!$this->isConfigured()) {
            return ['success' => false, 'error' => 'WhatsApp API no está configurada'];
        }

        try {
            $mediaId = $this->uploadMedia($videoUrl);
            $video = $mediaId ? ['id' => $mediaId] : ['link' => $videoUrl];
            if ($caption) {
                $video['caption'] = $caption;
            }

            $payload = [
                'messaging_product' => 'whatsapp',
                'to' => $this->formatPhoneNumber($to),
                'type' => 'video',
                'video' => $video,
            ];

            if ($replyToWamid) {
                $payload['context'] = ['message_id' => $replyToWamid];
            }

            $response = $this->httpClient()
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
    public function sendAudioMessage(string $to, string $audioUrl, ?string $replyToWamid = null): array
    {
        if (!$this->isConfigured()) {
            return ['success' => false, 'error' => 'WhatsApp API no está configurada'];
        }

        try {
            $mediaId = $this->uploadMedia($audioUrl);
            $payload = [
                'messaging_product' => 'whatsapp',
                'to' => $this->formatPhoneNumber($to),
                'type' => 'audio',
                'audio' => $mediaId ? ['id' => $mediaId] : ['link' => $audioUrl],
            ];

            if ($replyToWamid) {
                $payload['context'] = ['message_id' => $replyToWamid];
            }

            $response = $this->httpClient()
                ->post("{$this->apiUrl}/{$this->phoneNumberId}/messages", $payload);

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
     * Mostrarle al paciente el "escribiendo…" de WhatsApp.
     *
     * En la Cloud API el indicador NO es una llamada aparte: viaja junto al acuse de
     * lectura, en la misma petición. Se muestra unos 25 segundos, o hasta que se envía
     * el mensaje (lo que ocurra antes), y necesita el id de un mensaje ENTRANTE.
     *
     * Es cosmético: si Meta lo rechaza (por ejemplo, con la ventana de 24 h cerrada),
     * no se registra como error ni se reintenta.
     */
    public function sendTypingIndicator(string $messageId): bool
    {
        if (!$this->isConfigured()) {
            return false;
        }

        try {
            $response = \Illuminate\Support\Facades\Http::withToken($this->token)
                ->timeout(4)
                ->connectTimeout(2)
                ->post("{$this->apiUrl}/{$this->phoneNumberId}/messages", [
                    'messaging_product' => 'whatsapp',
                    'status' => 'read',
                    'message_id' => $messageId,
                    'typing_indicator' => ['type' => 'text'],
                ]);

            if (!$response->successful()) {
                Log::info('Indicador de escritura no aceptado por Meta', [
                    'status' => $response->status(),
                    'body' => mb_substr($response->body(), 0, 200),
                ]);
            }

            return $response->successful();
        } catch (\Exception $e) {
            Log::info('Indicador de escritura: excepción', ['error' => $e->getMessage()]);
            return false;
        }
    }

    /**
     * Marcar un mensaje como leído en WhatsApp (el doble check azul del paciente).
     *
     * Marcar uno marca también todos los anteriores de esa conversación, así que basta
     * con enviar el ÚLTIMO entrante sin leer.
     *
     * Va con su propio cliente HTTP, más impaciente que el general: esto se ejecuta al
     * abrir un chat, y el cliente normal (timeout 10 s con 2 reintentos) podría dejar la
     * pantalla colgada hasta 30 s. Es un acuse de recibo: si no llega, no pasa nada.
     */
    public function markAsRead(string $messageId): bool
    {
        if (!$this->isConfigured()) {
            return false;
        }

        try {
            $response = \Illuminate\Support\Facades\Http::withToken($this->token)
                ->timeout(4)
                ->connectTimeout(2)
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
        'image/heic' => 'heic',
        'image/heif' => 'heic',
        // Audio
        'audio/ogg' => 'ogg',
        'audio/mpeg' => 'mp3',
        'audio/mp4' => 'm4a',
        'audio/amr' => 'amr',
        'audio/aac' => 'aac',
        // Video
        'video/mp4' => 'mp4',
        'video/3gpp' => '3gp',
        'video/quicktime' => 'mov',
        // Texto
        'text/plain' => 'txt',
        'text/csv' => 'csv',
        // Comprimidos
        'application/zip' => 'zip',
        'application/x-rar-compressed' => 'rar',
        'application/vnd.rar' => 'rar',
        'application/x-7z-compressed' => '7z',
    ];

    /**
     * Extensiones con las que se puede guardar un adjunto en la carpeta pública.
     * La extensión la elige quien envía el archivo: sin esta lista, un documento "algo.php"
     * o "algo.html" quedaba en /storage con esa extensión y Apache lo ejecutaba o lo abría
     * como página al hacer clic. Lo que no esté aquí se guarda como .bin (se descarga, nunca se abre).
     */
    private const SAFE_EXTENSIONS = [
        'pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp', 'tif', 'tiff',
        'ogg', 'opus', 'mp3', 'm4a', 'amr', 'aac', 'wav', 'mp4', '3gp', 'mov',
        'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf',
        'txt', 'csv', 'zip', 'rar', '7z',
    ];

    /**
     * Hosts desde los que Meta entrega los archivos. La descarga lleva el token en la cabecera,
     * así que nunca se pide a otro sitio: un webhook falso podía apuntar el media_id a un objeto
     * de Graph cuyo campo "url" fuera un servidor ajeno y llevarse el token.
     */
    private const MEDIA_HOST_SUFFIXES = ['.fbsbx.com', '.facebook.com', '.fbcdn.net', '.whatsapp.net', '.whatsapp.com'];

    /**
     * Obtener extensión a partir del MIME type (solo extensiones de SAFE_EXTENSIONS; si no, 'bin')
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

        // Fallback: usar la parte después del / si es una extensión permitida (ej: image/bmp → bmp)
        $parts = explode('/', $cleanMime);
        $sub = $parts[1] ?? 'bin';

        return in_array($sub, self::SAFE_EXTENSIONS, true) ? $sub : 'bin';
    }

    /**
     * Extensión segura para guardar el adjunto: manda el tipo que informa Meta; la extensión del
     * nombre original solo se usa si Meta no dice nada útil y está en la lista permitida.
     */
    private function safeExtension(?string $mimeType, ?string $originalFilename): string
    {
        $fromMime = $this->getExtensionFromMime($mimeType);
        if ($fromMime !== 'bin') {
            return $fromMime;
        }

        $fromName = strtolower((string) pathinfo((string) $originalFilename, PATHINFO_EXTENSION));

        return in_array($fromName, self::SAFE_EXTENSIONS, true) ? $fromName : 'bin';
    }

    private function isMetaMediaUrl(string $url): bool
    {
        $parts = parse_url($url);
        $host = strtolower($parts['host'] ?? '');

        if (($parts['scheme'] ?? '') !== 'https' || $host === '') {
            return false;
        }

        foreach (self::MEDIA_HOST_SUFFIXES as $suffix) {
            if (str_ends_with('.' . $host, $suffix)) {
                return true;
            }
        }

        return false;
    }

    public function downloadMedia(string $mediaId, ?string $originalFilename = null): ?string
    {
        try {
            // El media_id viene en el webhook: solo dígitos, para que no se pueda usar como
            // ruta arbitraria de Graph (la petición lleva el token del hospital).
            if (!preg_match('/^\d{1,40}$/', $mediaId)) {
                Log::warning('Media ID inválido en webhook, no se descarga', ['length' => strlen($mediaId)]);
                return null;
            }

            // Paso 1: Obtener URL del media
            $response = $this->httpClient()
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

            if (!is_string($mediaUrl) || $mediaUrl === '') {
                Log::error('Media URL not found in response', ['media_id' => $mediaId]);
                return null;
            }

            if (!$this->isMetaMediaUrl($mediaUrl)) {
                Log::critical('Media URL fuera de Meta: no se descarga (posible webhook falso)', [
                    'media_id' => $mediaId,
                    'host' => parse_url($mediaUrl, PHP_URL_HOST),
                ]);
                return null;
            }

            // Paso 2: Descargar el archivo
            $fileResponse = $this->httpClient()
                ->timeout(30)
                ->get($mediaUrl);

            if (!$fileResponse->successful()) {
                Log::error('Failed to download media file', ['media_id' => $mediaId, 'status' => $fileResponse->status()]);
                return null;
            }

            // Paso 3: Determinar extensión segura
            $mimeType = $apiMimeType ?? $fileResponse->header('Content-Type');
            $extension = $this->safeExtension($mimeType, $originalFilename);

            // Paso 4: Generar nombre de archivo preservando el nombre original si es posible.
            // Prefijo aleatorio (no uniqid, que sale de la hora y se puede adivinar).
            $prefix = \Illuminate\Support\Str::random(24);
            if ($originalFilename) {
                // Sanitizar nombre: quitar caracteres especiales (también los puntos), mantener legible
                $safeName = preg_replace('/[^a-zA-Z0-9_\-]/', '_', pathinfo($originalFilename, PATHINFO_FILENAME));
                $safeName = substr($safeName, 0, 100); // limitar longitud
                $storageName = 'whatsapp_media/' . $prefix . '_' . $safeName . '.' . $extension;
            } else {
                $storageName = 'whatsapp_media/' . $prefix . '.' . $extension;
            }

            \Storage::disk('public')->put($storageName, $fileResponse->body());

            // Usar ruta relativa para compatibilidad con IP local y ngrok
            $localUrl = '/storage/' . $storageName;

            // Sin nombre original ni ruta: suelen llevar el nombre del paciente.
            Log::info('Media downloaded successfully', [
                'media_id' => $mediaId,
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
     * Enviar plantilla genérica de WhatsApp
     */
    public function sendTemplate(string $to, string $templateName, string $language, array $components = []): array
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
                    'name' => $templateName,
                    'language' => ['code' => $language],
                ],
            ];

            if (!empty($components)) {
                $payload['template']['components'] = $components;
            }

            Log::info('Enviando plantilla', [
                'to' => $to,
                'template' => $templateName,
                'language' => $language,
            ]);

            $response = $this->httpClient()
                ->post("{$this->apiUrl}/{$this->phoneNumberId}/messages", $payload);

            if ($response->successful()) {
                $data = $response->json();
                return [
                    'success' => true,
                    'message_id' => $data['messages'][0]['id'] ?? null,
                    'data' => $data,
                ];
            }

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

            Log::error('Error enviando plantilla', [
                'to' => $to,
                'template' => $templateName,
                'status' => $response->status(),
                'error' => $fullError,
                'response_body' => $response->body(),
            ]);

            return ['success' => false, 'error' => $fullError];
        } catch (\Exception $e) {
            Log::error('Excepción enviando plantilla', [
                'error' => $e->getMessage(),
                'to' => $to,
                'template' => $templateName,
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Nombre de la plantilla de saludo que hay que usar ahora mismo.
     *
     * Está en la BD y no fija en el código para poder conmutar a saludo_asesor_v2
     * en cuanto Meta la apruebe, sin desplegar nada. Si la consulta falla o no hay
     * ninguna activa y aprobada, cae a la de siempre: antes dejar al asesor con el
     * saludo antiguo que dejarlo sin saludo.
     */
    private function activeGreetingTemplateName(): string
    {
        try {
            return DB::table('whatsapp_templates')
                ->where('meta_template_name', 'like', 'saludo_asesor%')
                ->where('is_active', 1)
                ->where('status', 'APPROVED')
                ->orderByDesc('id')
                ->value('meta_template_name') ?: 'saludo_asesor';
        } catch (\Throwable $e) {
            Log::warning('No se pudo resolver la plantilla de saludo, se usa saludo_asesor', ['error' => $e->getMessage()]);

            return 'saludo_asesor';
        }
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
                    'name' => $this->activeGreetingTemplateName(),
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

            $response = $this->httpClient()
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

            $response = $this->httpClient()
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

            $response = $this->httpClient()
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

                // Auto-encadenar: si es un paso tipo 'text' (informativo) con next_step_on_text,
                // enviar el siguiente paso inmediatamente (ej: agendamiento_info → agendamiento_submenu)
                if ($step->message_type === 'text' && $step->next_step_on_text && !in_array($step->next_step_on_text, ['__complete__', '__complete_assign_advisor__', '__reset__'])) {
                    $welcomeFlow = \App\Models\WelcomeFlow::getActive();
                    if ($welcomeFlow) {
                        $autoNextStep = $welcomeFlow->getStepByKey($step->next_step_on_text);
                        if ($autoNextStep) {
                            Log::info('Welcome flow: auto-chaining text step to next', [
                                'from' => $step->step_key,
                                'to' => $step->next_step_on_text,
                            ]);
                            // Pequeña pausa para que el mensaje anterior llegue primero
                            usleep(500000); // 500ms
                            return $this->sendFlowStep($autoNextStep, $phoneNumber, $conversation);
                        }
                    }
                }

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
                \App\Services\FlowClassificationService::sync($conversation);

                Log::info('Welcome flow button pressed', [
                    'conversation_id' => $conversation->id,
                    'step' => $currentStepKey,
                    'button_id' => $buttonId,
                    'next_step' => $nextStepKey,
                ]);

            } elseif ($userText && in_array($currentStep->message_type, ['wait_response', 'text'])) {
                $nextStepKey = $currentStep->next_step_on_text;

                // Guardar la respuesta de texto del usuario
                $flowData = $conversation->welcome_flow_data ?? [];
                $flowData[$currentStepKey] = [
                    'text' => $userText,
                    'timestamp' => now()->toISOString(),
                ];
                $conversation->update(['welcome_flow_data' => $flowData]);
                \App\Services\FlowClassificationService::sync($conversation);

                Log::info('Welcome flow text response', [
                    'conversation_id' => $conversation->id,
                    'step' => $currentStepKey,
                    'text' => mb_substr($userText, 0, 50),
                    'next_step' => $nextStepKey,
                ]);
            } else {
                // Si el paso actual espera botones/lista pero recibimos texto sin match, enviar fallback y re-enviar el paso
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
                    // Re-enviar el paso interactivo para que el usuario vea las opciones
                    usleep(300000); // 300ms para que llegue en orden
                    $this->sendFlowStep($currentStep, $phoneNumber, $conversation);
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

                    // Enviar mensaje según el contexto del paso actual
                    if ($currentStepKey === 'cancelacion_info') {
                        // Cancelación: el usuario envió datos, asignar a asesor
                        $this->sendTextMessage($phoneNumber, '📋 Hemos recibido su solicitud de cancelación. Un asesor revisará su caso y le confirmará a la brevedad.');

                        // Asignar a asesor de turno
                        $onDutyAdvisors = \App\Models\User::where('role', 'advisor')
                            ->where('is_on_duty', true)
                            ->get();

                        if ($onDutyAdvisors->isNotEmpty()) {
                            $advisor = $onDutyAdvisors->random();
                            $conversation->update([
                                'assigned_to' => $advisor->id,
                                'status' => 'active',
                                'last_message_at' => now(),
                            ]);
                        }
                    } elseif ($currentStepKey === 'informacion_menu') {
                        // Opciones de información: funcionalidad en desarrollo
                        $this->sendTextMessage($phoneNumber, 'ℹ️ Esta funcionalidad se encuentra en desarrollo. Por ahora, un asesor le atenderá para resolver su consulta.');

                        // Asignar a asesor de turno para que lo atiendan
                        $onDutyAdvisors = \App\Models\User::where('role', 'advisor')
                            ->where('is_on_duty', true)
                            ->get();

                        if ($onDutyAdvisors->isNotEmpty()) {
                            $advisor = $onDutyAdvisors->random();
                            $conversation->update([
                                'assigned_to' => $advisor->id,
                                'status' => 'active',
                                'last_message_at' => now(),
                            ]);
                        }
                    }

                    Log::info('Welcome flow completed', [
                        'conversation_id' => $conversation->id,
                        'from_step' => $currentStepKey,
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
                        ->get();

                    if ($onDutyAdvisors->isNotEmpty()) {
                        // Asignar aleatoriamente a un asesor de turno
                        $advisor = $onDutyAdvisors->random();
                        $conversation->update([
                            'assigned_to' => $advisor->id,
                            'status' => 'active',
                        ]);

                        Log::info('Welcome flow: assigned to on-duty advisor', [
                            'conversation_id' => $conversation->id,
                            'advisor_id' => $advisor->id,
                            'advisor_name' => $advisor->name,
                        ]);

                        // Enviar mensaje de "conectando con asesor"
                        $this->sendTextMessage($phoneNumber, '✅ Enseguida le contactamos con un asesor. Por favor espere un momento.');

                        // Enviar la plantilla de saludo automáticamente (como /saludo)
                        $advisorName = explode(' ', trim($advisor->name))[0];
                        $greetingText = "Buen día.\n" .
                            "Le saludamos de Hospital Universitario del Valle.\n" .
                            "A partir de este momento será atendido(a) por {$advisorName}, quien estará a cargo de la asignación y seguimiento de su cita.\n" .
                            "Quedamos atentos a cualquier consulta adicional.";

                        // Guardar el mensaje de saludo en la BD
                        $greetingMessage = $conversation->messages()->create([
                            'content' => $greetingText,
                            'message_type' => 'text',
                            'is_from_user' => false,
                            'sent_by' => $advisor->id,
                            'status' => 'pending',
                        ]);

                        // Enviar saludo por WhatsApp: como el paciente acaba de completar
                        // el flujo, la ventana de 24h está abierta y se envía como mensaje
                        // de sesión libre (evita el tope de marketing / error 131049). Se
                        // deja la plantilla como respaldo por si la ventana estuviera cerrada.
                        if ($this->isConfigured()) {
                            $result = $conversation->isWithinServiceWindow()
                                ? $this->sendTextMessage($phoneNumber, $greetingText)
                                : $this->sendGreetingTemplate($phoneNumber, $advisorName);
                            $greetingMessage->update([
                                'status' => ($result && $result['success']) ? 'sent' : 'failed',
                                'whatsapp_message_id' => $result['message_id'] ?? null,
                            ]);
                        }

                        // Actualizar last_message_at
                        $conversation->update(['last_message_at' => now()]);
                    } else {
                        // Sin asesores de turno: avisar al usuario
                        $this->sendTextMessage($phoneNumber, '⏳ Presentamos alto flujo de mensajes en este momento. Su solicitud ha sido registrada y será atendida lo antes posible. Agradecemos su paciencia.');

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

            // Buscar si hay appointments asociados (sin enviar respuesta todavía)
            // ¿Responde a una cita, y qué hacer? (ver planRespuestaCita: una cita solo cambia con una indicación sin duda)
            $planCita = $this->planRespuestaCita($from, $messageData);
            $appointments = $planCita['citas'] ?? new \Illuminate\Database\Eloquent\Collection();
            $appointment = $appointments->first(); // Para compatibilidad con lógica de conversación

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

            // Si la conversación está bloqueada, ignorar el mensaje entrante
            if ($conversation->is_blocked) {
                Log::info('Message from blocked conversation ignored', [
                    'conversation_id' => $conversation->id,
                    'phone' => $from,
                    'message_id' => $messageId,
                ]);
                return null;
            }

            // Si la conversación estaba resuelta, reactivarla cuando llega un mensaje nuevo
            // Quitar asignación para que entre al pool compartido de asesores de turno
            if (in_array($conversation->status, ['resolved', 'scheduled'])) {
                // Conservar datos de perfil del usuario, pero borrar historial clínico/navegación de menú
                $flowData = $conversation->welcome_flow_data ?? [];
                $profileData = [];
                $preserveKeys = [
                    'welcome', 'document_type', 'document_type_other', 'document_number', 
                    'full_name', 'phone_number', 'email', 'eps_selection', 'eps_other', 'regimen'
                ];
                
                foreach ($preserveKeys as $key) {
                    if (isset($flowData[$key])) {
                        $profileData[$key] = $flowData[$key];
                    }
                }

                $conversation->update([
                    'status' => 'active',
                    'assigned_to' => null,
                    'resolved_by' => null, // Limpiar la resolución previa: ya no está resuelta (evita arrastrar el nombre viejo)
                    'resolved_at' => null,
                    'last_message_at' => now(),
                    'welcome_flow_completed' => false,
                    'welcome_flow_step' => null,
                    'welcome_flow_data' => !empty($profileData) ? $profileData : null,
                    'notes' => ($conversation->notes ? $conversation->notes . "\n\n" : '') . 
                              'Conversación reactivada automáticamente por mensaje entrante el ' . now()->format('Y-m-d H:i:s')
                ]);
                
                Log::info('Conversation reactivated from resolved (flow reset)', [
                    'conversation_id' => $conversation->id,
                    'phone_number' => $conversation->phone_number,
                    'preserved_profile' => !empty($profileData),
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
            } elseif (isset($messageData['reaction'])) {
                // Reacción entrante (emoji): se adjunta al mensaje original y se difunde en
                // tiempo real, en vez de crearse como un mensaje de texto suelto. Retornamos
                // null porque no se persiste ningún mensaje nuevo.
                $this->handleIncomingReaction($conversation, $messageData);
                return null;
            } elseif (($messageData['type'] ?? null) === 'unsupported' || isset($messageData['errors'])) {
                $errorCode = $messageData['errors'][0]['code'] ?? null;
                $errorTitle = $messageData['errors'][0]['title'] ?? null;
                $errorDetails = $messageData['errors'][0]['error_data']['details'] ?? null;

                Log::warning('WhatsApp envió mensaje unsupported', [
                    'conversation_id' => $conversation->id,
                    'whatsapp_message_id' => $messageId,
                    'error_code' => $errorCode,
                    'error_title' => $errorTitle,
                    'error_details' => $errorDetails,
                    'errors_payload' => $messageData['errors'] ?? null,
                    'unsupported_payload' => $messageData['unsupported'] ?? null,
                ]);

                $content = "⚠️ El paciente envió un mensaje que WhatsApp Business no entrega (probablemente \"Ver una vez\", mensaje editado, o sticker no soportado). Pídale que lo reenvíe como imagen/PDF normal.";
                $messageType = 'text';
            }

            // Guardia final: si no logramos extraer contenido ni media, NO persistir un mensaje vacío.
            // Loggear el payload para diagnóstico y devolver null.
            if ($content === '' && !$mediaUrl) {
                Log::warning('Mensaje entrante con tipo no manejado, se ignora', [
                    'conversation_id' => $conversation->id,
                    'whatsapp_message_id' => $messageId,
                    'whatsapp_type' => $messageData['type'] ?? null,
                    'payload_keys' => array_keys($messageData),
                ]);
                // Marcar como leído en WhatsApp para evitar reintentos del webhook
                if ($messageId) {
                    $this->markAsRead($messageId);
                }
                return null;
            }

            // ¿Es una respuesta automática de cita (confirmar/cancelar)? En ese caso
            // el sistema la atiende solo y debe ocultarse de los asesores: no inunda
            // la lista de "Conversaciones" ni el hilo. Cualquier otro mensaje del
            // paciente (incluidos los datos para cancelar) sí queda visible.
            // Se oculta lo que el sistema resuelve solo (botones, listas, textos exactos). Si el bot solo PREGUNTA (texto
            // libre), el mensaje queda visible para los asesores: pudo no ser sobre la cita.
            $isAppointmentResponse = (bool) ($planCita['ocultar'] ?? false);

            // Crear mensaje
            $message = $conversation->messages()->create([
                'content' => $content,
                'message_type' => $messageType,
                'media_url' => $mediaUrl,
                'is_from_user' => true,
                'is_hidden' => $isAppointmentResponse,
                'whatsapp_message_id' => $messageId,
                // Hora REAL de envío según WhatsApp (epoch en el webhook). created_at es
                // cuando NOSOTROS lo procesamos; para la ventana de 24 h manda ésta, que es
                // contra la que cuenta Meta. Antes se extraía y se descartaba.
                'wa_sent_at' => is_numeric($timestamp)
                    ? \Carbon\Carbon::createFromTimestamp((int) $timestamp)
                    : null,
                'status' => 'delivered',
                'reply_to_id' => isset($messageData['context']['id'])
                    ? Message::where('whatsapp_message_id', $messageData['context']['id'])->value('id')
                    : null,
            ]);

            // Si es audio, intentar transcribir en background
            if ($messageType === 'audio' && $mediaUrl) {
                $this->transcribeAudioMessage($message);
            }

            // Actualizar conversación
            $conversation->update([
                'last_message_at' => now(),
            ]);

            // Los mensajes ocultos no suman no-leídos ni reactivan la vista de trabajo.
            if (!$isAppointmentResponse) {
                $conversation->incrementUnread();
            }

            // Marcar como leído en WhatsApp
            $this->markAsRead($messageId);

            // Emitir evento de broadcasting solo para mensajes visibles, para que las
            // confirmaciones/cancelaciones no "salten" en tiempo real a la lista.
            if (!$isAppointmentResponse) {
                \App\Support\TiempoReal::conversacion('mensaje_entrante', $conversation->id);
            }

            Log::info('Incoming message processed', [
                'conversation_id' => $conversation->id,
                'message_id' => $message->id,
            ]);

            // DESPUÉS de guardar el mensaje del usuario, procesar respuesta automática de appointment
            if ($planCita) {
                $this->sendAppointmentAutoResponse($from, $planCita, $conversation, $message);
                // Si fue respuesta a un recordatorio de cita, NO iniciar el flujo de bienvenida
                return $message;
            }

            // Aviso de fin de semana (Configuración): sábados y domingos, una vez por
            // conversación, con el horario de atención. Nunca lanza excepciones.
            app(\App\Services\WeekendNotice::class)->maybeSend($conversation, $from, $this);

            // --- Flujo de bienvenida ---
            // Refrescar la conversación para tener datos actualizados
            $conversation->refresh();

            // 1. Iniciar el flujo si:
            //    - Es una conversación nueva O
            //    - La conversación nunca ha completado ni empezado el flujo
            //    - Y NO tiene un asesor ya asignado (si ya tiene asesor, no mostrar el menú)
            $shouldStartFlow = false;
            if (!$conversation->assigned_to) {
                if (isset($isNewConversation) && $isNewConversation) {
                    $shouldStartFlow = true;
                } elseif (!$conversation->welcome_flow_completed && !$conversation->welcome_flow_step) {
                    $shouldStartFlow = true;
                }
            }

            if ($shouldStartFlow) {
                // Verificar si hay un flujo de bienvenida ACTIVO antes de hacer cualquier cosa
                $welcomeFlow = \App\Models\WelcomeFlow::getActive();
                if (!$welcomeFlow) {
                    Log::info('No active welcome flow, skipping', [
                        'conversation_id' => $conversation->id,
                    ]);
                    // No hay flujo activo — no enviar nada, dejar que el mensaje llegue al asesor normalmente
                } else {
                // Verificar si ya conocemos al usuario (tiene nombre y cédula guardados de un flujo anterior)
                $flowData = $conversation->welcome_flow_data ?? [];
                $hasProfile = !empty($flowData['full_name']['text']) && !empty($flowData['document_number']['text']);

                if ($hasProfile) {
                    $fullName = $flowData['full_name']['text'];
                    
                    Log::info('Restarting welcome flow for known user', [
                        'conversation_id' => $conversation->id,
                        'phone' => $from,
                        'name' => $fullName,
                    ]);

                    // Mensaje de bienvenida de regreso
                    $this->sendTextMessage($from, "¡Hola de nuevo, *$fullName*! 👋\nBienvenido(a) a nuestro canal digital del *Hospital Universitario del Valle*.");
                    
                    // Saltar directamente al menú de servicios (service_menu)
                    $serviceStep = $welcomeFlow->getStepByKey('service_menu');
                    
                    if ($serviceStep) {
                        $conversation->update([
                            'welcome_flow_step' => 'service_menu',
                            'welcome_flow_completed' => false,
                        ]);
                        // Se agrega retraso pequeño para que los mensajes lleguen en orden
                        usleep(500000); 
                        $this->sendFlowStep($serviceStep, $from, $conversation);
                        return $message;
                    }
                }

                Log::info('Starting welcome flow', [
                    'conversation_id' => $conversation->id,
                    'phone' => $from,
                    'is_new' => $isNewConversation ?? false,
                ]);
                $this->sendWelcomeFlow($from, $conversation);
                // No continuar procesando: el mensaje inicial del usuario no es una respuesta al flujo
                return $message;
                } // end else (welcomeFlow activo)
            }

            // 2. Si la conversación está en medio de un flujo de bienvenida, procesar la interacción
            if (!$conversation->welcome_flow_completed && $conversation->welcome_flow_step) {
                // Resetear flag de recordatorio de timeout (el usuario respondió)
                $flowData = $conversation->welcome_flow_data ?? [];
                if (!empty($flowData['_timeout_reminder_sent'])) {
                    unset($flowData['_timeout_reminder_sent']);
                    $conversation->update(['welcome_flow_data' => $flowData]);
                }

                if (isset($buttonReplyId) && $buttonReplyId) {
                    // Respuesta por botón interactivo o lista
                    $this->processWelcomeFlowInteraction($from, $conversation, $buttonReplyId);
                } elseif ($messageType === 'text' && $content) {
                    // Respuesta de texto libre (ej: número de documento)
                    $this->processWelcomeFlowInteraction($from, $conversation, null, $content);
                } else {
                    // El usuario envió algo que no es texto ni botón (imagen, audio, sticker, documento, etc.)
                    // Enviar advertencia y re-enviar el paso actual
                    $welcomeFlow = \App\Models\WelcomeFlow::getActive();
                    $currentStep = $welcomeFlow?->getStepByKey($conversation->welcome_flow_step);
                    
                    $hint = '⚠️ En este momento estamos recopilando tus datos. Por favor responde con ';
                    if ($currentStep && in_array($currentStep->message_type, ['interactive_buttons', 'interactive_list'])) {
                        $hint .= 'una de las *opciones disponibles*.';
                    } else {
                        $hint .= '*texto* para continuar.';
                    }

                    $result = $this->sendTextMessage($from, $hint);
                    if ($result['success'] ?? false) {
                        Message::create([
                            'conversation_id' => $conversation->id,
                            'content' => $hint,
                            'message_type' => 'text',
                            'is_from_user' => false,
                            'whatsapp_message_id' => $result['message_id'] ?? null,
                            'status' => 'sent',
                            'sent_by' => null,
                        ]);
                    }

                    // Re-enviar el paso actual (botones/lista) para que el usuario vea las opciones
                    if ($currentStep && in_array($currentStep->message_type, ['interactive_buttons', 'interactive_list'])) {
                        usleep(300000);
                        $this->sendFlowStep($currentStep, $from, $conversation);
                    }
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
     * ¿Este mensaje responde a una cita, y qué hacer? null si no: el mensaje lo ve un asesor, como cualquier otro.
     *
     * Antes la respuesta se aplicaba a la cita pendiente MÁS PRÓXIMA del número, sin mirar a qué recordatorio respondía
     * el paciente (feb–ago 2026: 839 respuestas cayeron en otra cita, 71 de ellas cancelaciones), y los textos se leían
     * por palabras sueltas («no puedo asistir» confirmaba). Ahora una cita SOLO cambia con una indicación sin duda:
     *  - el botón de SU recordatorio, o un botón o una lista que envía el bot con el id de la cita;
     *  - un texto exacto («Confirmo», «Cancelar», «No puedo asistir»…) cuando el número tiene una sola cita por venir.
     * Cualquier otro texto que hable de confirmar o cancelar recibe una PREGUNTA con botones (o una lista, si hay varias
     * citas) y queda visible para los asesores. Tras una cancelación por WhatsApp (el paciente manda los datos que se le
     * piden) el bot no interviene.
     *
     * Devuelve ['tipo' => aplicar|botones|lista|ya_procesadas, 'accion' => ?string, 'citas' => Collection, 'ocultar' => bool].
     */
    private function planRespuestaCita(string $from, array $messageData): ?array
    {
        try {
            $una = fn ($cita) => new \Illuminate\Database\Eloquent\Collection([$cita]);

            // 1) Lo que envía el bot: lista «¿sobre cuál cita?» (cita_ver_<id>) y botones (cita_confirmar_<id> /
            //    cita_cancelar_<id>). Solo si la cita es de este número.
            $idInteractivo = $messageData['interactive']['list_reply']['id'] ?? $messageData['interactive']['button_reply']['id'] ?? null;
            if (is_string($idInteractivo) && preg_match('/^cita_(confirmar|cancelar|ver)_(\d+)$/', $idInteractivo, $m)) {
                $cita = $this->citaPorIdDelNumero((int) $m[2], $from);
                if (!$cita) {
                    return null;
                }
                return $m[1] === 'ver'
                    ? ['tipo' => 'botones', 'accion' => null, 'citas' => $una($cita), 'ocultar' => true, 'origen' => 'bot']
                    : ['tipo' => 'aplicar', 'accion' => $m[1], 'citas' => $una($cita), 'ocultar' => true, 'origen' => 'bot'];
            }

            $citado = (string) ($messageData['context']['id'] ?? '');

            // 2) Botón de plantilla («Confirmar» / «Cancelar»): de un recordatorio → SU cita, y solo esa. De otro mensaje
            //    (p. ej. un envío masivo con «Confirmar») → no es de una cita.
            if (isset($messageData['button'])) {
                $texto = trim((string) ($messageData['button']['text'] ?? $messageData['button']['payload'] ?? ''));
                $accion = preg_match('/cancel|❌/iu', $texto) ? 'cancelar' : (preg_match('/confirm|asist|✅/iu', $texto) ? 'confirmar' : null);
                if (!$accion || $citado === '') {
                    return null;
                }
                $cita = $this->citaDelRecordatorio($citado);
                return $cita ? ['tipo' => 'aplicar', 'accion' => $accion, 'citas' => $una($cita), 'ocultar' => true, 'origen' => 'boton'] : null;
            }

            // 3) Texto escrito.
            $texto = trim((string) ($messageData['text']['body'] ?? ''));
            if ($texto === '') {
                return null;
            }
            $exacta = $this->accionExacta($texto);
            $accion = $exacta ?? $this->intencionDeTexto($texto);
            if (!$accion || $this->canceloHacePoco($from)) {
                return null;
            }
            // En medio del menú de bienvenida (p. ej. «Cancelación de cita», que pide documento y motivo): lo atiende el
            // flujo o un asesor, no el bot de recordatorios.
            $conversaciones = $this->conversacionesDe($from);
            if (\App\Models\Conversation::whereIn('id', $conversaciones)->whereNotNull('welcome_flow_step')->where('welcome_flow_completed', false)->exists()) {
                return null;
            }

            // Citando un mensaje: el recordatorio → esa cita; la pregunta del bot → como si no citara nada; otro mensaje
            // del hilo (de un asesor, del bot…) → no es una respuesta a un recordatorio.
            if ($citado !== '') {
                $cita = $this->citaDelRecordatorio($citado);
                if ($cita) {
                    return $exacta
                        ? ['tipo' => 'aplicar', 'accion' => $exacta, 'citas' => $una($cita), 'ocultar' => true, 'origen' => 'texto']
                        : ['tipo' => 'botones', 'accion' => $accion, 'citas' => $una($cita), 'ocultar' => false, 'origen' => 'texto'];
                }
                $citadoMensaje = Message::where('whatsapp_message_id', $citado)->first(['id', 'is_from_user', 'sent_by', 'content']);
                if ($citadoMensaje && !$this->esPreguntaDeCita($citadoMensaje)) {
                    return null;
                }
            }

            $futuras = $this->citasFuturasDe($from);
            if ($futuras->isEmpty()) {
                // «Confirmo» sin nada por venir: si respondió hace poco, aviso de que ya estaba registrado (una vez).
                if ($exacta === 'confirmar') {
                    $recientes = $this->citasRespondidasRecientesDe($from);
                    if ($recientes->isNotEmpty()) {
                        return ['tipo' => 'ya_procesadas', 'accion' => 'confirmar', 'citas' => $recientes, 'ocultar' => true, 'origen' => 'texto'];
                    }
                }
                return null;
            }

            $unica = $futuras->count() === 1 ? $futuras->first() : null;
            // Directo solo con texto exacto, una sola cita por venir y si lo último que le escribimos fue su recordatorio o
            // la pregunta del bot (si hablaba con un asesor, «Confirmo» puede ser otra cosa). Cancelar una cita ya
            // confirmada, siempre preguntando.
            if ($exacta && $unica && !($exacta === 'cancelar' && $unica->reminder_status === 'confirmed')
                && $this->ultimoSalienteEsDeCita($unica)) {
                return ['tipo' => 'aplicar', 'accion' => $exacta, 'citas' => $futuras, 'ocultar' => true, 'origen' => 'texto'];
            }

            return $unica
                ? ['tipo' => 'botones', 'accion' => $accion, 'citas' => $futuras, 'ocultar' => false, 'origen' => 'texto']
                : ['tipo' => 'lista', 'accion' => $accion, 'citas' => $futuras, 'ocultar' => false, 'origen' => 'texto'];

        } catch (\Throwable $e) {
            Log::error('Plan de respuesta de cita: error (el mensaje sigue como uno normal)', ['error' => $e->getMessage()]);
            return null;
        }
    }

    /** Texto exacto de respuesta (todo el mensaje): 'confirmar' | 'cancelar' | null. */
    private function accionExacta(string $texto): ?string
    {
        $t = mb_strtolower(trim((string) preg_replace('/[\s.,;:!¡]+/u', ' ', $texto)));
        if ($t === '✅') {
            return 'confirmar';
        }
        if ($t === '❌') {
            return 'cancelar';
        }
        $t = trim((string) preg_replace('/(?:\s*(?:✅|👍|🙏|😊|☺️|🙂))+$/u', '', $t));
        if (preg_match('/^(?:s[ií]\s+)?(?:confirmo|confirmar|confirmado|confirmada)(?:\s+(?:asistencia|la\s+cita|mi\s+cita))?(?:\s+gracias)?$/u', $t)) {
            return 'confirmar';
        }
        if (preg_match('/^(?:cancelar|cancelo)(?:\s+(?:la\s+cita|mi\s+cita))?$|^no\s+(?:puedo\s+asistir|podr[eé]\s+asistir|asistir[eé])$/u', $t)) {
            return 'cancelar';
        }
        return null;
    }

    /**
     * ¿El texto habla de confirmar o cancelar? Solo decide si el bot PREGUNTA (con botones): no cambia ninguna cita.
     * null si no es claro (preguntas, textos largos o con un número de documento, o señales de ambas cosas).
     */
    private function intencionDeTexto(string $texto): ?string
    {
        if (mb_strlen($texto) > 80 || str_contains($texto, '?') || str_contains($texto, '¿') || preg_match('/\d(?:[.\s-]?\d){5,}/', $texto)) {
            return null;
        }

        // «No puedo asistir», «no asistiré», «no voy a poder ir»…: la negación pegada al verbo.
        $negacion = '/\bno\s+(?:(?:puedo|podr[eé]|podemos|podremos|voy\s+a\s+poder|vamos\s+a\s+poder|alcanzo\s+a|alcanzar[eé]\s+a)\s+)?(?:asistir[eé]?|asistiremos|ir)\b/iu';
        $cancela = (bool) preg_match('/\b(?:cancelar|cancelo|cancelamos)\b|❌/iu', $texto) || (bool) preg_match($negacion, $texto);
        // La confirmación se busca sin las frases negadas («no asistiré» no es «asistiré»).
        $confirma = (bool) preg_match('/\b(?:confirmo|confirmar|confirmamos|confirmada|confirmado|asisto|asistir[eé]|asistiremos)\b|✅/iu', (string) preg_replace($negacion, ' ', $texto));

        if ($confirma === $cancela) {
            return null;
        }

        return $cancela ? 'cancelar' : 'confirmar';
    }

    /** La cita $id si es de este número (las ids de los botones y listas del bot se validan contra el teléfono). */
    private function citaPorIdDelNumero(int $id, string $from): ?\App\Models\Appointment
    {
        $cita = \App\Models\Appointment::find($id);
        if (!$cita || !$cita->conversation_id || !in_array((int) $cita->conversation_id, $this->conversacionesDe($from), true)) {
            return null;
        }
        return $cita;
    }

    /** La cita cuyo recordatorio es el mensaje de WhatsApp $wamid (por la conversación del mensaje, que tiene índice). */
    private function citaDelRecordatorio(string $wamid): ?\App\Models\Appointment
    {
        $conversationId = Message::where('whatsapp_message_id', $wamid)->value('conversation_id');
        if ($conversationId) {
            // El mensaje está en el hilo: si no es el recordatorio de una cita de esa conversación, no es de una cita.
            return \App\Models\Appointment::where('conversation_id', $conversationId)
                ->where('reminder_whatsapp_message_id', $wamid)
                ->first();
        }

        // Mensaje que no está en el hilo (raro): búsqueda en toda la tabla (sin índice por esa columna).
        return \App\Models\Appointment::where('reminder_whatsapp_message_id', $wamid)->first();
    }

    /**
     * Citas del número de hoy en adelante con recordatorio propio recibido (pendientes o confirmadas). No cuenta las
     * canceladas, las de recordatorio fallido (el paciente nunca lo recibió) ni las gemelas sin recordatorio propio.
     */
    private function citasFuturasDe(string $from): \Illuminate\Database\Eloquent\Collection
    {
        $conversaciones = $this->conversacionesDe($from);
        if ($conversaciones === []) {
            return new \Illuminate\Database\Eloquent\Collection();
        }

        return \App\Models\Appointment::whereIn('conversation_id', $conversaciones)
            ->where('reminder_sent', true)
            ->whereNotNull('reminder_whatsapp_message_id')
            ->whereNotIn('reminder_status', ['cancelled', 'failed'])
            ->whereDate('citfc', '>=', $this->hoyColombia()->toDateString())
            ->orderBy('citfc', 'asc')
            ->orderBy('cithor', 'asc')
            ->get();
    }

    /** Citas del número ya respondidas (confirmadas o canceladas) desde hace 2 días: para el aviso «ya procesadas». */
    private function citasRespondidasRecientesDe(string $from): \Illuminate\Database\Eloquent\Collection
    {
        $conversaciones = $this->conversacionesDe($from);
        if ($conversaciones === []) {
            return new \Illuminate\Database\Eloquent\Collection();
        }

        return \App\Models\Appointment::whereIn('conversation_id', $conversaciones)
            ->where('reminder_sent', true)
            ->whereNotNull('reminder_whatsapp_message_id')
            ->whereIn('reminder_status', ['confirmed', 'cancelled'])
            ->whereDate('citfc', '>=', $this->hoyColombia()->subDays(2)->toDateString())
            ->orderBy('citfc', 'asc')
            ->orderBy('cithor', 'asc')
            ->get();
    }

    /**
     * ¿Canceló una cita por WhatsApp en las últimas 24 h? Entonces lo que escribe suele ser lo que el bot le pidió
     * (documento, motivo, parentesco): lo ve un asesor y el bot no interviene.
     */
    private function canceloHacePoco(string $from): bool
    {
        $conversaciones = $this->conversacionesDe($from);
        if ($conversaciones === []) {
            return false;
        }

        return \App\Models\Appointment::whereIn('conversation_id', $conversaciones)
            ->where('reminder_status', 'cancelled')
            ->where('updated_at', '>=', now()->subDay())
            ->where('notes', 'like', '%Paciente canceló vía WhatsApp%')
            ->exists();
    }

    /**
     * Conversaciones de este número (como las crea el webhook y el envío de recordatorios: «+» y los dígitos). Las citas
     * se buscan por aquí: es la conversación a la que de verdad llegó el recordatorio, y tiene índice.
     */
    private function conversacionesDe(string $from): array
    {
        $digitos = preg_replace('/[^0-9]/', '', $from);
        if (strlen($digitos) < 8) {
            return [];
        }

        return \App\Models\Conversation::whereIn('phone_number', ['+' . $digitos, $digitos])
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    /** ¿Es una pregunta de cita que envía este bot («¿Qué desea hacer con la cita…?» o la lista «Tiene N citas próximas»)? */
    private function esPreguntaDeCita($mensaje): bool
    {
        if (!$mensaje || $mensaje->is_from_user || $mensaje->sent_by !== null) {
            return false;
        }
        $contenido = (string) $mensaje->content;
        return str_starts_with($contenido, '¿Qué desea hacer con la cita')
            || (str_starts_with($contenido, 'Tiene ') && str_contains($contenido, 'citas próximas'));
    }

    /** ¿Lo último que le escribimos en ese hilo fue el recordatorio de esta cita o una pregunta de cita del bot? */
    private function ultimoSalienteEsDeCita(\App\Models\Appointment $cita): bool
    {
        if (!$cita->conversation_id) {
            return false;
        }
        $ultimo = Message::where('conversation_id', $cita->conversation_id)
            ->where('is_from_user', false)
            ->orderByDesc('id')
            ->first(['id', 'is_from_user', 'sent_by', 'content', 'whatsapp_message_id']);

        return $ultimo && (
            ($cita->reminder_whatsapp_message_id && $ultimo->whatsapp_message_id === $cita->reminder_whatsapp_message_id)
            || $this->esPreguntaDeCita($ultimo)
        );
    }

    /**
     * Gemelas de una cita: la misma cita repetida en otra fila (misma cédula, servicio, fecha y hora), a la que no se le
     * mandó otro recordatorio (SendAppointmentReminderJob::marcarSiEsGemela la anota «[Duplicada de la cita #id: …]»).
     * Siguen la respuesta de su cita: al confirmar, las que no estén respondidas; al cancelar, todas las no canceladas.
     */
    private function gemelasDe(\App\Models\Appointment $a, string $accion): \Illuminate\Database\Eloquent\Collection
    {
        if (!$a->conversation_id) {
            return new \Illuminate\Database\Eloquent\Collection();
        }

        return \App\Models\Appointment::where('conversation_id', $a->conversation_id)
            ->where('id', '!=', $a->id)
            ->where('notes', 'like', '%[Duplicada de la cita #' . $a->id . ':%')
            // marcarSiEsGemela no mira el médico: con otro médico o especialidad es otra cita y no se toca.
            ->where(fn ($q) => $a->citmed === null ? $q->whereNull('citmed') : $q->where('citmed', $a->citmed))
            ->where(fn ($q) => $a->espnom === null ? $q->whereNull('espnom') : $q->where('espnom', $a->espnom))
            ->whereNotIn('reminder_status', $accion === 'confirmar' ? ['confirmed', 'cancelled'] : ['cancelled'])
            ->lockForUpdate()
            ->get();
    }

    /**
     * Hoy en Colombia. La app corre en UTC pero citfc es la fecha local de la cita: desde las 7 p. m. «hoy» en UTC ya
     * es mañana, y las citas de hoy se daban por pasadas.
     */
    private function hoyColombia(): \Carbon\Carbon
    {
        return \Carbon\Carbon::now('America/Bogota')->startOfDay();
    }

    /**
     * Aplica la respuesta del paciente a UNA cita (y a sus gemelas). Devuelve [texto de respuesta (sin firma) o null,
     * ¿flujo terminado?].
     *
     * Confirmar una cita confirmada o cancelada, cancelar una cancelada o responder a una cita pasada solo informan, y
     * una sola vez por cita (para no responder a cada toque). Cancelar una cita confirmada SÍ se permite (antes se
     * respondía «ya procesada» y la cita quedaba confirmada aunque el paciente no iba a ir: 846 casos).
     */
    private function aplicarRespuestaCita(\App\Models\Appointment $a, string $accion): array
    {
        $marcaHora = '[' . now()->format('Y-m-d H:i') . ']';
        $notas = $a->notes ?? '';
        $cual = $this->descripcionCita($a);

        $unaVez = function (string $marca, string $texto) use ($a, $notas, $marcaHora): array {
            if (str_contains($notas, $marca)) {
                return [null, true];
            }
            $a->update(['notes' => $notas . "\n{$marcaHora} {$marca}"]);
            return [$texto, true];
        };

        // Recordatorio de una cita que ya pasó: no se cambia nada.
        if ($a->citfc->toDateString() < $this->hoyColombia()->toDateString()) {
            return $unaVez('[Aviso: la cita ya pasó]', "ℹ️ Esta cita ya pasó: {$cual}.\n\nPara programar una nueva cita:\n🌐 *Página web de citas:* https://citas.huv.gov.co/login\n📞 *Teléfono:* 6206275");
        }

        if ($accion === 'confirmar') {
            if ($a->reminder_status === 'confirmed') {
                return $unaVez('[Aviso: ya estaba confirmada]', "✅ Su cita ya estaba confirmada: {$cual}.\n\nLo esperamos en el Hospital Universitario del Valle.");
            }
            if ($a->reminder_status === 'cancelled') {
                return $unaVez('[Aviso: cancelada, no se reconfirma]', "ℹ️ Esta cita fue cancelada y no se puede volver a confirmar por este medio: {$cual}.\n\nPara programar una nueva cita:\n🌐 *Página web de citas:* https://citas.huv.gov.co/login\n📞 *Teléfono:* 6206275");
            }
            $a->update([
                'reminder_status' => 'confirmed',
                'notes' => $notas . "\n{$marcaHora} Paciente confirmó asistencia vía WhatsApp",
            ]);
            foreach ($this->gemelasDe($a, 'confirmar') as $g) {
                $g->update(['reminder_status' => 'confirmed', 'notes' => ($g->notes ?? '') . "\n{$marcaHora} Confirmada junto con su cita #{$a->id} (vía WhatsApp)"]);
            }
            Log::info('Appointment confirmed by patient', ['appointment_id' => $a->id]);
            return ["✅ *Confirmación recibida*\n\nSe ha confirmado {$cual}.\n\nLo esperamos en el Hospital Universitario del Valle.", true];
        }

        if ($a->reminder_status === 'cancelled') {
            return $unaVez('[Aviso: ya estaba cancelada]', "❌ Su cita ya estaba cancelada: {$cual}.");
        }
        $antes = $a->reminder_status === 'confirmed' ? ' (antes la había confirmado)' : '';
        $a->update([
            'reminder_status' => 'cancelled',
            'notes' => $notas . "\n{$marcaHora} Paciente canceló vía WhatsApp{$antes}",
        ]);
        foreach ($this->gemelasDe($a, 'cancelar') as $g) {
            $g->update(['reminder_status' => 'cancelled', 'notes' => ($g->notes ?? '') . "\n{$marcaHora} Cancelada junto con su cita #{$a->id} (vía WhatsApp)"]);
        }
        Log::info('Appointment cancelled by patient', ['appointment_id' => $a->id, 'estaba_confirmada' => $antes !== '']);
        return ["❌ *Cancelación* de {$cual}.\n\nEstimado usuario/a, para hacer efectiva tu cancelación, por favor envíanos la siguiente información:\n\n📄 Documento de identidad del paciente\n📝 Motivo de cancelación\n👤 Nombre completo de quien cancela la cita\n👥 Parentesco\n\nHasta no enviar la información no se cancelará la consulta.\n\nPara programar tu nueva cita, recuerda nuestros canales:\n🌐 *Página web de citas:* https://citas.huv.gov.co/login\n📞 *Teléfono:* 6206275", true];
    }

    /** «la cita de *Paciente* del dd/mm/aaaa a las hh:mm AM — Especialidad». */
    private function descripcionCita(\App\Models\Appointment $a): string
    {
        $hora = $this->formatHoraForResponse($a->cithor);
        $paciente = $a->nom_paciente ?? 'Paciente';
        $especialidad = $a->espnom ?? 'No especificada';
        return "la cita de *{$paciente}* del {$a->citfc->format('d/m/Y')} a las {$hora} — {$especialidad}";
    }

    /**
     * Envía y guarda la respuesta automática del appointment
     * Soporta múltiples citas del mismo paciente en el mismo día
     */
    /**
     * Procesa una reacción entrante: la adjunta al mensaje original (o la elimina si el
     * emoji viene vacío) y la difunde en tiempo real. No crea un mensaje de texto.
     */
    private function handleIncomingReaction(Conversation $conversation, array $messageData): void
    {
        $reaction = $messageData['reaction'] ?? [];
        $targetWamid = $reaction['message_id'] ?? null;
        $emoji = $reaction['emoji'] ?? '';
        $reactionWamid = $messageData['id'] ?? null;

        // Marcar el evento como leído para evitar reintentos del webhook
        if ($reactionWamid) {
            $this->markAsRead($reactionWamid);
        }

        if (!$targetWamid) {
            return;
        }

        $target = Message::where('whatsapp_message_id', $targetWamid)
            ->where('conversation_id', $conversation->id)
            ->first();

        if (!$target) {
            Log::info('Reacción entrante sin mensaje destino en BD', [
                'conversation_id' => $conversation->id,
                'target_wamid' => $targetWamid,
            ]);
            return;
        }

        if ($emoji === '') {
            // El paciente quitó su reacción
            $target->reactions()->where('from_user', true)->delete();
            \App\Support\TiempoReal::conversacion('mensaje', $conversation->id);
            return;
        }

        // Crear o actualizar la reacción del paciente (máximo una por lado)
        MessageReaction::updateOrCreate(
            ['message_id' => $target->id, 'from_user' => true],
            ['emoji' => $emoji, 'whatsapp_message_id' => $reactionWamid]
        );

        \App\Support\TiempoReal::conversacion('mensaje', $conversation->id);
    }

    private function sendAppointmentAutoResponse(string $from, array $plan, \App\Models\Conversation $conversation, ?Message $mensajePaciente = null): void
    {
        $enviado = false;
        $falloEnvio = false;
        try {
            // Transacción con bloqueo pesimista para evitar condiciones de carrera (dos toques casi a la vez). Primero la
            // conversación: así dos avisos del mismo hilo van en fila y no se cruzan los bloqueos de citas y gemelas.
            \Illuminate\Support\Facades\DB::transaction(function () use ($from, $plan, $conversation, &$enviado, &$falloEnvio) {
                \App\Models\Conversation::whereKey($conversation->id)->lockForUpdate()->first(['id']);
                $appointmentIds = $plan['citas']->pluck('id')->toArray();
                $lockedAppointments = \App\Models\Appointment::whereIn('id', $appointmentIds)
                    ->lockForUpdate()
                    ->orderBy('citfc', 'asc')
                    ->orderBy('cithor', 'asc')
                    ->get();

                if ($lockedAppointments->isEmpty()) {
                    Log::warning('No appointments found during locked read', [
                        'appointment_ids' => $appointmentIds,
                    ]);
                    return;
                }

                $responseMessage = null;
                $autoResolveConversation = false;
                $botones = null;
                $lista = null;

                if ($plan['tipo'] === 'aplicar') {
                    $cita = $lockedAppointments->first();
                    [$responseMessage, $autoResolveConversation] = $this->aplicarRespuestaCita($cita, $plan['accion']);
                    if ($responseMessage) {
                        // Las demás citas del número que siguen esperando respuesta, para que responda la de cada una.
                        $otras = $this->citasFuturasDe($from)
                            ->reject(fn ($o) => (int) $o->id === (int) $cita->id || $o->reminder_status === 'confirmed');
                        if ($otras->isNotEmpty()) {
                            $detalle = $otras->map(function ($o) {
                                $h = $this->formatHoraForResponse($o->cithor);
                                $p = $o->nom_paciente ?? 'Paciente';
                                $e = $o->espnom ?? 'No especificada';
                                return "• *{$p}*\n  {$o->citfc->format('d/m/Y')} a las {$h} — {$e}";
                            })->join("\n\n");
                            $n = $otras->count();
                            $responseMessage .= "\n\n📋 Además tiene {$n} " . ($n === 1 ? 'cita pendiente' : 'citas pendientes') . " de respuesta:\n\n{$detalle}\n\nPara cada una, responda con los botones de su recordatorio.";
                            $autoResolveConversation = false;
                        }
                        $responseMessage .= "\n\n_HUV - Evaristo García_";
                    }
                } elseif ($plan['tipo'] === 'botones') {
                    // Pregunta con botones sobre UNA cita: nada cambia hasta que el paciente toque uno.
                    $cita = $lockedAppointments->first();
                    $confirmada = $cita->reminder_status === 'confirmed' ? "\n\n(Esta cita ya está confirmada.)" : '';
                    $responseMessage = '¿Qué desea hacer con ' . $this->descripcionCita($cita) . "?{$confirmada}";
                    $botones = [
                        ['id' => "cita_confirmar_{$cita->id}", 'title' => 'Confirmar'],
                        ['id' => "cita_cancelar_{$cita->id}", 'title' => 'Cancelar'],
                    ];
                } elseif ($plan['tipo'] === 'lista') {
                    // Varias citas: primero cuál (lista); luego, botones para esa cita. Nada cambia hasta elegir.
                    $n = $lockedAppointments->count();
                    $responseMessage = "Tiene {$n} citas próximas. ¿Sobre cuál nos escribe?\n\nToque «Ver citas» y elija una."
                        . ($n > 10 ? "\n\n(Se muestran las 10 más próximas.)" : '');
                    $lista = $lockedAppointments->take(10)->map(fn ($a) => [
                        'id' => "cita_ver_{$a->id}",
                        'title' => $a->citfc->format('d/m/Y') . ' ' . $this->formatHoraForResponse($a->cithor),
                        'description' => trim(($a->nom_paciente ?? 'Paciente') . ' · ' . ($a->espnom ?? '') . ($a->reminder_status === 'confirmed' ? ' · confirmada' : '')),
                    ])->values()->all();
                } elseif ($plan['tipo'] === 'ya_procesadas') {
                    // «Confirmo» sin citas por venir: aviso de que ya estaban registradas (solo una vez).
                    $firstProcessed = $lockedAppointments->first();
                    if (str_contains($firstProcessed->notes ?? '', '[Advertencia de estado final enviada]')) {
                        Log::info('Final status warning already sent, ignoring new response', [
                            'appointment_ids' => $appointmentIds,
                            'phone' => $from,
                        ]);
                        return;
                    }

                    $citasInfo = $lockedAppointments->map(function ($a) {
                        $hora = $this->formatHoraForResponse($a->cithor);
                        $status = $a->reminder_status === 'confirmed' ? 'CONFIRMADA' : 'CANCELADA';
                        $paciente = $a->nom_paciente ?? 'Paciente';
                        return "• *{$paciente}*\n  {$a->citfc->format('d/m/Y')} a las {$hora} - *{$status}*";
                    })->join("\n\n");

                    $responseMessage = "⚠️ *Citas ya procesadas*\n\nSus citas ya se encuentran registradas:\n\n{$citasInfo}\n\nSi necesita realizar cambios adicionales, por favor contacte con un asesor.\n\n_HUV - Evaristo García_";
                    $autoResolveConversation = true;

                    foreach ($lockedAppointments as $a) {
                        $a->update([
                            'notes' => ($a->notes ?? '') . "\n[" . now()->format('Y-m-d H:i') . "] [Advertencia de estado final enviada]"
                        ]);
                    }
                }

                if (!$responseMessage) {
                    return;
                }

                // Enviar a WhatsApp: lista, botones o texto.
                $result = $lista
                    ? $this->sendInteractiveListMessage($from, $responseMessage, 'Ver citas', [['title' => 'Citas', 'rows' => $lista]])
                    : ($botones
                        ? $this->sendInteractiveButtonMessage($from, $responseMessage, $botones)
                        : $this->sendTextMessage($from, $responseMessage));
                // Lo que se guarda en el hilo: el texto y las opciones.
                if ($lista) {
                    $responseMessage .= "\n\n" . collect($lista)->map(fn ($f) => '• ' . $f['title'] . ' — ' . $f['description'])->join("\n");
                } elseif ($botones) {
                    $responseMessage .= "\n\n[" . collect($botones)->pluck('title')->join('] [') . ']';
                }

                Log::info('Send automatic response result', [
                    'tipo' => $plan['tipo'],
                    'success' => $result['success'] ?? false,
                    'message_id' => $result['message_id'] ?? null,
                    'error' => $result['error'] ?? null,
                ]);

                if (!(($result['success'] ?? false) && isset($result['message_id']))) {
                    Log::error('Failed to save automatic response', ['result' => $result, 'from' => $from]);
                    $falloEnvio = true;
                    return;
                }
                $enviado = true;

                \App\Models\Message::create([
                    'conversation_id' => $conversation->id,
                    'content' => $responseMessage,
                    'message_type' => 'text',
                    'is_from_user' => false,
                    // Oculta si el sistema lo resolvió solo; visible si solo pregunta (el asesor ve la conversación entera).
                    'is_hidden' => (bool) $plan['ocultar'],
                    'whatsapp_message_id' => $result['message_id'],
                    'status' => 'sent',
                    'sent_by' => null, // Sistema automático
                ]);

                // Confirmación/cancelación gestionada 100% por el sistema: sacar la conversación de "Todos" (pasa a
                // "Resueltos") SOLO si nadie la tiene asignada y no hay ningún mensaje real sin leer. Si el paciente vuelve
                // a escribir, la reactivación automática la reabre en "Todos".
                if ($autoResolveConversation) {
                    $closed = \App\Models\Conversation::where('id', $conversation->id)
                        ->whereNull('assigned_to')
                        ->where('unread_count', 0)
                        ->whereIn('status', ['active', 'pending'])
                        ->update([
                            'status' => 'resolved',
                            'resolved_at' => now(),
                            'resolved_by' => null, // Auto-resuelto por el SISTEMA: no atribuir a un asesor
                            'unread_count' => 0,
                        ]);

                    if ($closed) {
                        Log::info('Conversación auto-resuelta tras confirmación de cita', [
                            'conversation_id' => $conversation->id,
                        ]);
                    }
                }
            });

        } catch (\Exception $e) {
            Log::error('Send appointment auto response exception', [
                'error' => $e->getMessage(),
                'from' => $from,
            ]);
            $falloEnvio = true;
        }

        // El mensaje del paciente se ocultó porque lo iba a resolver el sistema. Si al final no se le respondió nada (un
        // texto con un aviso que ya se había dado) o falló el envío, que lo vea un asesor.
        if ($mensajePaciente && $mensajePaciente->is_hidden && !$enviado
            && ($falloEnvio || ($plan['origen'] ?? '') === 'texto')) {
            try {
                $mensajePaciente->update(['is_hidden' => false]);
                $conversation->incrementUnread();
                \App\Support\TiempoReal::conversacion('mensaje_entrante', $conversation->id);
            } catch (\Throwable) {
            }
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
                \App\Support\TiempoReal::conversacion('mensaje', $conversation->id);
            }
        } catch (\Exception $e) {
            Log::error('Audio transcription failed', [
                'message_id' => $message->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
