<?php

namespace App\Support;

use App\Events\AvisoTiempoReal;
use App\Models\Conversation;
use App\Models\InternalMessage;
use App\Models\InternalMessageReaction;
use App\Models\Message;
use App\Models\MessageReaction;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Avisos de tiempo real (Laravel Reverb) para que la pantalla se actualice al instante, como WhatsApp.
 *
 * Reglas, porque esto corre dentro del webhook y del worker, que atienden pacientes:
 * - NUNCA lanza un error ni frena: si Reverb no responde, se omiten los avisos durante 30 s y la pantalla sigue con
 *   su consulta periódica de siempre (más lenta, pero igual de correcta).
 * - Solo ids y el tipo, nada de pacientes (ver App\Events\AvisoTiempoReal).
 * - Dentro de una transacción espera al commit: si no, la pantalla pediría los datos antes de que existan.
 * - Apagado si BROADCAST_CONNECTION no es «reverb»: no hace nada.
 *
 * Tipos de conversación (canal 'conversaciones'):
 *   mensaje_entrante  mensaje VISIBLE del paciente (lo emite WhatsAppService; no las respuestas a botones de cita, que
 *                     se resuelven solas y no deben «saltar» a la lista) → lista, contadores, chat abierto y sonido
 *   mensaje           mensaje saliente, reacción, transcripción  → lista y chat abierto
 *   estado            checks (entregado/leído/fallido) y cualquier mensaje entrante → solo el chat abierto
 *   conversacion      estado, asesor, no leídos, bloqueo…       → lista y contadores
 *   escribiendo       alguien escribe o mira el chat             → solo el chat abierto
 * Chat interno (canal de cada participante): chat_interno.
 */
class TiempoReal
{
    private const CLAVE_CAIDO = 'tiempo_real:caido_hasta';

    private const PAUSA_SI_CAE = 30;

    /** Copia en memoria del «caído hasta» (evita leer la caché en cada aviso de la misma petición o del worker). */
    private static int $caidoHasta = 0;

    /** Registra los avisos automáticos de los modelos. Se llama una vez desde AppServiceProvider::boot(). */
    public static function registrar(): void
    {
        Message::created(fn (Message $m) => self::conversacion($m->is_from_user ? 'estado' : 'mensaje', (int) $m->conversation_id));
        Message::updated(fn (Message $m) => self::conversacion('estado', (int) $m->conversation_id));
        // «saved» salta aunque no cambie nada (p. ej. markAsRead al abrir un chat): solo se avisa si cambió algo más que
        // la fecha de actualización.
        Conversation::saved(function (Conversation $c) {
            if ($c->wasRecentlyCreated || array_diff(array_keys($c->getChanges()), ['updated_at']) !== []) {
                self::conversacion('conversacion', (int) $c->id);
            }
        });
        MessageReaction::saved(fn (MessageReaction $r) => self::deMensaje((int) $r->message_id));
        MessageReaction::deleted(fn (MessageReaction $r) => self::deMensaje((int) $r->message_id));
        InternalMessage::saved(fn (InternalMessage $m) => self::chatInterno((int) $m->internal_chat_id));
        InternalMessageReaction::saved(fn (InternalMessageReaction $r) => self::deMensajeInterno((int) $r->internal_message_id));
        InternalMessageReaction::deleted(fn (InternalMessageReaction $r) => self::deMensajeInterno((int) $r->internal_message_id));
    }

