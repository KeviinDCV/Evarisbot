<?php

namespace App\Console\Commands;

use App\Models\Setting;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * Guarda la clave de Groq (transcripción de audios y corrector) desde la consola del servidor.
 *
 * Igual que whatsapp:guardar-token: la clave se pide sin mostrarla, se comprueba contra Groq antes
 * de guardarla y queda cifrada en settings. Solo imprime su huella, para verificarla sin exponerla.
 */
class GuardarClaveGroq extends Command
{
    protected $signature = 'groq:guardar-clave';

    protected $description = 'Guarda la clave de Groq desde la consola (sin pasar por la web), tras comprobar que funciona';

    public function handle(): int
    {
        $clave = trim((string) $this->secret('Pega la clave nueva de Groq (no se mostrará al escribirla) y pulsa Enter'));

        if (strlen($clave) < 20 || preg_match('/\s/', $clave)) {
            $this->error('Eso no parece una clave de Groq (muy corta o con espacios). No se guardó nada.');
            return self::FAILURE;
        }

        $this->line('Comprobando la clave con Groq...');

        $respuesta = Http::withToken($clave)->timeout(20)->get('https://api.groq.com/openai/v1/models');

        if (! $respuesta->successful()) {
            $this->error('Groq rechazó la clave: ' . ($respuesta->json('error.message') ?? ('HTTP ' . $respuesta->status())) . '. No se guardó nada.');
            return self::FAILURE;
        }

        Setting::set('groq_api_key', $clave, 'API Key de Groq para transcripción de audio');

        $this->info('Clave de Groq guardada (cifrada).');
        // Solo la huella: ni el inicio ni el final de la clave salen en pantalla.
        $this->line('Huella de la clave: ' . substr(hash('sha256', $clave), 0, 16));

        return self::SUCCESS;
    }
}
