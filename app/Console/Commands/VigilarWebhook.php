<?php

namespace App\Console\Commands;

use App\Services\WebhookWatchdog;
use Illuminate\Console\Command;

/**
 * Ejecuta ahora la vigilancia (la misma que corre sola cada 10 minutos con el uso de la app) y muestra el resultado.
 */
class VigilarWebhook extends Command
{
    protected $signature = 'whatsapp:vigilar';

    protected $description = 'Revisa ahora el webhook en Meta, la entrada de mensajes, la cola y el disco';

    public function handle(WebhookWatchdog $watchdog): int
    {
        $alerts = $watchdog->run();

        if ($alerts === []) {
            $this->info('Todo en orden: webhook sin desvíos, token aceptado, mensajes entrando, cola y disco bien.');

            return self::SUCCESS;
        }

        foreach ($alerts as $code => $text) {
            $this->error("[{$code}] {$text}");
        }

        return self::FAILURE;
    }
}
