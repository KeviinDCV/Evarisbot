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
     * Obtener el contador de conversaciones con mensajes no leídos
     */
    public function getUnreadCount()
    {
        if (auth()->user()->isAdvisor()) {
            // Si es asesor, solo contar las asignadas a él
            $count = Conversation::where('assigned_to', auth()->id())
                ->where('unread_count', '>', 0)
                ->count();
        } else {
            // Si es admin, contar todas las conversaciones con mensajes no leídos
            $count = Conversation::where('unread_count', '>', 0)
                ->count();
        }

        return response()->json([
            'count' => $count
        ]);
    }

    /**
     * Mostrar la lista de conversaciones
     */
    public function index(Request $request)
    {
        $query = Conversation::with(['lastMessage', 'assignedUser'])
            ->orderBy('last_message_at', 'desc');

        // Si es asesor, solo ver conversaciones activas asignadas a él
        if (auth()->user()->isAdvisor()) {
            $query->where('assigned_to', auth()->id())
                  ->where('status', 'active'); // Asesores solo ven conversaciones activas
        }

        // Filtrar por estado si se proporciona (solo admin)
        if (auth()->user()->isAdmin() && $request->has('status') && $request->status !== 'all') {
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

        // Buscar por nombre, teléfono o contenido de mensajes
        if ($request->has('search') && !empty($request->search)) {
            $search = trim($request->search);
            $query->where(function ($q) use ($search) {
                // Buscar en nombre de contacto
                $q->where('contact_name', 'like', "%{$search}%")
                  // Buscar en número de teléfono
                  ->orWhere('phone_number', 'like', "%{$search}%")
                  // Buscar en el contenido de los mensajes
                  ->orWhereHas('messages', function ($messageQuery) use ($search) {
                      $messageQuery->where('content', 'like', "%{$search}%");
                  });
            });
        }

        // Paginación: cargar solo 50 conversaciones a la vez para mejor rendimiento
        $perPage = 50;
        $page = $request->get('page', 1);
        
        $conversations = $query
            ->select(['id', 'phone_number', 'contact_name', 'status', 'unread_count', 'assigned_to', 'last_message_at'])
            ->limit($perPage)
            ->offset(($page - 1) * $perPage)
            ->get();
        
        // Contar total solo si es la primera página (para evitar queries innecesarias)
        $hasMore = $conversations->count() === $perPage;

        // Obtener todos los usuarios (asesores) disponibles para asignación
        $users = User::select('id', 'name', 'role')->get();

        // Si es una petición de paginación (AJAX), devolver solo las conversaciones
        if ($request->wantsJson() || $request->has('page')) {
            return response()->json([
                'conversations' => $conversations,
                'hasMore' => $hasMore,
                'page' => (int) $page,
            ]);
        }

        return Inertia::render('conversations/index', [
            'conversations' => $conversations,
            'hasMore' => $hasMore,
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
            ->orderBy('last_message_at', 'desc');

        // Si es asesor, solo ver conversaciones activas asignadas a él
        if (auth()->user()->isAdvisor()) {
            $query->where('assigned_to', auth()->id())
                  ->where('status', 'active'); // Asesores solo ven conversaciones activas
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

        // Buscar por nombre, teléfono o contenido de mensajes
        if ($request->has('search') && !empty($request->search)) {
            $search = trim($request->search);
            $query->where(function ($q) use ($search) {
                $q->where('contact_name', 'like', "%{$search}%")
                  ->orWhere('phone_number', 'like', "%{$search}%")
                  ->orWhereHas('messages', function ($messageQuery) use ($search) {
                      $messageQuery->where('content', 'like', "%{$search}%");
                  });
            });
        }

        // Paginación: cargar solo 50 conversaciones
        $perPage = 50;
        $conversations = $query
            ->select(['id', 'phone_number', 'contact_name', 'status', 'unread_count', 'assigned_to', 'last_message_at'])
            ->limit($perPage)
            ->get();
        
        $hasMore = $conversations->count() === $perPage;
        
        // Cargar la conversación seleccionada con todos sus mensajes
        $conversation->load(['messages.sender', 'assignedUser']);
        
        // Marcar mensajes como leídos
        $conversation->markAsRead();

        // Obtener todos los usuarios (asesores) disponibles para asignación
        $users = User::select('id', 'name', 'role')->get();

        return Inertia::render('conversations/index', [
            'conversations' => $conversations,
            'hasMore' => $hasMore,
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
        // Aumentar límites de PHP para uploads grandes
        @ini_set('upload_max_filesize', '20M');
        @ini_set('post_max_size', '25M');
        @ini_set('max_execution_time', '300');
        
        $validated = $request->validate([
            'content' => 'nullable|string',
            'message_type' => 'string|in:text,image,document,video,audio',
            'media_file' => 'nullable|file|mimes:jpg,jpeg,png,gif,webp,pdf,doc,docx,mp4,mov,avi,mkv,3gp,mp3,ogg,aac,amr,opus|max:20480', // max 20MB
        ]);

        // Si hay archivo, subirlo
        $mediaUrl = null;
        $mediaFilename = null;
        $messageType = $validated['message_type'] ?? 'text';
        
        if ($request->hasFile('media_file')) {
            $file = $request->file('media_file');
            $path = $file->store('whatsapp_media', 'public');
            // Usar ruta relativa para compatibilidad local/ngrok
            $mediaUrl = '/storage/' . $path;
            $mediaFilename = $file->getClientOriginalName();
            
            // Determinar tipo de mensaje basado en la extensión
            $extension = strtolower($file->getClientOriginalExtension());
            if (in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp'])) {
                $messageType = 'image';
            } elseif (in_array($extension, ['mp4', 'mov', 'avi', 'mkv', '3gp'])) {
                $messageType = 'video';
            } elseif (in_array($extension, ['mp3', 'ogg', 'aac', 'amr', 'opus'])) {
                $messageType = 'audio';
            } else {
                $messageType = 'document';
            }
            
            \Log::info('File uploaded for WhatsApp', [
                'filename' => $mediaFilename,
                'type' => $messageType,
                'url' => $mediaUrl,
                'size' => $file->getSize(),
                'mime' => $file->getMimeType(),
            ]);
        }

        // Crear el mensaje en la base de datos
        $message = $conversation->messages()->create([
            'content' => $validated['content'] ?? ($mediaFilename ?? 'Media file'),
            'message_type' => $messageType,
            'media_url' => $mediaUrl,
            'media_filename' => $mediaFilename,
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
            $result = null;
            
            // Convertir URL relativa a absoluta usando APP_URL (funciona con ngrok)
            $absoluteMediaUrl = $mediaUrl ? config('app.url') . $mediaUrl : null;
            
            if ($absoluteMediaUrl) {
                \Log::info('Sending media to WhatsApp', [
                    'type' => $messageType,
                    'absolute_url' => $absoluteMediaUrl,
                    'app_url' => config('app.url'),
                ]);
            }
            
            if ($messageType === 'image' && $absoluteMediaUrl) {
                $result = $whatsappService->sendImageMessage(
                    $conversation->phone_number,
                    $absoluteMediaUrl,
                    $validated['content']
                );
            } elseif ($messageType === 'video' && $absoluteMediaUrl) {
                $result = $whatsappService->sendVideoMessage(
                    $conversation->phone_number,
                    $absoluteMediaUrl,
                    $validated['content'] ?? null
                );
            } elseif ($messageType === 'audio' && $absoluteMediaUrl) {
                $result = $whatsappService->sendAudioMessage(
                    $conversation->phone_number,
                    $absoluteMediaUrl
                );
            } elseif ($messageType === 'document' && $absoluteMediaUrl) {
                $result = $whatsappService->sendDocumentMessage(
                    $conversation->phone_number,
                    $absoluteMediaUrl,
                    $mediaFilename,
                    $validated['content'] ?? null
                );
            } else {
                $result = $whatsappService->sendTextMessage(
                    $conversation->phone_number,
                    $validated['content']
                );
            }

            if ($result && $result['success']) {
                $message->update([
                    'status' => 'sent',
                    'whatsapp_message_id' => $result['message_id'] ?? null,
                ]);
            } else {
                $message->update([
                    'status' => 'failed',
                    'error_message' => $result['error'] ?? 'Unknown error',
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
            'status' => 'active',
        ]);

        return back()->with('success', 'Conversación asignada exitosamente.');
    }

    /**
     * Cambiar estado de la conversación
     */
    public function updateStatus(Request $request, Conversation $conversation)
    {
        $validated = $request->validate([
            'status' => 'required|in:active,resolved',
        ]);

        $conversation->update(['status' => $validated['status']]);

        // Si es asesor y marca como resuelta, redirigir al índice (la conversación desaparecerá de su lista)
        if (auth()->user()->isAdvisor() && $validated['status'] === 'resolved') {
            return redirect()->route('admin.chat.index')->with('success', 'Conversación marcada como resuelta.');
        }

        return back()->with('success', 'Estado actualizado.');
    }

    /**
     * Ocultar conversación (marcar como resuelta)
     */
    public function hide(Conversation $conversation)
    {
        // Marcar como resuelta
        $conversation->update([
            'status' => 'resolved',
            'notes' => ($conversation->notes ? $conversation->notes . "\n\n" : '') . 
                      'Chat marcado como resuelto por ' . auth()->user()->name . ' el ' . now()->format('Y-m-d H:i:s')
        ]);

        return redirect()->route('admin.chat.index')->with('success', 'Conversación marcada como resuelta.');
    }

    /**
     * Crear una nueva conversación (iniciar chat con un número)
     * 
     * IMPORTANTE: Según las políticas de Meta/WhatsApp Business API:
     * - Solo puedes iniciar conversaciones usando plantillas aprobadas
     * - O si el usuario te ha escrito en las últimas 24 horas
     * - Esta función crea la conversación y permite enviar el primer mensaje
     */
    public function store(Request $request, WhatsAppService $whatsappService)
    {
        $validated = $request->validate([
            'phone_number' => 'required|string|min:10|max:20',
            'contact_name' => 'nullable|string|max:255',
            'message' => 'required|string|max:4096',
        ]);

        // Formatear número de teléfono (eliminar caracteres no numéricos excepto +)
        $phoneNumber = preg_replace('/[^0-9+]/', '', $validated['phone_number']);
        
        // Asegurar que tenga el formato correcto (con código de país y +)
        if (!str_starts_with($phoneNumber, '+')) {
            // Si no tiene +, asumir que es Colombia (+57)
            if (strlen($phoneNumber) === 10) {
                $phoneNumber = '+57' . $phoneNumber;
            } else {
                $phoneNumber = '+' . $phoneNumber;
            }
        }

        // Buscar si ya existe una conversación con este número
        $conversation = Conversation::where('phone_number', $phoneNumber)->first();

        if ($conversation) {
            // Si existe pero está resuelta, reactivarla
            if ($conversation->status === 'resolved') {
                $conversation->update([
                    'status' => 'active',
                    'last_message_at' => now(),
                ]);
            }
        } else {
            // Crear nueva conversación
            $conversation = Conversation::create([
                'phone_number' => $phoneNumber,
                'contact_name' => $validated['contact_name'] ?? null,
                'status' => 'active',
                'assigned_to' => auth()->id(),
                'last_message_at' => now(),
                'unread_count' => 0,
            ]);
        }

        // Crear el mensaje en la base de datos
        $message = $conversation->messages()->create([
            'content' => $validated['message'],
            'message_type' => 'text',
            'is_from_user' => false,
            'sent_by' => auth()->id(),
            'status' => 'pending',
        ]);

        // Enviar mensaje usando WhatsApp Business API
        if ($whatsappService->isConfigured()) {
            $result = $whatsappService->sendTextMessage(
                $phoneNumber,
                $validated['message']
            );

            if ($result && $result['success']) {
                $message->update([
                    'status' => 'sent',
                    'whatsapp_message_id' => $result['message_id'] ?? null,
                ]);
            } else {
                $message->update([
                    'status' => 'failed',
                    'error_message' => $result['error'] ?? 'Error desconocido al enviar mensaje',
                ]);
                
                return back()->withErrors([
                    'message' => 'No se pudo enviar el mensaje: ' . ($result['error'] ?? 'Error desconocido')
                ]);
            }
        } else {
            $message->update([
                'status' => 'failed',
                'error_message' => 'WhatsApp API no está configurada',
            ]);
            
            return back()->withErrors([
                'message' => 'WhatsApp API no está configurada. Por favor, configúrala en Ajustes.'
            ]);
        }

        // Redirigir a la conversación creada
        return redirect()->route('admin.chat.show', $conversation->id)
            ->with('success', 'Conversación iniciada exitosamente.');
    }
}
