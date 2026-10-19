<?php

namespace App\Events;

use App\Models\Message;
use App\Models\Conversation;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

class NewMessageReceived
{
    use Dispatchable, InteractsWithSockets;

    // Datos primitivos para evitar fugas de memoria
    public array $messageData;
    public array $conversationData;

    /**
     * Create a new event instance.
     */
    public function __construct(Message $message, Conversation $conversation)
    {
        // Extraer solo datos necesarios, no modelos completos
        $this->messageData = [
            'id' => $message->id,
            'conversation_id' => $message->conversation_id,
            'content' => $message->content,
            'message_type' => $message->message_type,
            'is_from_user' => $message->is_from_user,
            'status' => $message->status,
            'created_at' => $message->created_at->toISOString(),
        ];

        $this->conversationData = [
            'id' => $conversation->id,
            'phone_number' => $conversation->phone_number,
            'contact_name' => $conversation->contact_name,
            'unread_count' => $conversation->unread_count,
            'last_message_at' => $conversation->last_message_at?->toISOString(),
        ];
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    /**
     * Ya no se difunde (no implementa ShouldBroadcast; los avisos van por App\Support\TiempoReal). Si alguien lo
     * reactivara, saldría por el canal PRIVADO del personal y sin datos: nunca texto de pacientes por un canal público.
     */
    public function broadcastOn(): array
    {
        return [new \Illuminate\Broadcasting\PrivateChannel('conversaciones')];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'new.message';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [];
    }
}
