<?php

namespace App\Events;

use App\Models\Conversation;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

class ConversationAssigned implements ShouldBroadcastNow
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

    public function broadcastOn(): array
    {
        return [
            new Channel('conversations'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'conversation.assigned';
    }

    public function broadcastWith(): array
    {
        return [
            'conversation_id' => $this->conversationId,
            'assigned_to'     => $this->assignedTo,
            'status'          => $this->status,
        ];
    }
}
