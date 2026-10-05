<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\ConversationActivity;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Liberación automática de conversaciones por inactividad del asesor.
 *
 * Si el paciente escribió y su asesor no le ha respondido en el tiempo configurado
 * (Configuración → Liberación automática), la conversación se desasigna y vuelve a la
 * bandeja sin asignar para que otro asesor la atienda. El paciente no se queda esperando
 * a alguien que se fue de turno o se olvidó del chat.
 *
 * El reloj cuenta desde el ÚLTIMO mensaje real del paciente que siga sin respuesta y nunca
 * desde antes de la asignación (assigned_at): un asesor que toma de la bandeja un chat con
 * un mensaje de hace horas tiene el tiempo completo para contestar. Si el asesor responde,
 * el reloj se detiene hasta que el paciente vuelva a escribir.
 *
 * Qué cuenta:
 *  - Mensaje del paciente: entrante y visible (las pulsaciones ocultas de confirmar/cancelar
 *    cita no esperan respuesta de nadie).
 *  - Respuesta del asesor: saliente, visible, enviada por una persona (sent_by) y que no sea
 *    un envío masivo, que sale a nombre de quien lo lanzó pero no responde a nadie.
 *
 * Solo se tocan conversaciones abiertas (activa, pendiente, en proceso). No se borra nada:
 * se quita el asesor y se deja constancia en el historial de la conversación.
 *
 * Quién lo dispara: el programador de Laravel no corre en este servidor, así que la
 * revisión se lanza al final de las peticiones web (AppServiceProvider), como mucho una vez
 * por minuto. El webhook de WhatsApp llega a toda hora, así que no depende de que haya
 * asesores conectados. El comando conversations:release-inactive hace lo mismo a mano.
 */
class InactiveConversationReleaser
{
    public const KEY_ENABLED = 'auto_release_enabled';
    public const KEY_MINUTES = 'auto_release_minutes';

    public const MIN_MINUTES = 5;
    public const MAX_MINUTES = 43200; // 30 días
    public const DEFAULT_MINUTES = 180;

    /** Estados en los que una conversación sigue abierta y alguien debería responder. */
    public const OPEN_STATUSES = ['active', 'pending', 'in_progress'];

    /** Marca de "ya se revisó hace poco" (un stat por petición, sin tocar la base). */
    private const STAMP = 'framework/auto-release.stamp';
    private const EVERY_SECONDS = 60;

    /** @return array{enabled: bool, minutes: int} */
    public static function settings(): array
    {
        return [
            'enabled' => Setting::get(self::KEY_ENABLED, 'false') === 'true',
            'minutes' => self::clampMinutes((int) Setting::get(self::KEY_MINUTES, (string) self::DEFAULT_MINUTES)),
        ];
    }

    public static function clampMinutes(int $minutes): int
    {
        if ($minutes <= 0) {
            return self::DEFAULT_MINUTES;
        }

        return max(self::MIN_MINUTES, min(self::MAX_MINUTES, $minutes));
    }

    /**
     * Lanzada al terminar cada petición web. Barata cuando no toca: un stat de archivo.
     * Nunca lanza excepciones (la petición ya respondió; un fallo aquí solo se registra).
     */
    public static function runIfDue(): void
    {
        try {
            $stamp = storage_path(self::STAMP);
            clearstatcache(true, $stamp);
            if (is_file($stamp) && (time() - filemtime($stamp)) < self::EVERY_SECONDS) {
                return;
            }
            @touch($stamp);

            // Varias peticiones pueden pasar el stat en el mismo segundo: el bloqueo atómico
            // de la caché (base de datos) deja pasar solo a una.
            if (! Cache::add('auto-release:running', 1, self::EVERY_SECONDS - 5)) {
                return;
            }

            $config = self::settings();
            if (! $config['enabled']) {
                return;
            }

            app(self::class)->release($config['minutes']);
        } catch (\Throwable $e) {
            Log::warning('Liberación automática: la revisión falló', ['error' => $e->getMessage()]);
        }
    }

