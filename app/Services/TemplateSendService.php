<?php

namespace App\Services;

use App\Jobs\SendTemplateMessageJob;
use App\Models\Conversation;
use App\Models\Template;
use App\Models\TemplateSend;
use Illuminate\Support\Facades\Log;

class TemplateSendService
{
    public function __construct(
        private WhatsAppService $whatsAppService
    ) {}

    /**
     * Iniciar envío masivo a destinatarios específicos o todos
     */
    public function initiateSend(Template $template, array $recipientIds = [], bool $sendToAll = false): TemplateSend
    {
        // Validar que la plantilla esté activa
        if (!$template->canBeUsed()) {
            throw new \Exception('La plantilla no está activa o no tiene contenido.');
        }

        // Obtener lista de destinatarios
        $conversations = $sendToAll 
            ? $this->getAllRecipients()
            : $this->getSelectedRecipients($recipientIds);

        if ($conversations->isEmpty()) {
            throw new \Exception('No hay destinatarios disponibles para enviar.');
        }

        // Crear registro de envío
        $templateSend = TemplateSend::create([
            'template_id' => $template->id,
            'sent_by' => auth()->id(),
            'total_recipients' => $conversations->count(),
            'successful_sends' => 0,
            'failed_sends' => 0,
            'status' => 'pending',
            'sent_to_all' => $sendToAll,
            'recipient_ids' => $sendToAll ? null : $recipientIds,
        ]);

        // Despachar job para procesar envíos en segundo plano
        SendTemplateMessageJob::dispatch($templateSend, $conversations->pluck('id')->toArray());

        Log::info('Template send initiated', [
            'template_id' => $template->id,
            'template_send_id' => $templateSend->id,
            'total_recipients' => $conversations->count(),
            'sent_to_all' => $sendToAll,
        ]);

        return $templateSend;
    }

    /**
     * Obtener todos los contactos disponibles
     */
    public function getAllRecipients()
    {
        return Conversation::whereNotNull('phone_number')
            ->orderBy('last_message_at', 'desc')
            ->get();
    }

    /**
     * Obtener contactos seleccionados
     */
    public function getSelectedRecipients(array $conversationIds)
    {
        return Conversation::whereIn('id', $conversationIds)
            ->whereNotNull('phone_number')
            ->get();
    }

    /**
     * Enviar mensaje a un destinatario específico
     * Soporta múltiples archivos multimedia (se envían como mensajes separados)
     */
    public function sendToRecipient(Template $template, Conversation $conversation): array
    {
        try {
            $results = [];
            $mediaFiles = $template->getMediaFilesArray();
            $hasMedia = !empty($mediaFiles);

            // Si hay archivos multimedia, enviarlos primero
            if ($hasMedia) {
                foreach ($mediaFiles as $index => $mediaFile) {
                    // El caption solo va en el primer archivo si hay texto
                    $caption = ($index === 0 && !empty($template->content)) ? $template->content : null;
                    
                    $result = match ($mediaFile['type']) {
                        'image' => $this->whatsAppService->sendImageMessage(
                            $conversation->phone_number,
                            $this->getAbsoluteUrl($mediaFile['url']),
                            $caption
                        ),
                        'video' => $this->whatsAppService->sendVideoMessage(
                            $conversation->phone_number,
                            $this->getAbsoluteUrl($mediaFile['url']),
                            $caption
                        ),
                        'document' => $this->whatsAppService->sendDocumentMessage(
                            $conversation->phone_number,
                            $this->getAbsoluteUrl($mediaFile['url']),
                            $mediaFile['filename'] ?? 'document',
                            $caption
                        ),
                        default => throw new \Exception('Tipo de archivo no soportado: ' . $mediaFile['type']),
                    };

                    if ($result['success']) {
                        // Guardar mensaje en BD
                        $conversation->messages()->create([
                            'content' => $caption ?? '',
                            'message_type' => $mediaFile['type'],
                            'media_url' => $mediaFile['url'],
                            'media_filename' => $mediaFile['filename'] ?? null,
                            'is_from_user' => false,
                            'whatsapp_message_id' => $result['message_id'] ?? null,
                            'status' => 'sent',
                            'sent_by' => auth()->id(),
                        ]);
                    }

                    $results[] = $result;

                    // Pequeño delay entre archivos para evitar rate limiting
                    if (count($mediaFiles) > 1 && $index < count($mediaFiles) - 1) {
                        usleep(500000); // 0.5 segundos
                    }
                }

                // Si el primer archivo ya tenía el caption, no enviar texto adicional
                $allSuccess = collect($results)->every(fn($r) => $r['success']);
                
                return [
                    'success' => $allSuccess,
                    'message_id' => $results[0]['message_id'] ?? null,
                    'results' => $results,
                ];
            }

            // Si no hay archivos, enviar solo texto
            $result = $this->whatsAppService->sendTextMessage(
                $conversation->phone_number,
                $template->content
            );

            if ($result['success']) {
                // Guardar mensaje en BD
                $conversation->messages()->create([
                    'content' => $template->content,
                    'message_type' => 'text',
                    'media_url' => null,
                    'media_filename' => null,
                    'is_from_user' => false,
                    'whatsapp_message_id' => $result['message_id'] ?? null,
                    'status' => 'sent',
                    'sent_by' => auth()->id(),
                ]);

                Log::info('Template message sent successfully', [
                    'conversation_id' => $conversation->id,
                    'phone' => $conversation->phone_number,
                    'template_id' => $template->id,
                ]);
            }

            return $result;

        } catch (\Exception $e) {
            Log::error('Error sending template message', [
                'conversation_id' => $conversation->id,
                'template_id' => $template->id,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Convertir URL relativa a absoluta
     */
    private function getAbsoluteUrl(string $url): string
    {
        if (str_starts_with($url, 'http://') || str_starts_with($url, 'https://')) {
            return $url;
        }
        
        return config('app.url') . $url;
    }

    /**
     * Obtener lista de destinatarios disponibles con info básica
     */
    public function getAvailableRecipients(): array
    {
        $conversations = Conversation::whereNotNull('phone_number')
            ->with('lastMessage')
            ->orderBy('last_message_at', 'desc')
            ->get();

        return $conversations->map(function ($conversation) {
            return [
                'id' => $conversation->id,
                'phone_number' => $conversation->phone_number,
                'contact_name' => $conversation->contact_name ?? 'Sin nombre',
                'last_message_at' => $conversation->last_message_at?->diffForHumans(),
                'unread_count' => $conversation->unread_count,
            ];
        })->toArray();
    }
}
