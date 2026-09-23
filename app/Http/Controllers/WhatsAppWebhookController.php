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

        // FALLAR CERRADO. Setting::get() devuelve null si la fila no existe o su valor está
        // vacío, y un hub_verify_token omitido también es null: sin esta guarda la condición
        // null === null dejaba pasar la verificación SIN secreto y reflejaba el challenge a
        // cualquiera. (SettingsController valida el token como 'nullable', así que un admin
        // podía vaciarlo desde la UI y abrir el hueco en silencio.)
        if (!is_string($verifyToken) || $verifyToken === '') {
            Log::error('Webhook verify rechazado: whatsapp_verify_token no está configurado');
            return response('Forbidden', 403);
        }

        // hash_equals: comparación en tiempo constante, no filtra el token por timing.
        if ($mode === 'subscribe' && is_string($token) && hash_equals($verifyToken, $token)) {
            Log::info('Webhook verified successfully');
            // text/plain: aunque el challenge se refleje, nunca se interpreta como HTML.
            // No se castea a int: Meta manda un challenge numérico, pero forzarlo rompería
            // la verificación si alguna vez no lo fuera. text/plain ya neutraliza el reflejo.
            return response((string) $challenge, 200, ['Content-Type' => 'text/plain']);
        }

        // No se registra el token recibido: es dato controlado por quien llama.
        Log::warning('Webhook verification failed', [
            'mode' => $mode,
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
                $updateData = ['status' => $statusType];
                
                // Si falló, guardar el motivo del error para mostrarlo en el frontend
                if ($statusType === 'failed' && !empty($errorInfo)) {
                    $errorCode = $errorInfo[0]['code'] ?? null;
                    $errorTitle = $errorInfo[0]['title'] ?? 'Error desconocido';
                    $errorMsg = $errorCode ? "{$errorTitle} (code: {$errorCode})" : $errorTitle;
                    $updateData['error_message'] = $errorMsg;
                }

                // Capturar datos de facturación que Meta envía en los callbacks
                // 'sent'/'delivered' (objetos `pricing` y `conversation`) para el
                // panel de costos. Solo se escriben si vienen: así un callback
                // posterior ('read') no borra lo ya capturado.
                $this->fillBillingData($status, $updateData);

                $message->update($updateData);

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

                            // Buscar el destinatario correspondiente y marcarlo como fallido
                            // con el motivo del error reportado por WhatsApp.
                            $recipientPhone = $status['recipient_id'] ?? null;
                            if ($recipientPhone) {
                                $errorCodeMsg = $errorInfo[0]['code'] ?? null;
                                $errorTitleMsg = $errorInfo[0]['title'] ?? null;
                                $errorDetail = $errorInfo[0]['error_data']['details'] ?? ($errorInfo[0]['message'] ?? null);
                                // Mensaje claro en español para el usuario (sin códigos técnicos)
                                $finalErrorMsg = \App\Support\WhatsAppErrorTranslator::human($errorCodeMsg, $errorTitleMsg, $errorDetail);

                                // El recipient phone puede venir sin prefijo "+" — comparar tolerante.
                                $digits = preg_replace('/\D/', '', (string) $recipientPhone);
                                $last10 = substr($digits, -10);

                                $recipient = \App\Models\BulkSendRecipient::where('bulk_send_id', $bulkSend->id)
                                    ->where(function ($q) use ($digits, $last10) {
                                        $q->where('phone_number', $digits)
                                          ->orWhere('phone_number', '+' . $digits)
                                          ->orWhere('phone_number', 'like', '%' . $last10);
                                    })
                                    ->first();

                                if ($recipient) {
                                    $recipient->update([
                                        'status' => 'failed',
                                        'error' => $finalErrorMsg,
                                    ]);
                                } else {
                                    Log::warning('No se encontró BulkSendRecipient para webhook failed', [
                                        'bulk_send_id' => $bulkSend->id,
                                        'recipient_phone' => $recipientPhone,
                                    ]);
                                }
                            }
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

    /**
     * Extrae los datos de facturación del status de Meta y los agrega a $updateData
     * (por referencia). Meta manda `pricing` y `conversation` en los callbacks
     * 'sent'/'delivered'. Solo se agregan las llaves presentes para no sobrescribir
     * con null lo capturado en un callback anterior.
     */
    private function fillBillingData(array $status, array &$updateData): void
    {
        $pricing = $status['pricing'] ?? null;
        if (is_array($pricing)) {
            if (array_key_exists('billable', $pricing)) {
                $updateData['billable'] = (bool) $pricing['billable'];
            }
            if (!empty($pricing['category'])) {
                $updateData['pricing_category'] = $pricing['category'];
            }
            if (!empty($pricing['pricing_model'])) {
                $updateData['pricing_model'] = $pricing['pricing_model'];
            }
        }

        $conversation = $status['conversation'] ?? null;
        if (is_array($conversation)) {
            if (!empty($conversation['id'])) {
                $updateData['wa_conversation_id'] = $conversation['id'];
            }
            if (!empty($conversation['origin']['type'])) {
                $updateData['conversation_origin_type'] = $conversation['origin']['type'];
            }
        }
    }
}
