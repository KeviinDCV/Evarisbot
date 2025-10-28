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
     */
    public function sendToRecipient(Template $template, Conversation $conversation): array
    {
        try {
            $result = match ($template->message_type) {
                'text' => $this->whatsAppService->sendTextMessage(
                    $conversation->phone_number,
                    $template->content
                ),
                'image' => $this->whatsAppService->sendImageMessage(
                    $conversation->phone_number,
                    $template->media_url,
                    $template->content
                ),
                'document' => $this->whatsAppService->sendDocumentMessage(
                    $conversation->phone_number,
                    $template->media_url,
                    $template->media_filename ?? 'document'
                ),
                default => throw new \Exception('Tipo de mensaje no soportado'),
            };

            if ($result['success']) {
                // Guardar mensaje en BD
                $conversation->messages()->create([
                    'content' => $template->content,
                    'message_type' => $template->message_type,
                    'media_url' => $template->media_url,
                    'media_filename' => $template->media_filename,
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
