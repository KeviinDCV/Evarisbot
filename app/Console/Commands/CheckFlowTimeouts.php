<?php

namespace App\Console\Commands;

use App\Models\Conversation;
use App\Models\Message;
use App\Services\WhatsAppService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class CheckFlowTimeouts extends Command
{
    protected $signature = 'flow:check-timeouts';
    protected $description = 'Envía recordatorio a los 5 min y cierra conversaciones inactivas a los 10 min durante el flujo de bienvenida';

    public function handle(WhatsAppService $whatsappService): void
    {
        if (!$whatsappService->isConfigured()) {
            return;
        }

        $now = now();

        // Buscar conversaciones en medio del flujo de bienvenida (no completado, con paso activo)
        $conversations = Conversation::where('status', 'active')
            ->where('welcome_flow_completed', false)
            ->whereNotNull('welcome_flow_step')
            ->whereNotNull('last_message_at')
            ->get();

        foreach ($conversations as $conversation) {
            $minutesInactive = $conversation->last_message_at->diffInMinutes($now);

            // Ya se envió recordatorio? Verificar en flow_data
            $flowData = $conversation->welcome_flow_data ?? [];
            $reminderSent = $flowData['_timeout_reminder_sent'] ?? false;

            if ($minutesInactive >= 10) {
                // 10+ minutos: resolver/cerrar la conversación
                $closeMsg = "⏰ Tu sesión ha expirado por inactividad.\n\nSi necesitas ayuda, escríbenos nuevamente y con gusto te atenderemos. 😊\n\n_HUV - Evaristo García_ 💙";

                $result = $whatsappService->sendTextMessage($conversation->phone_number, $closeMsg);
                if ($result['success'] ?? false) {
                    Message::create([
                        'conversation_id' => $conversation->id,
                        'content' => $closeMsg,
                        'message_type' => 'text',
                        'is_from_user' => false,
                        'whatsapp_message_id' => $result['message_id'] ?? null,
                        'status' => 'sent',
                        'sent_by' => null,
                    ]);
                }

                $conversation->update([
                    'status' => 'resolved',
                    'welcome_flow_step' => null,
                    'welcome_flow_completed' => false,
                    'welcome_flow_data' => null,
                    'resolved_at' => $now,
                ]);

                Log::info('Flow timeout: conversation closed (10 min)', [
                    'conversation_id' => $conversation->id,
                    'phone' => $conversation->phone_number,
                    'inactive_minutes' => $minutesInactive,
                ]);

                $this->line("❌ Cerrada: {$conversation->phone_number} ({$minutesInactive} min inactivo)");

            } elseif ($minutesInactive >= 5 && !$reminderSent) {
                // 5+ minutos sin recordatorio: enviar recordatorio
                $reminderMsg = "⏳ ¿Sigues ahí? No hemos recibido tu respuesta.\n\nPor favor continúa con el proceso para poder atenderte. Si no respondes en los próximos minutos, la sesión se cerrará automáticamente.";

                $result = $whatsappService->sendTextMessage($conversation->phone_number, $reminderMsg);
                if ($result['success'] ?? false) {
                    Message::create([
                        'conversation_id' => $conversation->id,
                        'content' => $reminderMsg,
                        'message_type' => 'text',
                        'is_from_user' => false,
                        'whatsapp_message_id' => $result['message_id'] ?? null,
                        'status' => 'sent',
                        'sent_by' => null,
                    ]);
                }

                // Marcar que ya se envió recordatorio (sin cambiar last_message_at)
                $flowData['_timeout_reminder_sent'] = true;
                $conversation->update(['welcome_flow_data' => $flowData]);

                Log::info('Flow timeout: reminder sent (5 min)', [
                    'conversation_id' => $conversation->id,
                    'phone' => $conversation->phone_number,
                    'inactive_minutes' => $minutesInactive,
                ]);

                $this->line("⏳ Recordatorio: {$conversation->phone_number} ({$minutesInactive} min inactivo)");
            }
        }
    }
}
