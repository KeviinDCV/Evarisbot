<?php

namespace App\Events;

use App\Models\Message;
use App\Models\Conversation;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $message;
    public $conversation;

    /**
     * Create a new event instance.
     */
    public function __construct(Message $message, Conversation $conversation)
    {
        $this->message = $message;
        $this->conversation = $conversation;
    }

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn(): array
    {
        return [
            new Channel('conversations'),
        ];
    }

    /**
     * El nombre del evento que se escuchará en el frontend
     */
    public function broadcastAs(): string
    {
        return 'new.message';
    }

    /**
     * Los datos que se enviarán al frontend
     */
    public function broadcastWith(): array
    {
        return [
            'message_id' => $this->message->id,
            'conversation_id' => $this->conversation->id,
            'content' => $this->message->content,
            'is_from_user' => $this->message->is_from_user,
            'sent_by' => $this->message->sent_by,
            'created_at' => $this->message->created_at,
        ];
    }
}
