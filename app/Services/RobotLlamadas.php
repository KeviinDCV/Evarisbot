<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Cliente del ROBOT DE LLAMADAS (robot-llamadas/robot.py): el programa en Python que, en este mismo PC, hace de
 * «teléfono» para los recordatorios de cita por voz. Solo escucha en 127.0.0.1 y pide una clave (robot-llamadas/
 * clave.txt, fuera de git). Evarisbot habla con Meta; el robot pone la voz y oye las teclas que marca el paciente.
 */
class RobotLlamadas
{
    // Voz LOCAL Supertonic 3, voz F5 (elegida por el usuario el 20/11/2026, muestra «5b-final-a»): sin internet ni cuentas.
    // El robot la fabrica en el propio PC; si falla, usa Dalia (es-MX-DaliaNeural, la del 19/11) de respaldo.
    public const VOZ = 'supertonic:F5';

    public static function url(): string
    {
        return 'http://127.0.0.1:'.(int) env('ROBOT_LLAMADAS_PUERTO', 8791);
    }

    public static function clave(): string
    {
        $ruta = base_path('robot-llamadas/clave.txt');

        return is_file($ruta) ? trim((string) file_get_contents($ruta)) : '';
    }

    /** ¿Está corriendo el robot? */
    public static function disponible(): bool
    {
        $r = self::pedir('get', '/estado', [], 3);

        return ($r['ok'] ?? false) === true;
    }

    /**
     * Prepara la llamada en el robot (fabrica los audios y arma la oferta WebRTC).
     *
     * @param  array<string, string>  $textos  mensaje, pregunta, confirmada, cancelada, no_entendi, sin_respuesta…
     * @return array{ok: bool, sdp?: string, error?: string}
     */
    public static function ofertar(int $llamadaId, array $textos, string $voz = self::VOZ): array
    {
        $r = self::pedir('post', '/llamar', ['id' => $llamadaId, 'voz' => $voz, 'velocidad' => '-4%', 'textos' => $textos], 45);
        if (is_string($r['sdp'] ?? null) && $r['sdp'] !== '') {
            return ['ok' => true, 'sdp' => $r['sdp']];
        }

        return ['ok' => false, 'error' => (string) ($r['error'] ?? 'robot_no_disponible')];
    }

    public static function respuesta(int $llamadaId, string $sdp): bool
    {
        return (self::pedir('post', '/respuesta', ['id' => $llamadaId, 'sdp' => $sdp], 10)['ok'] ?? false) === true;
    }

    public static function contesto(int $llamadaId): bool
    {
        return (self::pedir('post', '/contesto', ['id' => $llamadaId], 5)['ok'] ?? false) === true;
    }

    public static function cerrar(int $llamadaId): void
    {
        self::pedir('post', '/cerrar', ['id' => $llamadaId], 5);
    }

    /** Comprueba la firma de un aviso del robot (HMAC-SHA256 del cuerpo con la clave). */
    public static function firmaValida(string $cuerpo, string $firma): bool
    {
        $clave = self::clave();

        return strlen($clave) >= 32 && $firma !== '' && hash_equals(hash_hmac('sha256', $cuerpo, $clave), $firma);
    }

    /** Nunca lanza: si el robot no está, devuelve ['error' => …]. */
    private static function pedir(string $metodo, string $ruta, array $datos, int $segundos): array
    {
        $clave = self::clave();
        if (strlen($clave) < 32) {
            return ['error' => 'robot_sin_clave'];
        }
        try {
            $peticion = Http::withHeaders(['X-Robot-Clave' => $clave])->timeout($segundos)->connectTimeout(2);
            $r = $metodo === 'get' ? $peticion->get(self::url().$ruta) : $peticion->post(self::url().$ruta, $datos);
            $json = $r->json();

            return is_array($json) ? $json : ['error' => 'HTTP '.$r->status()];
        } catch (\Throwable $e) {
            Log::warning('Robot de llamadas: no responde', ['ruta' => $ruta, 'error' => mb_substr($e->getMessage(), 0, 160)]);

            return ['error' => 'robot_no_disponible'];
        }
    }
}
