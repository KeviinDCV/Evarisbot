<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Vigilancia de la entrada de WhatsApp y del envío en segundo plano.
 *
 * En el incidente de octubre de 2026 un tercero desvió el webhook y la bandeja pasó ~56 horas sin
 * recibir mensajes sin que nadie se enterara. Esto revisa cada 10 minutos (al terminar una petición
 * web, como la liberación automática, porque en este servidor no corre el programador de Laravel):
 *
 *  - que en Meta no haya un desvío del webhook (override) ni otra dirección distinta de la nuestra;
 *  - que Meta siga aceptando el token;
 *  - que no aparezcan plantillas nuevas en la cuenta que no se crearon desde aquí;
 *  - que entren mensajes de pacientes en horario de atención;
 *  - que el worker esté procesando la cola y no se disparen los envíos fallidos;
 *  - que quede espacio en el disco.
 *
 * Solo lee. Las alertas quedan en caché (franja roja para administradores) y en el log como CRITICAL.
 * Consola: php artisan whatsapp:vigilar
 */
class WebhookWatchdog
{
    public const EVERY_SECONDS = 600;

    private const STAMP = 'framework/cache/vigilancia.stamp';

    public const KEY_ALERTS = 'vigilancia:alertas';

    public const KEY_CHECKED_AT = 'vigilancia:revisado_en';

    private const KEY_TEMPLATE_BASELINE = 'vigilancia:plantillas_base';

    /** Última vez que Meta respondió de verdad a la consulta del número (la pantalla no dice
     *  «Funcionando» solo porque la vigilancia corrió: si Meta no contestó, no se sabe). */
    public const KEY_META_OK = 'vigilancia:meta_ok_en';

    /** Errores de Graph pasajeros o de límite de uso: no dicen nada del token; se mira otra vez luego. */
    private const ERRORES_PASAJEROS = [1, 2, 4, 17, 32, 341, 613, 80007, 130429];

    /** Qué partes de Meta se pudieron revisar en esta vuelta ('numero', 'desvio'). */
    private array $revisado = [];

    /** Silencio máximo de mensajes entrantes en horario de atención (lun–vie 7:00–17:00, hora Colombia). */
    private const SILENCE_MINUTES = 45;

    public static function runIfDue(): void
    {
        try {
            $stamp = storage_path(self::STAMP);
            clearstatcache(true, $stamp);
            if (is_file($stamp) && (time() - filemtime($stamp)) < self::EVERY_SECONDS) {
                return;
            }
            @touch($stamp);

            if (! Cache::add('vigilancia:corriendo', 1, self::EVERY_SECONDS - 5)) {
                return;
            }

            app(self::class)->run();
        } catch (\Throwable $e) {
            Log::warning('Vigilancia: la revisión falló', ['error' => $e->getMessage()]);
        }
    }

    /**
     * @return array<string, string> código => mensaje para el administrador
     */
    public function run(): array
    {
        // Cualquier ejecución (automática, «Comprobar ahora» o whatsapp:vigilar) aplaza la siguiente
        // automática: así el terminating de esta misma petición no la repite enseguida.
        @touch(storage_path(self::STAMP));

        $alerts = [];
        $this->revisado = [];

        foreach (['checkMeta', 'checkSilence', 'checkQueue', 'checkDisk'] as $check) {
            try {
                $alerts += $this->{$check}();
            } catch (\Throwable $e) {
                Log::warning("Vigilancia: {$check} falló", ['error' => $e->getMessage()]);
            }
        }

        $previous = (array) Cache::get(self::KEY_ALERTS, []);

        // Lo que no se pudo revisar esta vez (Meta no respondió) no se da por resuelto: se conservan
        // las alertas de Meta de la vuelta anterior en vez de borrar la franja y anotar «resuelta».
        foreach ($previous as $code => $text) {
            $deMeta = str_starts_with((string) $code, 'meta_') && $code !== 'meta_config' && $code !== 'meta_plantillas';
            $sinRevisar = in_array($code, ['meta_override'], true) ? ! $this->revisado('desvio') : ! $this->revisado('numero');
            if ($deMeta && $sinRevisar && ! isset($alerts[$code])) {
                $alerts[$code] = $text;
            }
        }

        foreach (array_diff_key($alerts, $previous) as $code => $text) {
            Log::critical('ALERTA de vigilancia: '.$text, ['codigo' => $code]);
        }
        foreach (array_diff_key($previous, $alerts) as $code => $text) {
            Log::info('Vigilancia: se resolvió la alerta', ['codigo' => $code]);
        }

        Cache::put(self::KEY_ALERTS, $alerts, now()->addMinutes(30));
        Cache::put(self::KEY_CHECKED_AT, now()->toIso8601String(), now()->addDay());

        return $alerts;
    }

