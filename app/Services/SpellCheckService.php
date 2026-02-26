<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SpellCheckService
{
    protected ?string $apiKey;
    protected string $baseUrl = 'https://api.groq.com/openai/v1';
    protected string $model = 'llama-3.3-70b-versatile';

    public function __construct()
    {
        $this->apiKey = Setting::get('groq_api_key');
    }

    public function isConfigured(): bool
    {
        return !empty($this->apiKey);
    }

    /**
     * Corregir ortografía y gramática de un texto.
     * Si falla por cualquier motivo, retorna el texto original sin cambios.
     *
     * @param string $text Texto a corregir
     * @return string Texto corregido (o el original si falla)
     */
    public function correct(string $text): string
    {
        // No corregir si no está configurado
        if (!$this->isConfigured()) {
            return $text;
        }

        // No corregir mensajes muy cortos (saludos, "ok", etc.)
        $trimmed = trim($text);
        if (mb_strlen($trimmed) < 10) {
            return $text;
        }

        // No corregir si solo contiene emojis, URLs o caracteres especiales
        $withoutEmojis = preg_replace('/[\x{1F600}-\x{1F64F}\x{1F300}-\x{1F5FF}\x{1F680}-\x{1F6FF}\x{1F1E0}-\x{1F1FF}\x{2600}-\x{26FF}\x{2700}-\x{27BF}]/u', '', $trimmed);
        if (mb_strlen(trim($withoutEmojis)) < 5) {
            return $text;
        }

        // No corregir URIs o mensajes que son solo enlaces
        if (preg_match('/^https?:\/\//i', $trimmed)) {
            return $text;
        }

        try {
            $response = Http::timeout(2) // Máximo 2 segundos
                ->connectTimeout(1) // Máximo 1 segundo para conectar
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $this->apiKey,
                    'Content-Type' => 'application/json',
                ])
                ->post($this->baseUrl . '/chat/completions', [
                    'model' => $this->model,
                    'messages' => [
                        [
                            'role' => 'system',
                            'content' => 'Eres un corrector ortográfico y gramatical de español. Tu ÚNICA tarea es corregir errores de ortografía y gramática. Reglas estrictas:
- Devuelve SOLO el texto corregido, sin explicaciones ni comentarios.
- NO cambies el significado, tono, ni estilo del mensaje.
- NO agregues ni quites palabras innecesariamente.
- Mantén los emojis, saltos de línea y formato exactamente igual.
- Corrige tildes, letras intercambiadas (b/v, s/c/z, ll/y), puntuación y concordancia.
- Si el texto ya está correcto, devuélvelo tal cual.
- NO agregues signos de puntuación al final si el mensaje original no los tiene.
- Respeta las abreviaciones médicas y términos técnicos hospitalarios.'
                        ],
                        [
                            'role' => 'user',
                            'content' => $text,
                        ],
                    ],
                    'temperature' => 0,
                    'max_tokens' => 500,
                ]);

            if ($response->successful()) {
                $data = $response->json();
                $corrected = $data['choices'][0]['message']['content'] ?? null;

                if ($corrected && !empty(trim($corrected))) {
                    // Verificar que la corrección no sea drasticamente diferente
                    // (protección contra alucinaciones de la IA)
                    $originalLen = mb_strlen($text);
                    $correctedLen = mb_strlen($corrected);
                    $ratio = $originalLen > 0 ? $correctedLen / $originalLen : 1;

                    // Si la longitud cambió más de 50%, algo salió mal
                    if ($ratio < 0.5 || $ratio > 1.5) {
                        Log::warning('SpellCheck: Corrección descartada por cambio excesivo de longitud', [
                            'original_len' => $originalLen,
                            'corrected_len' => $correctedLen,
                        ]);
                        return $text;
                    }

                    // Limpiar posibles comillas que la IA a veces agrega
                    $corrected = trim($corrected, '"\'');

                    if ($corrected !== $text) {
                        Log::info('SpellCheck: Texto corregido', [
                            'original' => mb_substr($text, 0, 100),
                            'corrected' => mb_substr($corrected, 0, 100),
                        ]);
                    }

                    return $corrected;
                }
            }

            // Si la API respondió con error (rate limit, etc.), usar texto original
            Log::debug('SpellCheck: API no exitosa, usando texto original', [
                'status' => $response->status(),
            ]);
            return $text;

        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            // Timeout o error de conexión - silencioso
            Log::debug('SpellCheck: Timeout, usando texto original');
            return $text;
        } catch (\Exception $e) {
            // Cualquier otro error - silencioso
            Log::debug('SpellCheck: Error, usando texto original', [
                'error' => $e->getMessage(),
            ]);
            return $text;
        }
    }
}
