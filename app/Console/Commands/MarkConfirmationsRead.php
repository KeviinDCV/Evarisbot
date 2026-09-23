<?php

namespace App\Console\Commands;

use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Marca como leídas (unread_count = 0) SOLO las conversaciones cuyo último mensaje es:
 *  - una confirmación de recordatorio del paciente ("Confirmar", "Confirmo", "Asisto"...),
 *  - la respuesta del sistema "Confirmación recibida", o
 *  - una cortesía corta del paciente ("gracias", "ok", "listo"...).
 *
 * NUNCA toca conversaciones cuyo último mensaje es una solicitud/pregunta real del paciente.
 * Ante la duda, NO se marca (criterio conservador, idéntico a la limpieza manual).
 */
class MarkConfirmationsRead extends Command
{
    protected $signature = 'conversations:mark-confirmations-read {--dry-run : Solo muestra cuántas marcaría, sin tocar nada}';

    protected $description = 'Marca como leídas las conversaciones de confirmación de recordatorio o cortesía (nunca mensajes reales de pacientes).';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        // Confirmaciones cortas del paciente (exactas, para no atrapar mensajes largos reales).
        $rxConfirm = '/^(confirmar|confirmo|confirmado|confirmada|asistir|asisto|asistir[eé]|s[ií]\s*(confirmo|asisto))\.?$/u';
        // Cortesías cortas (solo cuando el mensaje empieza con una y es breve).
        $rxCortesia = '/^(gracias|muchas gracias|mil gracias|ok|okey|okay|listo|vale|bueno|perfecto|dios.{0,15}bendiga|bendiciones|de acuerdo|entendido|claro|👍|🙏)/u';

        $unreadIds = Conversation::where('unread_count', '>', 0)->pluck('id');
        if ($unreadIds->isEmpty()) {
            $this->info('No hay conversaciones no leídas.');
            return self::SUCCESS;
        }

        $toMark = [];
        foreach ($unreadIds->chunk(1000) as $idsChunk) {
            // Último mensaje (mayor id) de cada conversación del bloque.
            $latestIds = Message::whereIn('conversation_id', $idsChunk)
                ->selectRaw('max(id) as mid')
                ->groupBy('conversation_id')
                ->pluck('mid');

            $latest = Message::whereIn('id', $latestIds)->get(['conversation_id', 'is_from_user', 'content']);

            foreach ($latest as $m) {
                $c = mb_strtolower(trim((string) ($m->content ?? '')));
                if ($c === '') {
                    continue;
                }

                $safe = false;
                if ($m->is_from_user) {
                    if (preg_match($rxConfirm, $c)) {
                        $safe = true;
                    } elseif (preg_match($rxCortesia, $c) && mb_strlen($c) < 35) {
                        $safe = true;
                    }
                } elseif (str_contains($c, 'confirmación recibida')) {
                    $safe = true;
                }

                if ($safe) {
                    $toMark[] = $m->conversation_id;
                }
            }
        }

        $total = count($toMark);

        if ($dryRun) {
            $this->info("[DRY-RUN] Se marcarían como leídas: {$total} conversaciones (no se tocó nada).");
            return self::SUCCESS;
        }

        $count = 0;
        if ($total > 0) {
            $count = Conversation::whereIn('id', $toMark)
                ->where('unread_count', '>', 0)
                ->update(['unread_count' => 0]);
        }

        $this->info("Conversaciones de confirmación/cortesía marcadas como leídas: {$count}");
        Log::info('Auto-marcado de confirmaciones/cortesías como leídas', ['marcadas' => $count]);

        return self::SUCCESS;
    }
}
