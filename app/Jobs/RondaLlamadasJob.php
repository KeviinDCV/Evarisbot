<?php

namespace App\Jobs;

use App\Support\RondaLlamadas;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Una VUELTA de la ronda de recordatorios por llamada (App\Support\RondaLlamadas): revisa cómo va, lanza como mucho una
 * llamada nueva y se vuelve a encolar a los pocos segundos. Si el token ya no es el de la ronda (pausada, detenida o
 * reanudada con otra cadena), no hace nada y no se repite.
 */
class RondaLlamadasJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** Llamar puede tardar: el robot fabrica los audios (hasta 45 s) y Meta responde al «connect» (hasta 12 s). */
    public $timeout = 110;

    public $tries = 1;

    /** Errores seguidos de la vuelta (no de una llamada) tras los que se deja de insistir. */
    private const ERRORES_PARA_CORTAR = 5;

    public function __construct(public string $service, public string $token) {}

    public function handle(): void
    {
        // Una sola vuelta a la vez por ámbito (si el worker se retrasa, dos vueltas encoladas no se pisan).
        $candado = Cache::lock('ronda-llamadas-vuelta-'.$this->service, $this->timeout + 10);
        if (! $candado->get()) {
            if ((RondaLlamadas::leer($this->service)['token'] ?? null) === $this->token) {
                $this->siguiente();
            }

            return;
        }

        $seguir = true;
        try {
            $seguir = RondaLlamadas::vuelta($this->service, $this->token);
            Cache::forget($this->claveErrores());
        } catch (\Throwable $e) {
            $errores = (int) Cache::get($this->claveErrores(), 0) + 1;
            Cache::put($this->claveErrores(), $errores, now()->addMinutes(10));
            Log::error('Ronda de llamadas: falló una vuelta', ['service' => $this->service, 'errores' => $errores, 'error' => mb_substr($e->getMessage(), 0, 300)]);
            if ($errores >= self::ERRORES_PARA_CORTAR) {
                $seguir = false;
                try {
                    RondaLlamadas::cerrar($this->service, $this->token, 'cortada', 'fallos');
                } catch (\Throwable) {
                    // La pantalla la verá «sin avanzar».
                }
            }
        } finally {
            $candado->release();
        }

        if ($seguir) {
            $this->siguiente();
        }
    }

    /**
     * El trabajo se dio por fallido (el worker murió a mitad de la vuelta y venció su reserva, o un error fuera del try):
     * si la cadena sigue siendo la vigente, se vuelve a encolar para que la ronda no se quede quieta.
     */
    public function failed(?\Throwable $e): void
    {
        try {
            $r = RondaLlamadas::leer($this->service);
            if (($r['token'] ?? null) === $this->token && ($r['estado'] ?? '') === 'en_curso') {
                Log::warning('Ronda de llamadas: una vuelta falló; se reencola', ['service' => $this->service, 'error' => mb_substr((string) $e?->getMessage(), 0, 200)]);
                $this->siguiente();
            }
        } catch (\Throwable) {
            // Sin base de datos no hay nada que hacer: la pantalla la mostrará «sin avanzar».
        }
    }

    private function siguiente(): void
    {
        self::dispatch($this->service, $this->token)->delay(now()->addSeconds(RondaLlamadas::SEGUNDOS_ENTRE_VUELTAS));
    }

    private function claveErrores(): string
    {
        return 'ronda-llamadas-errores-'.$this->service.'-'.$this->token;
    }
}
