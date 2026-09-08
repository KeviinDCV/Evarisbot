<?php

namespace App\Console\Commands;

use App\Services\AiChatTimeoutService;
use Illuminate\Console\Command;

/**
 * Revisa la inactividad en los chats con la IA: recordatorio "¿Sigues ahí?"
 * a los 5 min y reinicio del historial a los 10 min (umbrales configurables).
 * Pensado para ejecutarse cada minuto desde el programador de tareas.
 */
class AiCheckTimeouts extends Command
{
    protected $signature = 'ai:check-timeouts';
    protected $description = 'Chat IA: recordatorio "¿Sigues ahí?" a los 5 min y reinicio del historial a los 10 min de inactividad';

    public function handle(AiChatTimeoutService $service): int
    {
        $results = $service->checkAll();

        foreach ($results as $chatId => $action) {
            $icon = $action === 'reset' ? '🔄 reiniciado' : '⏳ recordatorio';
            $this->line("Chat #{$chatId}: {$icon}");
        }

        if (empty($results)) {
            $this->line('Sin acciones de timeout.');
        }

        return self::SUCCESS;
    }
}
