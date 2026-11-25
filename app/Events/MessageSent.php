<?php

namespace App\Events;

use App\Models\Message;
use App\Models\Conversation;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

class MessageSent
{
    use Dispatchable, InteractsWithSockets;

    // Usar propiedades simples en lugar de SerializesModels para evitar fugas de memoria
    public int $messageId;
    public int $conversationId;
    public string $content;
    public bool $isFromUser;
    public ?int $sentBy;

    /**
     * Create a new event instance.
     */
    public function __construct(Message $message, Conversation $conversation)
    {
        // Solo extraer datos necesarios, no almacenar modelos completos
        $this->messageId = $message->id;
        $this->conversationId = $conversation->id;
        $this->content = $message->content;
        $this->isFromUser = $message->is_from_user;
        $this->sentBy = $message->sent_by;
    }

    /**
     * Get the channels the event should broadcast on.
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
        return [];
    }
}
