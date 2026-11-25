<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\ConversationActivity;
use App\Models\Message;
use App\Models\Setting;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Aviso de fin de semana (Configuración → Mensaje de fin de semana).
 *
 * Sábados y domingos (hora de Colombia), cuando un paciente escribe, se le responde una sola
 * vez por fin de semana con el horario de atención. No se repite con cada mensaje: un
 * bloqueo atómico por conversación y fin de semana impide duplicados aunque lleguen varios
 * mensajes a la vez.
 *
 * No se envía si una persona del equipo le escribió a esa conversación en las últimas
 * HORAS_ATENDIDA horas (ya la están atendiendo, p. ej. un asesor de turno el sábado).
 *
 * El aviso se guarda como mensaje automático OCULTO (sent_by NULL, is_hidden = true), igual
 * que las respuestas automáticas de cita: no tapa la vista previa del mensaje del paciente en
 * la lista ni cuenta como respuesta del asesor para la liberación automática, pero sí se ve
 * al abrir el chat. En el historial queda la actividad 'weekend_notice'.
 *
 * Nunca lanza excepciones: si algo falla, el mensaje del paciente ya está guardado y se
 * atiende igual; el fallo solo se registra.
 */
class WeekendNotice
{
    public const KEY_ENABLED = 'weekend_notice_enabled';
    public const KEY_TEXT = 'weekend_notice_text';
    public const MAX_LENGTH = 1000;
    public const TZ = 'America/Bogota';
    /** Si una persona del equipo respondió en estas últimas horas, no se envía el aviso. */
    public const HORAS_ATENDIDA = 12;
    /** Tras un envío fallido se reintenta con el siguiente mensaje pasados estos minutos. */
    private const MINUTOS_REINTENTO = 10;

    public const DEFAULT_TEXT = "¡Bienvenido(a) al Hospital Universitario del Valle «Evaristo García»! 👋\n\n"
        . "Le recordamos que nuestro horario de atención es de *lunes a viernes, de 6:30 a. m. a 4:00 p. m.*\n\n"
        . "Recibimos su mensaje y un asesor le responderá en ese horario.";

    /** @return array{enabled: bool, text: string} */
    public static function settings(): array
    {
        $texto = trim((string) Setting::get(self::KEY_TEXT, ''));

        return [
            'enabled' => Setting::get(self::KEY_ENABLED, 'false') === 'true',
            'text' => $texto !== '' ? $texto : self::DEFAULT_TEXT,
        ];
    }

    /** ¿Es sábado o domingo en Colombia? */
    public static function isWeekend(?Carbon $now = null): bool
    {
        return ($now ?? now())->copy()->setTimezone(self::TZ)->isWeekend();
    }

    /** Sábado de este fin de semana (fecha de Colombia), para identificar el fin de semana. */
    public static function weekendKey(?Carbon $now = null): string
    {
        $local = ($now ?? now())->copy()->setTimezone(self::TZ)->startOfDay();

        return ($local->isSunday() ? $local->subDay() : $local)->format('Y-m-d');
    }

    /**
     * Envía el aviso si corresponde. Se llama al procesar un mensaje real del paciente (no las
     * pulsaciones de confirmar/cancelar cita, que salen antes por su propio camino).
     */
    public function maybeSend(Conversation $conversation, string $to, WhatsAppService $whatsapp): void
    {
        $clave = null;
        $enviado = false;

        try {
            if (! self::isWeekend()) {
                return;
            }

            $config = self::settings();
            if (! $config['enabled'] || $conversation->is_blocked) {
                return;
            }

            // Ya la atiende una persona: el aviso sobra. Va antes del bloqueo para no gastarlo:
            // si después pasan HORAS_ATENDIDA horas sin respuesta, el aviso sí sale.
            if ($this->atendidaRecientemente($conversation->id)) {
                return;
            }

            // Uno por conversación y fin de semana; atómico (insertOrIgnore en la caché de la base).
            $fin = self::weekendKey();
            $clave = "weekend-notice:{$conversation->id}:{$fin}";
            if (! Cache::add($clave, 1, now()->addDays(3))) {
                return;
            }

            // Segunda barrera por si la caché se vació (cache:clear): la actividad queda en la base.
            $inicioFinde = Carbon::parse($fin, self::TZ)->startOfDay()->setTimezone(config('app.timezone'));
            $yaAvisada = ConversationActivity::where('conversation_id', $conversation->id)
                ->where('type', 'weekend_notice')
                ->where('created_at', '>=', $inicioFinde)
                ->exists();
            if ($yaAvisada) {
                return;
            }

            $result = $whatsapp->sendTextMessage($to, $config['text']);
            if (! ($result['success'] ?? false)) {
                Log::warning('Aviso de fin de semana: WhatsApp no lo aceptó', [
                    'conversation_id' => $conversation->id,
                    'error' => $result['error'] ?? null,
                ]);
                // No gastar el aviso del fin de semana: se reintenta con un mensaje posterior.
                Cache::put($clave, 1, now()->addMinutes(self::MINUTOS_REINTENTO));

                return;
            }
            $enviado = true;

            Message::create([
                'conversation_id' => $conversation->id,
                'content' => $config['text'],
                'message_type' => 'text',
                'is_from_user' => false,
                'is_hidden' => true,
                'whatsapp_message_id' => $result['message_id'] ?? null,
                'status' => 'sent',
                'sent_by' => null,
            ]);

            ConversationActivity::create([
                'conversation_id' => $conversation->id,
                'user_id' => null,
                'type' => 'weekend_notice',
                'metadata' => ['weekend' => $fin],
            ]);
        } catch (\Throwable $e) {
            Log::warning('Aviso de fin de semana: falló el envío', [
                'conversation_id' => $conversation->id,
                'error' => $e->getMessage(),
            ]);
            // Si no llegó a salir, que se pueda reintentar; si ya salió, el bloqueo se queda.
            if ($clave !== null && ! $enviado) {
                try {
                    Cache::put($clave, 1, now()->addMinutes(self::MINUTOS_REINTENTO));
                } catch (\Throwable) {
                    // Sin caché no hay nada más que hacer.
                }
            }
        }
    }

    /** ¿Alguien del equipo (no envíos masivos ni automáticos) le escribió hace poco? */
    private function atendidaRecientemente(int $conversationId): bool
    {
        return Message::where('conversation_id', $conversationId)
            ->where('is_from_user', false)
            ->where('is_hidden', false)
            ->whereNotNull('sent_by')
            ->where(fn ($q) => $q->whereNull('content')->orWhere('content', 'not like', '[Envío masivo%'))
            ->where('created_at', '>=', now()->subHours(self::HORAS_ATENDIDA))
            ->exists();
    }
}
