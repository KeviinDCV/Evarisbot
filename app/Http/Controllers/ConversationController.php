<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ConversationController extends Controller
{
    /**
     * Mostrar la lista de conversaciones
     */
    public function index(Request $request)
    {
        $query = Conversation::with(['lastMessage', 'assignedUser'])
            ->orderBy('last_message_at', 'desc');

        // Filtrar por estado si se proporciona
        if ($request->has('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // Filtrar por asignación
        if ($request->has('assigned') && $request->assigned === 'me') {
            $query->where('assigned_to', auth()->id());
        } elseif ($request->has('assigned') && $request->assigned === 'unassigned') {
            $query->whereNull('assigned_to');
        }

        // Buscar por nombre o teléfono
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('contact_name', 'like', "%{$search}%")
                  ->orWhere('phone_number', 'like', "%{$search}%");
            });
        }

        $conversations = $query->get();

        return Inertia::render('conversations/index', [
            'conversations' => $conversations,
            'filters' => $request->only(['status', 'assigned', 'search']),
        ]);
    }

    /**
     * Mostrar una conversación específica con sus mensajes
     */
    public function show(Conversation $conversation)
    {
        $conversation->load(['messages.sender', 'assignedUser']);
        
        // Marcar mensajes como leídos
        $conversation->markAsRead();

        return Inertia::render('conversations/show', [
            'conversation' => $conversation,
        ]);
    }

    /**
     * Enviar un mensaje en la conversación
     */
    public function sendMessage(Request $request, Conversation $conversation)
    {
        $validated = $request->validate([
            'content' => 'required|string',
            'message_type' => 'string|in:text,image,document,audio,video',
        ]);

        $message = $conversation->messages()->create([
            'content' => $validated['content'],
            'message_type' => $validated['message_type'] ?? 'text',
            'is_from_user' => false,
            'sent_by' => auth()->id(),
            'status' => 'pending',
        ]);

        // Actualizar última actividad de la conversación
        $conversation->update([
            'last_message_at' => now(),
        ]);

        // TODO: Enviar mensaje real vía WhatsApp API

        return back();
    }

    /**
     * Asignar conversación a un asesor
     */
    public function assign(Request $request, Conversation $conversation)
    {
        $validated = $request->validate([
            'user_id' => 'nullable|exists:users,id',
        ]);

        $conversation->update([
            'assigned_to' => $validated['user_id'] ?? auth()->id(),
            'status' => 'in_progress',
        ]);

        return back()->with('success', 'Conversación asignada exitosamente.');
    }

    /**
     * Cambiar estado de la conversación
     */
    public function updateStatus(Request $request, Conversation $conversation)
    {
        $validated = $request->validate([
            'status' => 'required|in:active,pending,in_progress,resolved,closed',
        ]);

        $conversation->update(['status' => $validated['status']]);

        return back()->with('success', 'Estado actualizado.');
    }
}
