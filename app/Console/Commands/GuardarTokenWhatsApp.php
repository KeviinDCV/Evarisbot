<?php

namespace App\Console\Commands;

use App\Models\Setting;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * Guarda el token de acceso de Meta (WhatsApp Cloud API) desde la consola del servidor.
 *
 * El token se pide sin mostrarlo en pantalla, se comprueba contra Meta antes de guardarlo y
 * queda cifrado en settings (igual que hacía la pantalla de Configuración). Solo imprime una
 * versión enmascarada y su huella, para poder verificarlo sin exponerlo.
 */
class GuardarTokenWhatsApp extends Command
{
    protected $signature = 'whatsapp:guardar-token';

    protected $description = 'Guarda el token de Meta desde la consola (sin pasar por la web), tras comprobar que funciona';

    public function handle(): int
    {
        $phoneId = Setting::get('whatsapp_phone_id');
        $waba = Setting::get('whatsapp_business_account_id');

        if (empty($phoneId) || empty($waba)) {
            $this->error('Faltan el ID del número o el ID de la cuenta de WhatsApp Business en la configuración.');
            return self::FAILURE;
        }

        $token = trim((string) $this->secret('Pega el token nuevo de Meta (no se mostrará al escribirlo) y pulsa Enter'));

        if (strlen($token) < 50 || preg_match('/\s/', $token)) {
            $this->error('Eso no parece un token de Meta (muy corto o con espacios). No se guardó nada.');
            return self::FAILURE;
        }

        $this->line('Comprobando el token con Meta...');

        $numero = Http::withToken($token)->timeout(20)
            ->get("https://graph.facebook.com/v21.0/{$phoneId}", ['fields' => 'verified_name,status']);

        if (! $numero->successful()) {
            $this->error('Meta rechazó el token: ' . ($numero->json('error.message') ?? ('HTTP ' . $numero->status())) . '. No se guardó nada.');
            return self::FAILURE;
        }

        // El permiso de administración hace falta para revisar o quitar la redirección del webhook.
        $suscripcion = Http::withToken($token)->timeout(20)
            ->get("https://graph.facebook.com/v21.0/{$waba}/subscribed_apps");

        Setting::set('whatsapp_token', $token, 'Token de acceso de WhatsApp Business API');

        $this->info('Token guardado (cifrado) para: ' . ($numero->json('verified_name') ?? 'número verificado') . '.');
        $this->line('Huella del token: ' . substr(hash('sha256', $token), 0, 16) . '  ·  ' . substr($token, 0, 6) . '…' . substr($token, -4));

        if (! $suscripcion->successful()) {
            $this->warn('Aviso: el token no puede leer la suscripción de la cuenta (' . ($suscripcion->json('error.message') ?? 'HTTP ' . $suscripcion->status())
                . '). Falta el permiso whatsapp_business_management: sin él no se puede quitar la redirección del webhook.');
        }

        return self::SUCCESS;
    }
}