    /**
     * Aviso de una o varias conversaciones (los cambios en bloque van en un solo aviso).
     *
     * Acepta un id, un array o una colección (p. ej. un pluck('id')) y nunca lanza, ni siquiera por el tipo: con
     * `int|array` una colección daba TypeError en la llamada, fuera de todo try/catch, y tumbaba la petición
     * («Limpiar conversaciones del asesor» dio 500 el 19/10/2026; la transacción se deshizo y no cambió nada).
     */
    public static function conversacion(string $tipo, mixed $ids): void
    {
        try {
            if ($ids instanceof \Illuminate\Support\Enumerable) {
                $ids = $ids->all();
            } elseif ($ids instanceof \Traversable) {
                $ids = iterator_to_array($ids, false);
            }
            $ids = array_values(array_unique(array_filter(array_map('intval', (array) $ids))));
        } catch (\Throwable) {
            return;
        }
        if ($ids === []) {
            return;
        }

        $datos = count($ids) === 1 ? ['conversation_id' => $ids[0]] : ['conversation_ids' => array_slice($ids, 0, 500)];
        self::enviar($tipo, $datos, ['conversaciones']);
    }

    /** Aviso a los participantes de un chat interno. */
    public static function chatInterno(int $chatId): void
    {
        if ($chatId <= 0 || ! self::activo()) {
            return;
        }

        try {
            $usuarios = DB::table('internal_chat_participants')->where('internal_chat_id', $chatId)->pluck('user_id')->all();
        } catch (\Throwable) {
            return;
        }
        $canales = array_map(fn ($id) => 'App.Models.User.'.(int) $id, array_unique($usuarios));
        if ($canales !== []) {
            self::enviar('chat_interno', ['chat_id' => $chatId], $canales);
        }
    }

    /** A todos los administradores y asesores (anuncios de lectura obligatoria). Por tandas de 90 canales. */
    public static function paraTodos(string $tipo, array $datos = []): void
    {
        if (! self::activo()) {
            return;
        }

        try {
            $usuarios = DB::table('users')->whereIn('role', ['admin', 'advisor'])->pluck('id')->all();
        } catch (\Throwable) {
            return;
        }
        foreach (array_chunk(array_map(fn ($id) => 'App.Models.User.'.(int) $id, $usuarios), 90) as $canales) {
            self::enviar($tipo, $datos, $canales);
        }
    }

    private static function deMensaje(int $messageId): void
    {
        if (! self::activo()) {
            return;
        }
        try {
            self::conversacion('mensaje', (int) DB::table('messages')->where('id', $messageId)->value('conversation_id'));
        } catch (\Throwable) {
        }
    }

    private static function deMensajeInterno(int $messageId): void
    {
        if (! self::activo()) {
            return;
        }
        try {
            self::chatInterno((int) DB::table('internal_messages')->where('id', $messageId)->value('internal_chat_id'));
        } catch (\Throwable) {
        }
    }

    private static function activo(): bool
    {
        return config('broadcasting.default') === 'reverb';
    }

    private static function enviar(string $tipo, array $datos, array $canales): void
    {
        if (! self::activo()) {
            return;
        }

        $envio = function () use ($tipo, $datos, $canales) {
            if (self::$caidoHasta > time()) {
                return;
            }
            try {
                $guardado = (int) Cache::get(self::CLAVE_CAIDO, 0);
                if ($guardado > time()) {
                    self::$caidoHasta = $guardado;

                    return;
                }
            } catch (\Throwable) {
                // Sin caché se intenta igual: el tiempo máximo de la conexión (config/broadcasting.php) acota el costo.
            }

            try {
                event(new AvisoTiempoReal($tipo, $datos, $canales));
            } catch (\Throwable $e) {
                self::$caidoHasta = time() + self::PAUSA_SI_CAE;
                try {
                    Cache::put(self::CLAVE_CAIDO, self::$caidoHasta, self::PAUSA_SI_CAE);
                } catch (\Throwable) {
                }
                Log::warning('Tiempo real no disponible: se omiten los avisos 30 s (la pantalla sigue con su consulta periódica)', [
                    'error' => mb_substr($e->getMessage(), 0, 200),
                ]);
            }
        };

        try {
            if (DB::transactionLevel() > 0) {
                DB::afterCommit($envio);
            } else {
                $envio();
            }
        } catch (\Throwable) {
            // Nada de lo que pase aquí puede afectar al webhook, al bot ni al worker.
        }
    }
}
