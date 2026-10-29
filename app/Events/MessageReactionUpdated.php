<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

class MessageReactionUpdated
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(
        public int $conversationId,
        public int $messageId,
        public ?string $emoji,
        public bool $fromUser,
        public bool $removed,
    ) {
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
        return 'message.reaction';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
