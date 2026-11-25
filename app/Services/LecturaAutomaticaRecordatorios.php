<?php

namespace App\Services;

use App\Models\Conversation;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Repaso periódico de la lectura automática de recordatorios (ver Conversation::leerRecordatoriosSinNovedad).
 *
 * Lo normal es que el chat quede leído en el mismo webhook, al llegar el «Confirmar» o el «gracias». Esto recoge lo que
 * se vuelve leíble SIN que llegue un mensaje: un chat que pasa a «viejo terminado» tras 7 días quieto, uno que entra en
 * la regla porque le llegó un envío masivo, o uno en el que falló la comprobación del webhook.
 *
 * Como la liberación automática (InactiveConversationReleaser): el programador de Laravel no corre en este servidor, así
 * que se lanza al terminar las peticiones web, como mucho una vez cada 10 minutos (un stat de archivo cuando no toca).
 */
class LecturaAutomaticaRecordatorios
{
    private const STAMP = 'framework/cache/lectura-recordatorios.stamp';
    private const EVERY_SECONDS = 600;

    /** Chats por repaso: con PHP como módulo de Apache, terminating alarga la petición que lo dispara. */
    private const POR_REPASO = 100;

    public static function runIfDue(): void
    {
        try {
            // Nunca en el webhook de WhatsApp: esa petición tiene que terminar cuanto antes.
            if (request()->is('webhook/*')) {
                return;
            }

            $stamp = storage_path(self::STAMP);
            clearstatcache(true, $stamp);
            if (is_file($stamp) && (time() - filemtime($stamp)) < self::EVERY_SECONDS) {
                return;
            }
            @touch($stamp);

            // Varias peticiones pueden pasar el stat en el mismo segundo: el bloqueo atómico de la caché deja pasar a una.
            if (! Cache::add('lectura-recordatorios:running', 1, self::EVERY_SECONDS - 30)) {
                return;
            }

            // Candidatos: el conjunto de chats sin novedad que ya se calcula cada 30 s para las bandejas (incluye todos los
            // que tienen no leídos); así no se vuelve a evaluar la regla sobre miles de chats. Si no está, la consulta completa.
            $conjunto = Conversation::recordatoriosSinNovedad();
            $hechos = Conversation::leerRecordatoriosSinNovedad($conjunto['ids'] ?? null, self::POR_REPASO);
            if ($hechos === []) {
                return;
            }

            $ids = array_column($hechos, 'id');
            Log::info('Lectura automática de recordatorios', [
                'chats' => count($ids),
                'mensajes' => array_sum(array_map(fn ($h) => count($h['mensajes']), $hechos)),
            ]);
            // Avisos cortos (solo ids): las pantallas abiertas actualizan contadores y lista.
            foreach (array_chunk($ids, 100) as $bloque) {
                \App\Support\TiempoReal::conversacion('conversacion', $bloque);
            }
        } catch (\Throwable $e) {
            Log::warning('Lectura automática de recordatorios: el repaso falló', ['error' => $e->getMessage()]);
        }
    }
}
