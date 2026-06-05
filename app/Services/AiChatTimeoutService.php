<?php

namespace App\Services;

use App\Models\InternalChat;
use App\Models\InternalChatParticipant;
use App\Models\InternalMessage;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * Maneja la inactividad en los chats con la IA ("IA - Prueba"):
 *   - A los N minutos sin respuesta del usuario → mensaje "¿Sigues ahí?" (una sola vez).
 *   - A los M minutos sin respuesta → reinicia el historial del chat.
 *
 * Umbrales configurables vía Settings: ai_nudge_minutes (5) y ai_reset_minutes (10).
 */
class AiChatTimeoutService
{
    public function nudgeMinutes(): int
    {
        return max(1, (int) (Setting::get('ai_nudge_minutes') ?: 5));
    }

    public function resetMinutes(): int
    {
        return max(2, (int) (Setting::get('ai_reset_minutes') ?: 10));
    }

    /**
     * Revisar TODOS los chats con la IA (lo usa el comando programado).
     *
     * @return array<int, string>  [chat_id => 'nudged'|'reset']
     */
    public function checkAll(): array
    {
        $ai = User::aiUser();
        if (!$ai) {
            return [];
        }

        $chatIds = InternalChatParticipant::where('user_id', $ai->id)->pluck('internal_chat_id');

        $results = [];
        foreach (InternalChat::whereIn('id', $chatIds)->get() as $chat) {
            if ($action = $this->check($chat, $ai)) {
                $results[$chat->id] = $action;
            }
        }

        return $results;
    }

    /**
     * Revisar un chat concreto. Devuelve 'nudged', 'reset' o null.
     */
    public function check(InternalChat $chat, ?User $ai = null): ?string
    {
        $ai = $ai ?: User::aiUser();
        if (!$ai || !$chat->hasParticipant($ai->id)) {
            return null;
        }

        $lastMsg = $chat->messages()->latest()->first();
        if (!$lastMsg) {
            return null;
        }

        // Último mensaje escrito por el usuario (no por la IA)
        $lastUserMsg = $chat->messages()->where('user_id', '!=', $ai->id)->latest()->first();
        if (!$lastUserMsg) {
            return null; // el usuario aún no ha participado
        }

        // Solo actuamos cuando la IA está esperando respuesta (su mensaje es el último)
        if ($lastMsg->user_id !== $ai->id) {
            return null;
        }

        $now = now();
        $minutes = $lastUserMsg->created_at->diffInMinutes($now);
        $nudgeAt = $this->nudgeMinutes();
        $resetAt = $this->resetMinutes();

        // Menos del umbral de aviso: actividad reciente, limpiar bandera de aviso
        if ($minutes < $nudgeAt) {
            if ($chat->ai_nudged_at) {
                $chat->update(['ai_nudged_at' => null]);
            }
            return null;
        }

        // Pasado el umbral de reinicio: borrar el historial del chat
        if ($minutes >= $resetAt) {
            $chat->messages()->delete();
            $chat->update(['ai_nudged_at' => null]);
            InternalChatParticipant::where('internal_chat_id', $chat->id)
                ->update(['last_read_at' => $now]);

            Log::info('AI chat: historial reiniciado por inactividad', [
                'chat_id' => $chat->id,
                'minutes' => $minutes,
            ]);

            return 'reset';
        }

        // Entre el umbral de aviso y el de reinicio: enviar "¿Sigues ahí?" una sola vez
        if (!$chat->ai_nudged_at) {
            InternalMessage::create([
                'internal_chat_id' => $chat->id,
                'user_id'          => $ai->id,
                'body'             => '👋 ¿Sigues ahí? Seguimos cuando quieras, justo donde lo dejamos. 🙂',
                'type'             => 'text',
            ]);
            $chat->update(['ai_nudged_at' => $now]);

            Log::info('AI chat: recordatorio "¿Sigues ahí?" enviado', [
                'chat_id' => $chat->id,
                'minutes' => $minutes,
            ]);

            return 'nudged';
        }

        return null;
    }
}
