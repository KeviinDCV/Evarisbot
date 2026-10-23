<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * Aviso de tiempo real: «algo cambió en esta conversación» (o en este chat interno). Lleva solo el tipo y los ids,
 * NUNCA datos de pacientes: al recibirlo, la pantalla pide los datos por las rutas de siempre, que aplican los
 * permisos de cada asesor (un asesor no ve más que lo que ya podía ver).
 *
 * Canales PRIVADOS (autorizados en routes/channels.php con la sesión): 'conversaciones' para el personal y
 * 'App.Models.User.{id}' para el chat interno. No se envía nunca por TiempoReal directamente: ver App\Support\TiempoReal.
 */
class AvisoTiempoReal implements ShouldBroadcastNow
{
    /**
     * @param  array<string, int|array<int>>  $datos  solo ids (conversation_id, conversation_ids, chat_id)
     * @param  array<string>  $canales  nombres de canal privado, sin el prefijo «private-»
     */
    public function __construct(
        public string $tipo,
        public array $datos,
        public array $canales,
    ) {}

    public function broadcastOn(): array
    {
        return array_map(fn (string $canal) => new PrivateChannel($canal), $this->canales);
    }

    public function broadcastAs(): string
    {
        return 'aviso';
    }

    public function broadcastWith(): array
    {
        return ['tipo' => $this->tipo] + $this->datos;
    }
}