    /**
     * Conversaciones que hoy se liberarían con ese tiempo de espera.
     *
     * @return Collection<int, object{id:int, assigned_to:int, assigned_at:?string, waiting_since:string}>
     */
    public function candidates(int $minutes, ?Carbon $now = null): Collection
    {
        $cutoff = ($now ?? now())->copy()->subMinutes(self::clampMinutes($minutes));

        $lastPatientMessage = DB::table('messages')
            ->selectRaw('MAX(created_at)')
            ->whereColumn('messages.conversation_id', 'conversations.id')
            ->where('is_from_user', true)
            ->where('is_hidden', false);

        $lastAdvisorReply = DB::table('messages')
            ->selectRaw('MAX(created_at)')
            ->whereColumn('messages.conversation_id', 'conversations.id')
            ->where(fn (Builder $q) => self::advisorReply($q));

        $rows = DB::table('conversations')
            ->whereNotNull('assigned_to')
            ->whereIn('status', self::OPEN_STATUSES)
            ->where(fn (Builder $q) => $q->whereNull('assigned_at')->orWhere('assigned_at', '<=', $cutoff))
            ->select('id', 'assigned_to', 'assigned_at')
            ->selectSub($lastPatientMessage, 'last_patient_at')
            ->selectSub($lastAdvisorReply, 'last_reply_at')
            ->get();

        return $rows
            ->filter(fn ($row) => $row->last_patient_at !== null
                && Carbon::parse($row->last_patient_at)->lessThanOrEqualTo($cutoff)
                && ($row->last_reply_at === null || Carbon::parse($row->last_reply_at)->lessThan(Carbon::parse($row->last_patient_at))))
            ->map(fn ($row) => (object) [
                'id' => (int) $row->id,
                'assigned_to' => (int) $row->assigned_to,
                'assigned_at' => $row->assigned_at,
                // El reloj arranca en lo más reciente entre el mensaje y la asignación.
                'waiting_since' => $row->assigned_at && Carbon::parse($row->assigned_at)->greaterThan(Carbon::parse($row->last_patient_at))
                    ? $row->assigned_at
                    : $row->last_patient_at,
            ])
            ->values();
    }

    /** Libera las conversaciones vencidas. Devuelve cuántas liberó. */
    public function release(int $minutes, bool $dryRun = false): int
    {
        $minutes = self::clampMinutes($minutes);
        $candidates = $this->candidates($minutes);

        if ($dryRun || $candidates->isEmpty()) {
            return $dryRun ? $candidates->count() : 0;
        }

        $cutoff = now()->subMinutes($minutes);
        $names = User::whereIn('id', $candidates->pluck('assigned_to')->unique())->pluck('name', 'id');
        $released = 0;

        foreach ($candidates as $c) {
            // Se vuelve a comprobar en el mismo UPDATE: si en este instante el asesor respondió
            // o alguien reasignó el chat, no se toca.
            $affected = Conversation::query()
                ->where('id', $c->id)
                ->where('assigned_to', $c->assigned_to)
                ->whereIn('status', self::OPEN_STATUSES)
                ->where(fn ($q) => $q->whereNull('assigned_at')->orWhere('assigned_at', '<=', $cutoff))
                ->whereNotExists(fn (Builder $q) => $q->from('messages')
                    ->whereColumn('messages.conversation_id', 'conversations.id')
                    ->where('messages.created_at', '>=', $c->waiting_since)
                    ->where(fn (Builder $r) => self::advisorReply($r)))
                ->toBase()
                ->update(['assigned_to' => null, 'assigned_at' => null, 'updated_at' => now()]);

            if ($affected !== 1) {
                continue;
            }

            $released++;

            // create() y no ConversationActivity::log(): log() pone como autor al usuario de la
            // petición que disparó la revisión, y esto lo hizo el sistema.
            ConversationActivity::create([
                'conversation_id' => $c->id,
                'user_id' => null,
                'type' => 'unassigned',
                'metadata' => [
                    'reason' => 'auto_release',
                    'previous_assigned_to' => $c->assigned_to,
                    'released_from_id' => $c->assigned_to,
                    'released_from_name' => $names[$c->assigned_to] ?? null,
                    'threshold_minutes' => $minutes,
                    'waiting_since' => Carbon::parse($c->waiting_since)->toIso8601String(),
                ],
            ]);
        }

        if ($released > 0) {
            Log::info('Liberación automática por inactividad', [
                'liberadas' => $released,
                'minutos' => $minutes,
            ]);
        }

        return $released;
    }

    /** Condición de "respuesta de una persona del equipo" sobre la tabla messages. */
    private static function advisorReply(Builder $q): void
    {
        $q->where('messages.is_from_user', false)
            ->where('messages.is_hidden', false)
            ->whereNotNull('messages.sent_by')
            ->where(fn (Builder $r) => $r->whereNull('messages.content')
                ->orWhere('messages.content', 'not like', '[Envío masivo%'));
    }
}
