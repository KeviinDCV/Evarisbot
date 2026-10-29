<?php

namespace App\Console\Commands;

use App\Models\Setting;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

/**
 * Cambia la clave de verificación del webhook (la que Meta pide al registrar la dirección).
 * La actual es la que quedó publicada en GitHub. Cambiarla aquí no corta nada: Meta solo la usa
 * cuando se pulsa «Verificar y guardar» en la configuración del webhook. Por eso hay que pegar la
 * nueva en Meta en ese mismo momento; si no, la próxima verificación fallará.
 */
class ClaveVerificacionWebhook extends Command
{
    protected $signature = 'whatsapp:clave-verificacion';

    protected $description = 'Genera una clave de verificación nueva para el webhook de WhatsApp (hay que pegarla en Meta)';

    public function handle(): int
    {
        $this->warn('Solo continúe si va a pegar la clave nueva en Meta ahora mismo:');
        $this->line('developers.facebook.com › la app › WhatsApp › Configuración › Webhook › Editar › «Token de verificación» › Verificar y guardar.');

        if (! $this->confirm('¿Generar y guardar una clave nueva?', false)) {
            $this->line('No se cambió nada.');

            return self::SUCCESS;
        }

        $clave = Str::random(40);
        Setting::set('whatsapp_verify_token', $clave, 'Token de verificación del webhook');

        $this->newLine();
        $this->info('Clave nueva guardada (cifrada). Cópiela en Meta; no se volverá a mostrar:');
        $this->line('    '.$clave);
        $this->newLine();
        $this->line('Huella: '.substr(hash('sha256', $clave), 0, 16));

        return self::SUCCESS;
    }
}
