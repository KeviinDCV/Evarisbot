<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use App\Services\WhatsAppService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class WhatsAppWebhookController extends Controller
{
    private WhatsAppService $whatsappService;

    public function __construct(WhatsAppService $whatsappService)
    {
        $this->whatsappService = $whatsappService;
    }

    /**
     * Verificación del webhook (requerido por Meta)
     * GET /webhook/whatsapp
     */
    public function verify(Request $request)
    {
        $mode = $request->query('hub_mode');
        $token = $request->query('hub_verify_token');
        $challenge = $request->query('hub_challenge');

        $verifyToken = Setting::get('whatsapp_verify_token');

        // Verificar que el token coincida
        if ($mode === 'subscribe' && $token === $verifyToken) {
            Log::info('Webhook verified successfully');
            return response($challenge, 200);
        }

        Log::warning('Webhook verification failed', [
            'mode' => $mode,
            'token' => $token,
        ]);

        return response('Forbidden', 403);
    }

    /**
     * Recibir mensajes entrantes
     * POST /webhook/whatsapp
     */
    public function handle(Request $request)
    {
        try {
            $data = $request->all();

            Log::info('Webhook received', ['payload' => $data]);

            // Verificar que sea un mensaje de WhatsApp
            if (!isset($data['entry'])) {
                return response()->json(['status' => 'ignored']);
            }

            foreach ($data['entry'] as $entry) {
                if (!isset($entry['changes'])) {
                    continue;
                }

                foreach ($entry['changes'] as $change) {
                    if ($change['field'] !== 'messages') {
                        continue;
                    }

                    $value = $change['value'];

                    // Procesar mensajes entrantes
                    if (isset($value['messages'])) {
                        $contacts = $value['contacts'] ?? [];
                        foreach ($value['messages'] as $message) {
                            $this->whatsappService->processIncomingMessage($message, $contacts);
                        }
                    }

                    // Procesar estados de mensajes (enviado, entregado, leído)
                    if (isset($value['statuses'])) {
                        foreach ($value['statuses'] as $status) {
                            $this->processMessageStatus($status);
                        }
                    }
                }
            }

            return response()->json(['status' => 'success']);

        } catch (\Exception $e) {
            Log::error('Webhook handling error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json(['status' => 'error'], 500);
        }
    }

    /**
     * Procesar cambios de estado de mensajes enviados
     */
    private function processMessageStatus(array $status): void
    {
        try {
            $messageId = $status['id'] ?? null;
            $statusType = $status['status'] ?? null;

            if (!$messageId || !$statusType) {
                return;
            }

            // Capturar errores de WhatsApp si el mensaje falló
            $errorInfo = null;
            if ($statusType === 'failed') {
                $errorInfo = $status['errors'] ?? [];
                $recipientId = $status['recipient_id'] ?? 'unknown';
                
                // Obtener código de error específico
                $errorCode = $errorInfo[0]['code'] ?? 'N/A';
                $errorTitle = $errorInfo[0]['title'] ?? 'N/A';
                $errorMessage = $errorInfo[0]['message'] ?? 'N/A';
                
                Log::error('=== WHATSAPP MESSAGE FAILED ===', [
                    'message_id' => $messageId,
                    'recipient_phone' => $recipientId,
                    'error_code' => $errorCode,
                    'error_title' => $errorTitle,
                    'error_message' => $errorMessage,
                    'full_errors' => $errorInfo
                ]);
            }

            // Actualizar estado del mensaje en la base de datos
            $message = \App\Models\Message::where('whatsapp_message_id', $messageId)->first();
            if ($message) {
                $message->update(['status' => $statusType]);

                // Si el mensaje era de envío masivo y falló, actualizar contadores del BulkSend
                if ($statusType === 'failed' && str_contains($message->content ?? '', '[Envío masivo:')) {
                    // Buscar el BulkSend correspondiente y ajustar contadores
                    $bulkSendName = null;
                    if (preg_match('/\[Envío masivo: (.+?)\]/', $message->content, $matches)) {
                        $bulkSendName = $matches[1];
                    }
                    if ($bulkSendName) {
                        $bulkSend = \App\Models\BulkSend::where('name', $bulkSendName)->latest()->first();
                        if ($bulkSend) {
                            $bulkSend->decrement('sent_count');
                            $bulkSend->increment('failed_count');
                        }
                    }
                }
            }

            Log::info('Message status updated', [
                'message_id' => $messageId,
                'status' => $statusType,
                'has_errors' => !empty($errorInfo)
            ]);

        } catch (\Exception $e) {
            Log::error('Process message status error', [
                'error' => $e->getMessage(),
                'status' => $status,
            ]);
        }
    }
}
