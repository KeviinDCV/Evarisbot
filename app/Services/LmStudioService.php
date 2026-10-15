<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Cliente para un modelo de IA LOCAL servido por LM Studio
 * (API compatible con OpenAI: POST /v1/chat/completions).
 *
 * Por defecto apunta a http://127.0.0.1:1234 (el servidor local de LM Studio).
 * Tanto la URL como el modelo son configurables vía Settings o .env:
 *   - lmstudio_base_url / LMSTUDIO_BASE_URL
 *   - lmstudio_model    / LMSTUDIO_MODEL
 */
class LmStudioService
{
    /**
     * URL base del servidor LM Studio (sin slash final).
     */
    public function baseUrl(): string
    {
        $url = Setting::get('lmstudio_base_url') ?: env('LMSTUDIO_BASE_URL', 'http://127.0.0.1:1234');
        return rtrim($url, '/');
    }

    /**
     * Identificador del modelo cargado en LM Studio.
     */
    public function model(): string
    {
        return Setting::get('lmstudio_model') ?: env('LMSTUDIO_MODEL', 'mistralai/mistral-7b-instruct-v0.3');
    }

    /**
     * Enviar una conversación (array de mensajes role/content) y obtener la respuesta del modelo.
     *
     * @param  array<int, array{role:string, content:string}>  $messages
     * @return string|null  Texto de la respuesta, o null si falla / LM Studio no está disponible.
     */
    public function chat(array $messages, float $temperature = 0.3, int $maxTokens = 500): ?string
    {
        // Modelos como Mistral Instruct no aceptan el rol "system" en su plantilla.
        // Normalizamos: fusionamos system en el primer "user" y colapsamos roles consecutivos.
        $messages = $this->normalizeMessages($messages);

        if (empty($messages)) {
            return null;
        }

        try {
            $response = Http::connectTimeout(3) // LM Studio corre local; si no conecta rápido, no está arriba
                ->timeout(180)                  // modelos grandes (p. ej. Nemotron) pueden tardar bastante
                ->acceptJson()
                ->post($this->baseUrl() . '/v1/chat/completions', [
                    'model'       => $this->model(),
                    'messages'    => $messages,
                    'temperature' => $temperature,
                    'max_tokens'  => $maxTokens,
                    'stream'      => false,
                ]);

            if (!$response->successful()) {
                Log::warning('LmStudio: respuesta no exitosa', [
                    'status' => $response->status(),
                    'body'   => mb_substr($response->body(), 0, 300),
                ]);
                return null;
            }

            $content = $response->json('choices.0.message.content');
            $content = is_string($content) ? trim($content) : null;

            if ($content === null || $content === '') {
                return null;
            }

            // Quitar bloques de razonamiento que algunos modelos incluyen en línea
            $content = preg_replace('/<think>.*?<\/think>/isu', '', $content);
            $content = preg_replace('/<\/?think>/iu', '', $content);

            // Limpiar prefijos accidentales ("Asistente:", "assistant:") y comillas envolventes
            $content = preg_replace('/^(assistant|asistente)\s*:\s*/iu', '', $content);

            return trim($content);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            Log::warning('LmStudio: sin conexión', ['url' => $this->baseUrl(), 'error' => $e->getMessage()]);
            return null;
        } catch (\Throwable $e) {
            Log::error('LmStudio: error inesperado', ['error' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Normalizar mensajes para plantillas que solo aceptan roles user/assistant
     * (p. ej. Mistral Instruct):
     *   1) Fusiona los mensajes "system" en el primer mensaje "user".
     *   2) Colapsa mensajes consecutivos del mismo rol.
     *   3) Garantiza que la conversación empiece con un mensaje "user".
     *
     * @param  array<int, array{role?:string, content?:string}>  $messages
     * @return array<int, array{role:string, content:string}>
     */
    private function normalizeMessages(array $messages): array
    {
        // 1) Separar system del resto
        $system = '';
        $rest = [];
        foreach ($messages as $m) {
            $role = $m['role'] ?? 'user';
            $content = (string) ($m['content'] ?? '');
            if ($role === 'system') {
                $system .= ($system !== '' ? "\n\n" : '') . $content;
                continue;
            }
            $rest[] = ['role' => $role, 'content' => $content];
        }

        // Fusionar el system en el primer mensaje "user" (o crearlo si no hay)
        if ($system !== '') {
            $placed = false;
            foreach ($rest as $i => $m) {
                if ($m['role'] === 'user') {
                    $rest[$i]['content'] = $system . "\n\n---\n\n" . $m['content'];
                    $placed = true;
                    break;
                }
            }
            if (!$placed) {
                array_unshift($rest, ['role' => 'user', 'content' => $system]);
            }
        }

        // 2) Colapsar mensajes consecutivos del mismo rol
        $collapsed = [];
        foreach ($rest as $m) {
            $n = count($collapsed);
            if ($n > 0 && $collapsed[$n - 1]['role'] === $m['role']) {
                $collapsed[$n - 1]['content'] .= "\n" . $m['content'];
            } else {
                $collapsed[] = $m;
            }
        }

        // 3) La conversación debe empezar con "user"
        while (!empty($collapsed) && $collapsed[0]['role'] !== 'user') {
            array_shift($collapsed);
        }

        return $collapsed;
    }
}
