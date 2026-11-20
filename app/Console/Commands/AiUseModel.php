<?php

namespace App\Console\Commands;

use App\Models\InternalChat;
use App\Models\InternalChatParticipant;
use App\Models\InternalMessage;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * Lista los modelos que LM Studio está sirviendo y permite cambiar el modelo
 * que usa el chatbot del chat interno (valida que exista y limpia el historial).
 *
 *   php artisan ai:use-model                 → lista modelos disponibles
 *   php artisan ai:use-model "qwen/qwen3.5-9b" → cambia el chatbot a ese modelo
 */
class AiUseModel extends Command
{
    protected $signature = 'ai:use-model {id? : ID exacto del modelo en LM Studio}';
    protected $description = 'Lista o cambia el modelo de IA que usa el chatbot del chat interno';

    public function handle(): int
    {
        $base = rtrim(Setting::get('lmstudio_base_url') ?: env('LMSTUDIO_BASE_URL', 'http://127.0.0.1:1234'), '/');

        try {
            $resp = Http::connectTimeout(3)->timeout(10)->acceptJson()->get($base . '/v1/models');
            $served = collect($resp->json('data') ?? [])
                ->pluck('id')
                ->filter(fn ($id) => $id && !str_contains((string) $id, 'embed'))
                ->values();
        } catch (\Throwable $e) {
            $this->error("No pude consultar LM Studio en {$base}: " . $e->getMessage());
            return self::FAILURE;
        }

        $id = $this->argument('id');

        // Sin argumento: mostrar el modelo actual y los disponibles
        if (!$id) {
            $current = Setting::get('lmstudio_model') ?: '(por defecto)';
            $this->info("Modelo actual del chatbot: {$current}");
            $this->line('Modelos disponibles ahora en LM Studio:');
            foreach ($served as $m) {
                $this->line('  • ' . $m);
            }
            $this->newLine();
            $this->line('Para cambiar:  php artisan ai:use-model "<id>"');
            return self::SUCCESS;
        }

        // Con argumento: validar que esté servible
        if (!$served->contains($id)) {
            $this->error("«{$id}» no está disponible en LM Studio (¿ya terminó de descargar y está cargado?).");
            $this->line('Modelos servibles ahora mismo:');
            foreach ($served as $m) {
                $this->line('  • ' . $m);
            }
            return self::FAILURE;
        }

        Setting::set('lmstudio_model', $id);

        // Limpiar el historial de la IA para arrancar de cero con el nuevo modelo
        $deleted = 0;
        if ($ai = User::aiUser()) {
            $chatIds = InternalChatParticipant::where('user_id', $ai->id)->pluck('internal_chat_id');
            $deleted = InternalMessage::whereIn('internal_chat_id', $chatIds)->delete();
            InternalChat::whereIn('id', $chatIds)->update(['ai_nudged_at' => null]);
            InternalChatParticipant::whereIn('internal_chat_id', $chatIds)->update(['last_read_at' => now()]);
        }

        $this->info("✓ Chatbot ahora usa: {$id}");
        $this->line("  Historial de la IA limpiado ({$deleted} mensajes). Recarga el chat con Ctrl+F5.");
        return self::SUCCESS;
    }
}
