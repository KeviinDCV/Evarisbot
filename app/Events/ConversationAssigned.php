<?php

namespace App\Events;

use App\Models\Conversation;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

class ConversationAssigned
{
    use Dispatchable, InteractsWithSockets;

    public int $conversationId;
    public int $assignedTo;
    public string $status;

    public function __construct(Conversation $conversation)
    {
        $this->conversationId = $conversation->id;
        $this->assignedTo     = $conversation->assigned_to;
        $this->status         = $conversation->status;
    }

    /**
     * Ya no se difunde (no implementa ShouldBroadcast; los avisos van por App\Support\TiempoReal). Si alguien lo
     * reactivara, saldría por el canal PRIVADO del personal y sin datos: nunca texto de pacientes por un canal público.
     */
    public function broadcastOn(): array
    {
        return [new \Illuminate\Broadcasting\PrivateChannel('conversaciones')];
    }

    public function broadcastAs(): string
    {
        return 'conversation.assigned';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
