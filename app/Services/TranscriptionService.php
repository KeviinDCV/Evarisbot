<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class TranscriptionService
{
    protected ?string $apiKey;
    protected string $baseUrl = 'https://api.groq.com/openai/v1';
    protected string $model = 'whisper-large-v3-turbo';

    public function __construct()
    {
        $this->apiKey = Setting::get('groq_api_key');
    }

    public function isConfigured(): bool
    {
        return !empty($this->apiKey);
    }

    /**
     * Transcribir un archivo de audio
     * 
     * @param string $audioPath Ruta del archivo de audio (local o URL)
     * @return string|null Texto transcrito o null si falla
     */
    public function transcribe(string $audioPath): ?string
    {
        if (!$this->isConfigured()) {
            Log::warning('TranscriptionService: Groq API key not configured');
            return null;
        }

        try {
            // Si es una URL, descargar el archivo primero
            if (filter_var($audioPath, FILTER_VALIDATE_URL)) {
                $audioPath = $this->downloadAudio($audioPath);
                if (!$audioPath) {
                    return null;
                }
            }

            // Si es una ruta relativa de storage, convertir a ruta absoluta
            if (str_starts_with($audioPath, '/storage/')) {
                $relativePath = str_replace('/storage/', '', $audioPath);
                $audioPath = Storage::disk('public')->path($relativePath);
            }

            if (!file_exists($audioPath)) {
                Log::error('TranscriptionService: Audio file not found', ['path' => $audioPath]);
                return null;
            }

            // Enviar a Groq Whisper API
            $response = Http::timeout(120)
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $this->apiKey,
                ])
                ->attach('file', file_get_contents($audioPath), basename($audioPath))
                ->post($this->baseUrl . '/audio/transcriptions', [
                    'model' => $this->model,
                    'response_format' => 'text',
                    'language' => 'es', // Español por defecto
                ]);

            if ($response->successful()) {
                $transcription = trim($response->body());
                Log::info('TranscriptionService: Audio transcribed successfully', [
                    'length' => strlen($transcription),
                ]);
                return $transcription;
            }

            Log::error('TranscriptionService: Groq API error', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            return null;

        } catch (\Exception $e) {
            Log::error('TranscriptionService: Exception during transcription', [
                'message' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Descargar audio desde URL a archivo temporal
     */
    protected function downloadAudio(string $url): ?string
    {
        try {
            $response = Http::timeout(60)->get($url);
            
            if (!$response->successful()) {
                Log::error('TranscriptionService: Failed to download audio', ['url' => $url]);
                return null;
            }

            $tempPath = sys_get_temp_dir() . '/audio_' . uniqid() . '.ogg';
            file_put_contents($tempPath, $response->body());

            return $tempPath;
        } catch (\Exception $e) {
            Log::error('TranscriptionService: Exception downloading audio', [
                'url' => $url,
                'message' => $e->getMessage(),
            ]);
            return null;
        }
    }
}