    /** ¿Se pudo revisar esta parte de Meta en la última vuelta de run()? */
    public function revisado(string $parte): bool
    {
        return ! empty($this->revisado[$parte]);
    }

    /** ¿Se revisaron el número (clave y dirección) y el desvío de la cuenta? */
    public function metaCompleta(): bool
    {
        return $this->revisado('numero') && $this->revisado('desvio');
    }

    /** La dirección de Evarisbot a la que Meta debe entregar los mensajes. */
    public static function expectedWebhookUrl(): string
    {
        return rtrim((string) config('app.url'), '/').'/webhook/whatsapp';
    }

    /** Alertas vigentes (las ve la franja roja de los administradores). */
    public static function current(): array
    {
        try {
            return (array) Cache::get(self::KEY_ALERTS, []);
        } catch (\Throwable $e) {
            return [];
        }
    }

    private function checkMeta(): array
    {
        $token = Setting::get('whatsapp_token');
        $phoneId = Setting::get('whatsapp_phone_id');
        $waba = Setting::get('whatsapp_business_account_id');

        if (! is_string($token) || $token === '' || ! $phoneId || ! $waba) {
            return ['meta_config' => 'Falta el token o los identificadores de WhatsApp en el servidor. Los guarda el equipo de sistemas.'];
        }

        $alerts = [];
        $graph = fn (string $path, array $query = []) => Http::withToken($token)->timeout(8)->connectTimeout(5)
            ->get("https://graph.facebook.com/v21.0/{$path}", $query);

        $expected = self::expectedWebhookUrl();

        try {
            $phone = $graph((string) $phoneId, ['fields' => 'webhook_configuration']);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            // Sin respuesta de Meta (red caída) no se alerta: se vuelve a mirar en 10 minutos.
            return $alerts;
        }

        if ($phone->failed()) {
            $code = $phone->json('error.code');
            $pasajero = $code === null || $phone->serverError() || $phone->status() === 429
                || in_array((int) $code, self::ERRORES_PASAJEROS, true);
            if ($pasajero) {
                return $alerts;
            }

            if ((int) $code === 190 || $phone->status() === 401) {
                $alerts['meta_token'] = 'Meta ya no acepta el token guardado (código 190): guarde uno nuevo con php artisan whatsapp:guardar-token.';
            } else {
                $alerts['meta_error'] = 'Meta devolvió un error al consultar el número (código '.$code.'). Revise el ID del número y los permisos del token.';
            }
            $this->revisado['numero'] = true;

            return $alerts;
        }

        $this->revisado['numero'] = true;
        Cache::put(self::KEY_META_OK, now()->toIso8601String(), now()->addDay());

        foreach ((array) $phone->json('webhook_configuration', []) as $level => $url) {
            if (is_string($url) && $url !== '' && rtrim($url, '/') !== $expected) {
                $alerts['meta_webhook_'.$level] = 'Meta está enviando los mensajes ('.$level.') a una dirección que no es Evarisbot. Puede ser un desvío como el de octubre de 2026: revise la configuración del webhook en Meta.';
            }
        }

        try {
            $subs = $graph("{$waba}/subscribed_apps");
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            $subs = null;
        }
        if ($subs?->successful()) {
            $this->revisado['desvio'] = true;
            foreach ((array) $subs->json('data', []) as $app) {
                $override = $app['override_callback_uri'] ?? null;
                if (is_string($override) && $override !== '' && rtrim($override, '/') !== $expected) {
                    $alerts['meta_override'] = 'Hay un desvío del webhook (override) en la cuenta de WhatsApp hacia otra dirección. Es el mismo ataque de octubre de 2026.';
                }
            }
        }

        // Plantillas: la cuenta conserva las del incidente; se alerta si el total SUBE respecto a lo
        // que se vio la primera vez o a lo que se creó desde Evarisbot.
        try {
            $templates = $graph("{$waba}/message_templates", ['limit' => 1, 'summary' => 'total_count', 'fields' => 'name']);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            $templates = null;
        }
        $total = $templates?->successful() ? $templates->json('summary.total_count') : null;
        if (is_numeric($total)) {
            $baseline = Cache::get(self::KEY_TEMPLATE_BASELINE);
            if ($baseline === null) {
                Cache::forever(self::KEY_TEMPLATE_BASELINE, (int) $total);
            } elseif ((int) $total > (int) $baseline) {
                $local = DB::table('whatsapp_templates')->where('created_at', '>=', now()->subDay())->count();
                if ((int) $total - (int) $baseline > $local) {
                    $alerts['meta_plantillas'] = 'Aparecieron '.((int) $total - (int) $baseline).' plantillas nuevas en la cuenta de WhatsApp que no se crearon desde Evarisbot.';
                } else {
                    Cache::forever(self::KEY_TEMPLATE_BASELINE, (int) $total);
                }
            } elseif ((int) $total < (int) $baseline) {
                Cache::forever(self::KEY_TEMPLATE_BASELINE, (int) $total);
            }
        }

        return $alerts;
    }

