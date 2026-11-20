<?php

namespace App\Http\Controllers;

use App\Models\Llamada;
use App\Services\LlamadasWhatsApp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Pantalla de llamadas de WhatsApp (el timbre y la llamada en curso viven en el marco de la app, en todas las pantallas).
 */
class LlamadaController extends Controller
{
    /**
     * Llamadas que le timbran a este usuario ahora mismo (con la oferta SDP para poder contestar) y, si la tiene, SU
     * llamada viva: tras recargar la página el audio se perdió, pero la tarjeta debe dejar colgarla.
     */
    public function pendientes(): JsonResponse
    {
        $user = auth()->user();
        $llamadas = Llamada::with(['conversation:id,contact_name,phone_number,equipo_id,assigned_to,status', 'conversation.assignedUser:id,is_on_duty'])
            ->where('estado', 'timbrando')
            ->where(fn ($q) => LlamadasWhatsApp::aunTimbra($q))
            ->orderBy('id')
            ->get()
            ->filter(fn (Llamada $l) => LlamadasWhatsApp::puedeAtender($user, $l->conversation))
            ->map(fn (Llamada $l) => $this->paraPantalla($l) + ['sdp_oferta' => $l->sdp_oferta])
            ->values();

        $mia = Llamada::with('conversation:id,contact_name')
            ->whereIn('estado', ['conectando', 'en_curso', 'llamando', 'sonando'])
            ->where('atendida_por', $user->id)
            ->where('updated_at', '>=', now()->subHours(3))
            ->latest('id')->first();

        return response()->json([
            'llamadas' => $llamadas,
            'mia' => $mia ? $this->paraPantalla($mia) + ['estado' => $mia->estado] : null,
            // Ensayo (whatsapp:llamadas --solo): en un equipo sin micrófono se puede contestar solo escuchando.
            'sin_microfono' => LlamadasWhatsApp::usuariosEnsayo() !== [],
        ]);
    }

    private function paraPantalla(Llamada $l): array
    {
        return [
            'id' => $l->id,
            'conversation_id' => $l->conversation_id,
            'nombre' => $l->conversation?->contact_name,
            'telefono' => $l->telefono,
            'desde' => ($l->iniciada_en ?? $l->created_at)?->toIso8601String(),
        ];
    }

    /** Estado de una llamada (para cerrar la pantalla cuando el paciente cuelga u otro contesta). */
    public function estado(Llamada $llamada): JsonResponse
    {
        abort_unless($this->puede($llamada), 403);

        // La que hizo este usuario: si la respuesta de Meta llegó antes que su id, se aplica ahora.
        $mia = $llamada->direccion === 'saliente' && (int) $llamada->atendida_por === (int) auth()->id();
        if ($mia && $llamada->sdp_oferta === null && in_array($llamada->estado, ['llamando', 'sonando'], true) && ! str_starts_with($llamada->wa_call_id, 'pendiente.')) {
            app(LlamadasWhatsApp::class)->repetirTempranos($llamada->wa_call_id);
            $llamada->refresh();
        }

        return response()->json([
            'id' => $llamada->id,
            'estado' => $llamada->estado,
            'atendida_por' => $llamada->atendida_por,
            'duracion' => $llamada->duracion,
            'motivo' => $mia ? $llamada->motivo : null,
            // Respuesta SDP de Meta (solo a quien llamó, mientras la llamada está viva).
            'sdp_respuesta' => $mia && in_array($llamada->estado, ['llamando', 'sonando', 'en_curso'], true) ? $llamada->sdp_oferta : null,
        ]);
    }

    public function contestar(Request $request, Llamada $llamada, LlamadasWhatsApp $servicio): JsonResponse
    {
        abort_unless($this->puede($llamada), 403);
        $datos = $request->validate(['sdp' => 'required|string|min:20|max:30000']);

        $r = $servicio->contestar($llamada, auth()->user(), $datos['sdp']);

        return response()->json($r, $r['ok'] ? 200 : 409);
    }

    /**
     * Llamar al paciente de este chat. El navegador manda su oferta WebRTC; la respuesta de Meta llega después (el
     * navegador la recoge en /estado). Solo quien puede abrir el chat, con las llamadas activas (y en ensayo, solo los
     * usuarios y números del ensayo).
     */
    public function llamar(Request $request, \App\Models\Conversation $conversation, LlamadasWhatsApp $servicio): JsonResponse
    {
        $user = auth()->user();
        abort_unless($user && ($user->isAdmin() || $user->isAdvisor()) && $conversation->visiblePara($user), 403);
        $datos = $request->validate(['sdp' => 'required|string|min:20|max:30000']);

        $error = match (true) {
            ! LlamadasWhatsApp::activas() => 'desactivadas',
            (bool) $conversation->is_blocked => 'bloqueado',
            LlamadasWhatsApp::usuariosEnsayo() !== [] && (! in_array((int) $user->id, LlamadasWhatsApp::usuariosEnsayo(), true)
                || ! in_array(preg_replace('/\D/', '', (string) $conversation->phone_number), LlamadasWhatsApp::numerosEnsayo(), true)) => 'ensayo',
            Llamada::where('atendida_por', $user->id)->whereIn('estado', Llamada::VIVAS)->where('updated_at', '>=', now()->subMinutes(30))->exists() => 'ocupado',
            default => null,
        };
        if ($error) {
            return response()->json(['ok' => false, 'error' => $error], 409);
        }

        $r = $servicio->llamar($conversation, $user, $datos['sdp']);

        return response()->json([
            'ok' => $r['ok'],
            'error' => $r['error'] ?? null,
            'llamada' => isset($r['llamada']) ? $this->paraPantalla($r['llamada']->loadMissing('conversation:id,contact_name')) + ['estado' => $r['llamada']->estado] : null,
        ], $r['ok'] ? 200 : 409);
    }

    public function colgar(Request $request, Llamada $llamada, LlamadasWhatsApp $servicio): JsonResponse
    {
        $user = auth()->user();
        abort_unless($user->isAdmin() || (int) $llamada->atendida_por === (int) $user->id, 403);
        $motivo = $request->validate(['motivo' => 'nullable|string|in:red,pestana'])['motivo'] ?? null;
        if (! in_array($llamada->estado, Llamada::VIVAS, true)) {
            return response()->json(['ok' => true]);
        }

        return response()->json(['ok' => $servicio->colgar($llamada, $motivo)]);
    }

    private function puede(Llamada $llamada): bool
    {
        $user = auth()->user();

        return (int) $llamada->atendida_por === (int) $user->id
            || LlamadasWhatsApp::puedeAtender($user, $llamada->conversation);
    }
}
