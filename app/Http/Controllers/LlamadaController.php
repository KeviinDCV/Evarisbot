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
            ->whereIn('estado', ['conectando', 'en_curso'])
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

        return response()->json([
            'id' => $llamada->id,
            'estado' => $llamada->estado,
            'atendida_por' => $llamada->atendida_por,
            'duracion' => $llamada->duracion,
        ]);
    }

    public function contestar(Request $request, Llamada $llamada, LlamadasWhatsApp $servicio): JsonResponse
    {
        abort_unless($this->puede($llamada), 403);
        $datos = $request->validate(['sdp' => 'required|string|min:20|max:30000']);

        $r = $servicio->contestar($llamada, auth()->user(), $datos['sdp']);

        return response()->json($r, $r['ok'] ? 200 : 409);
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
