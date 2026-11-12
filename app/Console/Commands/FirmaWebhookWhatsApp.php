<?php

namespace App\Console\Commands;

use App\Http\Middleware\VerifyMetaSignature;
use App\Models\Setting;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * Verificación de la firma de Meta en la entrada de WhatsApp (ver VerifyMetaSignature).
 *
 *   php artisan whatsapp:firma            → estado y contadores
 *   php artisan whatsapp:firma --guardar  → pide el App Secret (oculto), lo comprueba con Meta y lo guarda cifrado; queda en "observar"
 *   php artisan whatsapp:firma --exigir   → rechazar lo que no venga firmado (solo si ya llegaron avisos con firma válida)
 *   php artisan whatsapp:firma --observar → volver a solo registrar
 *
 * El App Secret se copia (no se cambia) en developers.facebook.com › la app › Configuración › Básica.
 */
class FirmaWebhookWhatsApp extends Command
{
    protected $signature = 'whatsapp:firma {--guardar : Guardar el App Secret} {--exigir : Rechazar avisos sin firma válida} {--observar : Solo registrar}';

    protected $description = 'Firma de Meta en el webhook de WhatsApp: guardar el App Secret y elegir si se exige';

    public function handle(): int
    {
        if ($this->option('guardar')) {
            return $this->guardar();
        }

        if ($this->option('exigir')) {
            return $this->exigir();
        }

        if ($this->option('observar')) {
            Setting::set(VerifyMetaSignature::KEY_MODE, VerifyMetaSignature::MODE_OBSERVE, 'Firma de Meta en el webhook: solo registrar');
            $this->info('Modo "observar": los avisos sin firma válida se registran pero se procesan.');

            return self::SUCCESS;
        }

        return $this->estado();
    }

    private function estado(): int
    {
        $secret = Setting::get(VerifyMetaSignature::KEY_SECRET);
        $mode = Setting::get(VerifyMetaSignature::KEY_MODE) === VerifyMetaSignature::MODE_ENFORCE ? 'exigir' : 'observar';

        if (! is_string($secret) || $secret === '') {
            $this->warn('App Secret: no guardado. La firma de Meta NO se comprueba (cualquiera que conozca la dirección puede enviar avisos falsos).');
            $this->line('Para activarla: php artisan whatsapp:firma --guardar');

            return self::SUCCESS;
        }

        $c = VerifyMetaSignature::counters();
        $this->info('App Secret: guardado · huella '.substr(hash('sha256', $secret), 0, 16));
        $this->line('Modo: '.$mode);
        $this->table(['Firma válida', 'Firma inválida', 'Sin firma'], [[$c['validas'], $c['invalidas'], $c['sin_firma']]]);

        return self::SUCCESS;
    }

    private function guardar(): int
    {
        $token = Setting::get('whatsapp_token');
        $phoneId = Setting::get('whatsapp_phone_id');

        $secret = strtolower(trim((string) $this->secret('Pega el App Secret de la app de Meta (no se mostrará) y pulsa Enter')));

        if (! preg_match('/^[0-9a-f]{32}$/', $secret)) {
            $this->error('Eso no parece un App Secret (son 32 caracteres hexadecimales). No se guardó nada.');

            return self::FAILURE;
        }

        // Meta rechaza un appsecret_proof calculado con un App Secret que no es el de la app del token.
        if (is_string($token) && $token !== '' && $phoneId) {
            $this->line('Comprobando el App Secret con Meta...');
            $r = Http::timeout(20)->get("https://graph.facebook.com/v21.0/{$phoneId}", [
                'fields' => 'id',
                'access_token' => $token,
                'appsecret_proof' => hash_hmac('sha256', $token, $secret),
            ]);

            if (! $r->successful()) {
                $this->error('Meta no aceptó el App Secret: '.($r->json('error.message') ?? 'HTTP '.$r->status()).'. No se guardó nada.');
                $this->line('Copie el de la misma app que generó el token (la app suscrita al webhook).');

                return self::FAILURE;
            }
        } else {
            $this->warn('No hay token guardado para comprobar el App Secret con Meta; se guarda sin comprobar.');
        }

        Setting::set(VerifyMetaSignature::KEY_SECRET, $secret, 'App Secret de la app de Meta (firma del webhook)');
        Setting::set(VerifyMetaSignature::KEY_MODE, VerifyMetaSignature::MODE_OBSERVE, 'Firma de Meta en el webhook: solo registrar');
        VerifyMetaSignature::resetCounters();

        $this->info('App Secret guardado (cifrado) · huella '.substr(hash('sha256', $secret), 0, 16).'. Modo "observar".');
        $this->line('Deje pasar uno o dos días con mensajes reales y revise con: php artisan whatsapp:firma');
        $this->line('Si todas las firmas salen válidas, active el rechazo con: php artisan whatsapp:firma --exigir');

        return self::SUCCESS;
    }

    private function exigir(): int
    {
        $secret = Setting::get(VerifyMetaSignature::KEY_SECRET);
        if (! is_string($secret) || $secret === '') {
            $this->error('Primero guarde el App Secret: php artisan whatsapp:firma --guardar');

            return self::FAILURE;
        }

        $c = VerifyMetaSignature::counters();
        $this->table(['Firma válida', 'Firma inválida', 'Sin firma'], [[$c['validas'], $c['invalidas'], $c['sin_firma']]]);

        if ($c['validas'] < 20) {
            $this->error('Todavía no han llegado suficientes avisos con firma válida (mínimo 20). Si exige ahora podría rechazar mensajes reales.');

            return self::FAILURE;
        }

        if (($c['invalidas'] + $c['sin_firma']) > 0) {
            $this->warn('Hubo avisos sin firma válida. Pueden ser intentos falsos (se rechazarán) o un App Secret equivocado.');
        }

        if (! $this->confirm('¿Rechazar desde ahora todo aviso sin firma válida de Meta?', false)) {
            $this->line('No se cambió nada.');

            return self::SUCCESS;
        }

        Setting::set(VerifyMetaSignature::KEY_MODE, VerifyMetaSignature::MODE_ENFORCE, 'Firma de Meta en el webhook: exigir');
        $this->info('Modo "exigir" activo. Para volver atrás: php artisan whatsapp:firma --observar');

        return self::SUCCESS;
    }
}
