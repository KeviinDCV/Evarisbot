<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SpellCheckService
{
    protected ?string $apiKey;
    protected string $baseUrl = 'https://api.groq.com/openai/v1';
    // OJO al cambiar de modelo: Groq retira los suyos sin avisar. 'llama-3.3-70b-versatile'
    // estuvo devolviendo 404 model_not_found sin que nadie lo notara, porque el fallo se
    // registraba en nivel debug y el LOG_LEVEL efectivo es info. Para ver cuáles siguen
    // vivos: GET https://api.groq.com/openai/v1/models
    protected string $model = 'openai/gpt-oss-120b';

    // Modelo de reserva. Groq da el cupo gratuito POR MODELO (200.000 tokens al día cada uno): cuando
    // el principal se queda sin cupo (pasaba a diario hacia las 11 a. m.–1 p. m. y el resto del día
    // los mensajes salían sin corregir), se usa este hasta que el principal vuelva a tener cupo.
    protected string $modeloReserva = 'openai/gpt-oss-20b';

    // Los gpt-oss «piensan» antes de responder y ese razonamiento cuenta dentro de max_tokens. Con el
    // esfuerzo por defecto y un tope fijo de 500, en los mensajes largos el razonamiento se comía el tope:
    // la respuesta llegaba vacía o CORTADA, y la cortada se enviaba al paciente si no bajaba de la mitad
    // del largo (nov 2026: mensajes que terminaban en «…continuaremos con tu»). Por eso: esfuerzo bajo,
    // tope según el largo del texto y solo se acepta una respuesta terminada (finish_reason = stop).
    protected const ESFUERZO = 'low';

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

        // Las respuestas guardadas se mandan decenas de veces al día con el mismo texto: la corrección se
        // recuerda 24 h para no gastar cupo de Groq en repetirla (con temperature 0 saldría igual).
        $claveCache = 'corrector:v2:' . sha1($text);
        $recordada = $this->conCache(fn () => Cache::get($claveCache));
        if (is_string($recordada) && $recordada !== '') {
            return $recordada;
        }

        foreach ([$this->model, $this->modeloReserva] as $modelo) {
            // Modelo sin cupo hace poco: ni se intenta hasta que pase la pausa que pidió Groq.
            if ($this->conCache(fn () => Cache::get('corrector:sin-cupo:' . $modelo))) {
                continue;
            }

            $resultado = $this->pedirCorreccion($modelo, $text);

            if ($resultado === false) {
                continue; // sin cupo: se prueba con el siguiente modelo
            }
            if ($resultado === null) {
                return $text; // cualquier otro fallo: el texto tal cual
            }

            // Solo se recuerda lo del modelo principal: el de reserva reescribe un poco más y no conviene
            // repetir su versión todo el día cuando el principal ya tenga cupo.
            if ($modelo === $this->model) {
                $this->conCache(fn () => Cache::put($claveCache, $resultado, now()->addHours(24)));
                $this->limpiarVencidas();
            }

            return $resultado;
        }

        // Ningún modelo tiene cupo ahora mismo (cada 429 ya quedó registrado una vez).
        return $text;
    }

    /**
     * Pide la corrección a un modelo.
     *
     * @return string|false|null El texto corregido; false si el modelo no tiene cupo (429); null ante
     *                           cualquier otro fallo (se envía el original).
     */
    protected function pedirCorreccion(string $modelo, string $text): string|false|null
    {
        $largo = mb_strlen($text);

        try {
            $response = Http::timeout(min(5, 2 + intdiv($largo, 1000))) // 2 s; un poco más si el texto es largo
                ->connectTimeout(1) // Máximo 1 segundo para conectar
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $this->apiKey,
                    'Content-Type' => 'application/json',
                ])
                ->post($this->baseUrl . '/chat/completions', [
                    'model' => $modelo,
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
                    // Razonamiento (~50-100 tokens con esfuerzo bajo) + el texto completo con holgura.
                    'max_tokens' => min(3000, 300 + (int) ceil($largo / 2)),
                    'reasoning_effort' => self::ESFUERZO,
                    'include_reasoning' => false,
                ]);
        } catch (ConnectionException $e) {
            // Va en warning (antes era debug y no quedaba rastro con LOG_LEVEL=info).
            Log::warning('SpellCheck: Groq no respondió a tiempo, se envía el texto sin corregir', [
                'modelo' => $modelo,
                'largo' => $largo,
            ]);
            return null;
        } catch (\Throwable $e) {
            Log::warning('SpellCheck: error inesperado, se envía el texto sin corregir', [
                'modelo' => $modelo,
                'error' => mb_substr($e->getMessage(), 0, 200),
            ]);
            return null;
        }

        // Sin cupo (tokens por día o por minuto): se pausa este modelo lo que pida Groq (entre 30 s y 30 min).
        if ($response->status() === 429) {
            $pausa = (int) $response->header('retry-after');
            $pausa = max(30, min(1800, $pausa > 0 ? $pausa : 300));
            $this->conCache(fn () => Cache::put('corrector:sin-cupo:' . $modelo, true, now()->addSeconds($pausa)));
            Log::warning('SpellCheck: Groq sin cupo para este modelo, se pausa y se prueba el de reserva', [
                'modelo' => $modelo,
                'pausa_segundos' => $pausa,
                'respuesta' => mb_substr((string) $response->body(), 0, 300),
            ]);
            return false;
        }

        // Si la API respondió con error (modelo retirado, clave…), texto original.
        //
        // Va en warning y no en debug a propósito: con LOG_LEVEL=info los debug no se
        // escriben, y así fue como un modelo retirado dejó el corrector muerto sin dejar
        // rastro. Se adjunta el cuerpo del error porque ahí es donde Groq da el motivo.
        if (!$response->successful()) {
            Log::warning('SpellCheck: la API respondió con error, se envía el texto sin corregir', [
                'status' => $response->status(),
                'modelo' => $modelo,
                'respuesta' => mb_substr((string) $response->body(), 0, 300),
            ]);
            return null;
        }

        $data = $response->json();
        $fin = $data['choices'][0]['finish_reason'] ?? null;
        $corrected = $data['choices'][0]['message']['content'] ?? null;

        // Solo vale una respuesta TERMINADA. Una cortada por el tope (finish_reason = length) nunca se envía.
        if ($fin !== 'stop' || !is_string($corrected) || trim($corrected) === '') {
            Log::warning('SpellCheck: respuesta incompleta, se envía el texto sin corregir', [
                'modelo' => $modelo,
                'fin' => $fin,
                'largo' => $largo,
                'tokens_salida' => $data['usage']['completion_tokens'] ?? null,
            ]);
            return null;
        }

        // Verificar que la corrección no sea drasticamente diferente
        // (protección contra alucinaciones de la IA)
        $correctedLen = mb_strlen($corrected);
        $ratio = $largo > 0 ? $correctedLen / $largo : 1;

        // Si la longitud cambió más de 50%, algo salió mal
        if ($ratio < 0.5 || $ratio > 1.5) {
            Log::warning('SpellCheck: Corrección descartada por cambio excesivo de longitud', [
                'modelo' => $modelo,
                'original_len' => $largo,
                'corrected_len' => $correctedLen,
            ]);
            return null;
        }

        // Quitar las comillas con que la IA a veces ENVUELVE todo el texto. Solo un par que envuelve todo
        // y solo si el original no venía envuelto igual: las comillas de dentro («responda "SÍ"») no se tocan.
        $corrected = trim($corrected);
        $original = trim($text);
        foreach (['"', "'"] as $comilla) {
            if (mb_strlen($corrected) >= 2
                && str_starts_with($corrected, $comilla) && str_ends_with($corrected, $comilla)
                && !(str_starts_with($original, $comilla) && str_ends_with($original, $comilla))) {
                $corrected = trim(mb_substr($corrected, 1, -1));
                break;
            }
        }
        // Nunca se envía un mensaje vacío, ni uno sin letras ni números si el original los tenía.
        if ($corrected === '' || (preg_match('/[\p{L}\p{N}]/u', $text) && !preg_match('/[\p{L}\p{N}]/u', $corrected))) {
            return null;
        }

        if ($corrected !== $text) {
            Log::info('SpellCheck: Texto corregido', [
                'original' => mb_substr($text, 0, 100),
                'corrected' => mb_substr($corrected, 0, 100),
                'modelo' => $modelo,
            ]);
        }

        return $corrected;
    }

    /**
     * La caché en base de datos no borra sola lo vencido (solo al volver a leer esa misma clave) y el
     * programador de tareas no corre en el servidor: sin esto, cada mensaje distinto dejaría su fila para
     * siempre en la tabla cache. De vez en cuando (1 de cada 50 correcciones) se borran las filas VENCIDAS
     * de este corrector, y solo esas.
     */
    protected int $sorteoLimpieza = 50;

    protected function limpiarVencidas(): void
    {
        if (config('cache.default') !== 'database' || random_int(1, $this->sorteoLimpieza) !== 1) {
            return;
        }

        $this->conCache(fn () => DB::connection(config('cache.stores.database.connection'))
            ->table(config('cache.stores.database.table', 'cache'))
            ->where('key', 'like', Cache::getPrefix() . 'corrector:%')
            ->where('expiration', '<', now()->getTimestamp())
            ->limit(200)
            ->delete());
    }

    /**
     * La caché solo ahorra cupo: si falla, se sigue como si no existiera (nunca frena un envío).
     */
    protected function conCache(callable $operacion): mixed
    {
        try {
            return $operacion();
        } catch (\Throwable $e) {
            return null;
        }
    }
}
