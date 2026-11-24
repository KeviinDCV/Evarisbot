<?php

namespace App\Http\Controllers;

use App\Models\Llamada;
use App\Services\LlamadasWhatsApp;
use App\Services\RobotLlamadas;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Avisos del ROBOT DE LLAMADAS (robot-llamadas/robot.py) a Evarisbot: la tecla que marcó el paciente, que no marcó nada,
 * que hay que colgar. Va fuera del grupo 'web' (sin sesión ni CSRF): lo protege la firma HMAC con la clave del robot y
 * que la petición venga del mismo PC sin pasar por el proxy (Tailscale entra por 127.0.0.1 pero con X-Forwarded-For).
 */
class RobotLlamadasController extends Controller
{
    public function evento(Request $request, LlamadasWhatsApp $servicio): JsonResponse
    {
        $local = in_array($request->server('REMOTE_ADDR'), ['127.0.0.1', '::1'], true) && ! $request->headers->has('X-Forwarded-For');
        $cuerpo = $request->getContent();
        if (! $local || ! RobotLlamadas::firmaValida($cuerpo, (string) $request->header('X-Robot-Firma'))) {
            Log::warning('Robot de llamadas: aviso rechazado', ['local' => $local]);

            return response()->json(['error' => 'no_autorizado'], 403);
        }
        $datos = json_decode($cuerpo, true);
        $llamada = is_array($datos) ? Llamada::where('origen', 'robot')->find((int) ($datos['id'] ?? 0)) : null;
        if (! $llamada) {
            return response()->json(['error' => 'no_existe'], 404);
        }

        return match ((string) ($datos['evento'] ?? '')) {
            'digito' => response()->json($this->tecla($llamada, (string) ($datos['digito'] ?? ''))),
            'sin_respuesta' => $this->anotar($llamada, ['resultado_robot' => $llamada->resultado_robot ?? 'sin_tecla']),
            'terminar', 'fallo' => $this->colgar($llamada, $servicio, (string) $datos['evento']),
            default => response()->json(['error' => 'evento'], 422),
        };
    }

    /**
     * Qué significa cada tecla y qué dice el robot. 1 confirma, 2 cancela, 9 repite. En una llamada de prueba (sin cita)
     * solo se anota.
     *
     * @return array{decir?: string, fin?: bool, repetir?: bool}
     */
    private function tecla(Llamada $llamada, string $tecla): array
    {
        $tecla = mb_substr(preg_replace('/[^0-9*#]/', '', $tecla), 0, 1);
        Log::info('Robot de llamadas: el paciente marcó', ['llamada_id' => $llamada->id, 'tecla' => $tecla]);
        // Recordatorio de una cita real: la tecla confirma o cancela esa cita (igual que los botones del recordatorio).
        if ($llamada->cita_id) {
            return app(\App\Services\RecordatoriosPorLlamada::class)->tecla($llamada, $tecla);
        }
        if ($tecla === '9') {
            return ['repetir' => true];
        }
        if ($tecla === '3') {
            // Prueba: se dice el texto de «no llamar» y se anota, pero no se registra ningún «no» (no hay paciente real).
            $llamada->update(['tecla' => '3', 'resultado_robot' => 'no_llamar']);

            return ['decir' => 'no_llamar', 'fin' => true];
        }
        if ($tecla === '1' || $tecla === '2') {
            $llamada->update(['tecla' => $tecla, 'resultado_robot' => $tecla === '1' ? 'confirmo' : 'cancelo']);

            return ['decir' => $tecla === '1' ? 'confirmada' : 'cancelada', 'fin' => true];
        }
        $llamada->update(['tecla' => $tecla !== '' ? $tecla : $llamada->tecla]);

        return ['decir' => 'no_entendi', 'fin' => false];
    }

    private function anotar(Llamada $llamada, array $cambios): JsonResponse
    {
        $llamada->update($cambios);

        return response()->json(['ok' => true]);
    }

    private function colgar(Llamada $llamada, LlamadasWhatsApp $servicio, string $evento): JsonResponse
    {
        if (in_array($llamada->estado, Llamada::VIVAS, true)) {
            $servicio->colgar($llamada, $evento === 'fallo' ? 'red' : null);
        }

        return response()->json(['ok' => true]);
    }
}