    private function checkSilence(): array
    {
        $local = Carbon::now('America/Bogota');
        if ($local->isWeekend() || $local->hour < 7 || $local->hour >= 17) {
            return [];
        }

        $last = DB::table('messages')->where('is_from_user', true)->max('created_at');
        if (! $last) {
            return [];
        }

        $minutes = (int) Carbon::parse($last, 'UTC')->diffInMinutes(now('UTC'), true);
        if ($minutes < self::SILENCE_MINUTES) {
            return [];
        }

        return ['silencio' => "Hace {$minutes} minutos no entra ningún mensaje de pacientes en horario de atención. Revise que el webhook siga recibiendo (desvío en Meta, Tailscale o Apache caídos)."];
    }

    private function checkQueue(): array
    {
        $alerts = [];

        $oldest = DB::table('jobs')->whereNull('reserved_at')->where('available_at', '<=', now()->timestamp)->min('available_at');
        // Un envío masivo grande espera horas a propósito (3 s entre mensajes): solo es alerta si además el worker dejó de
        // dar señales de vida (App\Support\LatidoWorker).
        if ($oldest && (now()->timestamp - (int) $oldest) > 600 && ! \App\Support\LatidoWorker::vivo()) {
            $alerts['worker'] = 'Hay envíos en cola esperando más de 10 minutos y el worker no da señales hace más de 5 minutos: revise la tarea de Windows «Evarisbot - Worker (cola)» o reinicie el equipo.';
        }

        $failed = DB::table('failed_jobs')->where('failed_at', '>=', now()->subHour())->count();
        if ($failed >= 20) {
            $alerts['fallidos'] = "En la última hora fallaron {$failed} envíos en segundo plano.";
        }

        // Copia de seguridad nocturna (php artisan respaldo:base, tarea de Windows a las 2:00).
        $lastBackup = Cache::get(\App\Console\Commands\RespaldoBase::KEY_LAST_OK);
        if ($lastBackup && Carbon::parse($lastBackup)->lt(now()->subHours(36))) {
            $alerts['respaldo'] = 'La última copia de seguridad de la base es del '.Carbon::parse($lastBackup)->timezone('America/Bogota')->format('d/m/Y H:i')
                .'. Revise la tarea de Windows "Evarisbot - Respaldo base de datos" (solo corre con la sesión de Windows iniciada).';
        }

        return $alerts;
    }

    private function checkDisk(): array
    {
        $path = storage_path();
        $free = @disk_free_space($path);
        $total = @disk_total_space($path);

        if ($free && $total && ($free / $total) < 0.10) {
            return ['disco' => 'Queda menos del 10 % de espacio en el disco del servidor ('.round($free / 1073741824, 1).' GB libres).'];
        }

        return [];
    }
}
