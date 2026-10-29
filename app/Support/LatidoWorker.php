<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;

/**
 * Señal de vida del worker de la cola.
 *
 * La vigilancia (App\Services\WebhookWatchdog) avisaba «worker detenido» con solo ver envíos esperando más de 10 minutos,
 * pero un envío masivo grande espera horas a propósito (3 s entre mensajes, unos 15 por minuto) con el worker trabajando.
 * Ahora el worker deja esta marca mientras está vivo, también cuando no hay nada que hacer, y la alerta solo salta si
 * además la marca es vieja.
 *
 * Se escribe como mucho una vez por minuto (la caché está en la base) y nunca lanza: el worker no puede caerse por esto.
 */
class LatidoWorker
{
    public const KEY = 'worker:latido';

    /** Sin marca en este tiempo, el worker se da por detenido. */
    public const VIVO_SEGUNDOS = 300;

    private static int $ultimo = 0;

    /** Se llama una vez desde AppServiceProvider::boot(); solo tiene efecto dentro del worker (queue:work). */
    public static function registrar(): void
    {
        Queue::looping(fn () => self::marcar());
        Queue::after(fn () => self::marcar());
    }

    public static function marcar(): void
    {
        $ahora = time();
        if ($ahora - self::$ultimo < 60) {
            return;
        }
        self::$ultimo = $ahora;
        try {
            Cache::put(self::KEY, $ahora, self::VIVO_SEGUNDOS * 4);
        } catch (\Throwable) {
            // Sin caché no hay marca: como mucho, una alerta de más. Nunca detiene al worker.
        }
    }

    /** ¿El worker dio señales en los últimos 5 minutos? */
    public static function vivo(): bool
    {
        try {
            return time() - (int) Cache::get(self::KEY, 0) <= self::VIVO_SEGUNDOS;
        } catch (\Throwable) {
            return false;
        }
    }
}
