<?php

namespace App\Http\Middleware;

use App\Models\Setting;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * Comprueba que cada aviso que llega a POST /webhook/whatsapp venga firmado por Meta
 * (cabecera X-Hub-Signature-256 = HMAC-SHA256 del cuerpo con el App Secret de la app).
 *
 * Sin esto, cualquiera en internet que conozca la dirección del webhook puede meter mensajes
 * falsos "de un paciente" en la bandeja o confirmar y cancelar citas.
 *
 * Tres estados, para no perder nunca mensajes reales por un App Secret mal copiado:
 *  - Sin App Secret guardado: no se comprueba nada (igual que antes).
 *  - Modo "observar" (por defecto al guardar el App Secret): se comprueba, se cuenta y se registra,
 *    pero el aviso se procesa igual.
 *  - Modo "exigir": un aviso sin firma válida se rechaza con 403 sin tocar la base.
 * El App Secret y el modo se cambian solo por consola: php artisan whatsapp:firma
 */
class VerifyMetaSignature
{
    public const KEY_SECRET = 'whatsapp_app_secret';

    public const KEY_MODE = 'whatsapp_signature_mode';

    public const MODE_ENFORCE = 'exigir';

    public const MODE_OBSERVE = 'observar';

    /** Contadores desde que se guardó el App Secret (los lee whatsapp:firma). */
    public const COUNTERS = ['validas', 'invalidas', 'sin_firma'];

    public function handle(Request $request, Closure $next): Response
    {
        $secret = Setting::get(self::KEY_SECRET);

        if (! is_string($secret) || $secret === '') {
            return $next($request);
        }

        $header = (string) $request->header('X-Hub-Signature-256', '');
        $expected = 'sha256='.hash_hmac('sha256', $request->getContent(), $secret);
        $valid = $header !== '' && hash_equals($expected, $header);

        self::count($valid ? 'validas' : ($header === '' ? 'sin_firma' : 'invalidas'));

        if ($valid) {
            return $next($request);
        }

        $enforce = Setting::get(self::KEY_MODE) === self::MODE_ENFORCE;

        Log::warning('Webhook de WhatsApp con firma '.($header === '' ? 'ausente' : 'inválida'), [
            'modo' => $enforce ? self::MODE_ENFORCE : self::MODE_OBSERVE,
            'ip' => $request->ip(),
            'bytes' => strlen($request->getContent()),
        ]);

        if ($enforce) {
            return response('Forbidden', 403);
        }

        return $next($request);
    }

    public static function count(string $counter): void
    {
        try {
            $key = 'webhook_firma.'.$counter;
            Cache::add($key, 0, now()->addDays(60));
            Cache::increment($key);
        } catch (\Throwable $e) {
            // Un contador nunca debe frenar la entrada de mensajes.
        }
    }

    public static function counters(): array
    {
        $out = [];
        foreach (self::COUNTERS as $c) {
            $out[$c] = (int) Cache::get('webhook_firma.'.$c, 0);
        }

        return $out;
    }

    public static function resetCounters(): void
    {
        foreach (self::COUNTERS as $c) {
            Cache::forget('webhook_firma.'.$c);
        }
    }
}
