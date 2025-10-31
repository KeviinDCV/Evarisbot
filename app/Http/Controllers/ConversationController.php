<?php

namespace App\Http\Controllers;

use App\Events\MessageSent;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use App\Services\WhatsAppService;
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
            ->where('status', '!=', 'closed') // No mostrar conversaciones cerradas
            ->orderBy('last_message_at', 'desc');

        // Si es asesor, solo ver conversaciones asignadas a él
        if (auth()->user()->isAdvisor()) {
            $query->where('assigned_to', auth()->id());
        }

        // Filtrar por estado si se proporciona
        if ($request->has('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // Filtrar por asignación (solo para admin)
        if (auth()->user()->isAdmin()) {
            if ($request->has('assigned') && $request->assigned === 'me') {
                $query->where('assigned_to', auth()->id());
            } elseif ($request->has('assigned') && $request->assigned === 'unassigned') {
                $query->whereNull('assigned_to');
            }
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

        // Obtener todos los usuarios (asesores) disponibles para asignación
        $users = User::select('id', 'name', 'role')->get();

        return Inertia::render('conversations/index', [
            'conversations' => $conversations,
            'users' => $users,
            'filters' => $request->only(['status', 'assigned', 'search']),
        ]);
    }

    /**
     * Mostrar una conversación específica con sus mensajes
     */
    public function show(Request $request, Conversation $conversation)
    {
        // Validar acceso: asesores solo pueden ver conversaciones asignadas a ellos
        if (auth()->user()->isAdvisor() && $conversation->assigned_to !== auth()->id()) {
            abort(403, 'No tienes permiso para ver esta conversación.');
        }

        $query = Conversation::with(['lastMessage', 'assignedUser'])
            ->where('status', '!=', 'closed') // No mostrar conversaciones cerradas
            ->orderBy('last_message_at', 'desc');

        // Si es asesor, solo ver sus conversaciones
        if (auth()->user()->isAdvisor()) {
            $query->where('assigned_to', auth()->id());
        }

        // Aplicar filtros si existen (solo admin)
        if (auth()->user()->isAdmin()) {
            if ($request->has('status') && $request->status !== 'all') {
                $query->where('status', $request->status);
            }

            if ($request->has('assigned') && $request->assigned === 'me') {
                $query->where('assigned_to', auth()->id());
            } elseif ($request->has('assigned') && $request->assigned === 'unassigned') {
                $query->whereNull('assigned_to');
            }
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('contact_name', 'like', "%{$search}%")
                  ->orWhere('phone_number', 'like', "%{$search}%");
            });
        }

        $conversations = $query->get();
        
        // Cargar la conversación seleccionada con todos sus mensajes
        $conversation->load(['messages.sender', 'assignedUser']);
        
        // Marcar mensajes como leídos
        $conversation->markAsRead();

        // Obtener todos los usuarios (asesores) disponibles para asignación
        $users = User::select('id', 'name', 'role')->get();

        return Inertia::render('conversations/index', [
            'conversations' => $conversations,
            'selectedConversation' => $conversation,
            'users' => $users,
            'filters' => $request->only(['status', 'assigned', 'search']),
        ]);
    }

    /**
     * Enviar un mensaje en la conversación
     */
    public function sendMessage(Request $request, Conversation $conversation, WhatsAppService $whatsappService)
    {
        $validated = $request->validate([
            'content' => 'required|string',
            'message_type' => 'string|in:text,image,document,audio,video',
        ]);

        // Crear el mensaje en la base de datos
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

        // Enviar mensaje usando WhatsApp Business API
        if ($whatsappService->isConfigured()) {
            $result = $whatsappService->sendTextMessage(
                $conversation->phone_number,
                $validated['content']
            );

            if ($result['success']) {
                $message->update([
                    'status' => 'sent',
                    'whatsapp_message_id' => $result['message_id'],
                ]);
            } else {
                $message->update([
                    'status' => 'failed',
                    'error_message' => $result['error'],
                ]);
            }
        } else {
            // Si WhatsApp API no está configurado, marcar como fallido
            $message->update([
                'status' => 'failed',
                'error_message' => 'WhatsApp API not configured. Please configure it in Settings.',
            ]);
        }

        // Emitir evento de broadcasting para actualización en tiempo real
        broadcast(new MessageSent($message->fresh(['sender']), $conversation->fresh(['lastMessage', 'assignedUser'])))->toOthers();

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

    /**
     * Ocultar conversación (no elimina de BD)
     */
    public function hide(Conversation $conversation)
    {
        // Marcar como cerrada y oculta para que no aparezca en las consultas
        $conversation->update([
            'status' => 'closed',
            'notes' => ($conversation->notes ? $conversation->notes . "\n\n" : '') . 
                      'Chat ocultado por ' . auth()->user()->name . ' el ' . now()->format('Y-m-d H:i:s')
        ]);

        return redirect()->route('admin.chat.index')->with('success', 'Conversación eliminada exitosamente.');
    }
}
