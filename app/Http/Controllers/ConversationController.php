<?php

namespace App\Http\Controllers;

use App\Events\MessageSent;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Template;
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
        $user = auth()->user();
        
        if ($user->isAdvisor()) {
            if ($user->isOnDuty()) {
                // Asesor de turno: cuenta chats sin asignar + asignados a él
                $count = Conversation::where(function ($q) {
                    $q->whereNull('assigned_to')
                      ->orWhere('assigned_to', auth()->id());
                })
                    ->whereIn('status', ['active', 'pending'])
                    ->where('unread_count', '>', 0)
                    ->count();
            } else {
                // Asesor normal: solo contar las asignadas a él
                $count = Conversation::where('assigned_to', auth()->id())
                    ->where('unread_count', '>', 0)
                    ->count();
            }
        } else {
            // Si es admin, contar todas las conversaciones con mensajes no leídos (excluir resueltas)
            $count = Conversation::whereIn('status', ['active', 'pending'])
                ->where('unread_count', '>', 0)
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
        $query = Conversation::with(['lastMessage', 'assignedUser', 'resolvedByUser', 'tags'])
            ->orderBy('last_message_at', 'desc');

        $user = auth()->user();

        // Si es asesor, verificar si está de turno
        if ($user->isAdvisor()) {
            if ($user->isOnDuty()) {
                // Asesor de turno: ve chats SIN asignar + chats asignados a él
                // Incluye resueltas para que no desaparezcan al marcarlas
                $query->where(function ($q) {
                    $q->whereNull('assigned_to')  // Sin asignar (pool compartido)
                      ->orWhere('assigned_to', auth()->id());  // O asignados a él
                });
            } else {
                // Asesor normal: solo ve las asignadas a él
                $query->where('assigned_to', auth()->id());
            }
        }

        // Filtrar por estado (disponible para todos los usuarios)
        $filteringByTag = $request->has('tag') && is_numeric($request->tag);

        if ($request->has('status') && $request->status !== 'all') {
            if ($request->status === 'unanswered') {
                // Filtrar conversaciones sin leer (con mensajes pendientes por revisar)
                $query->where('unread_count', '>', 0);
            } else {
                $query->where('status', $request->status);
            }
        } elseif ($user->isAdvisor() && !$filteringByTag) {
            // Sin filtro de estado explícito y sin etiqueta: mostrar active+pending (NO resolved)
            // Si hay filtro de etiqueta, mostrar todos los estados para que las resueltas aparezcan
            $query->whereIn('status', ['active', 'pending']);
        }

        // Filtrar por asignación (solo para admin)
        if ($user->isAdmin()) {
            if ($request->has('assigned')) {
                if ($request->assigned === 'me') {
                    $query->where('assigned_to', auth()->id());
                } elseif ($request->assigned === 'unassigned') {
                    $query->whereNull('assigned_to');
                } elseif (is_numeric($request->assigned)) {
                    // Filtrar por ID de asesor específico
                    $query->where('assigned_to', (int) $request->assigned);
                }
            }
        }

        // Filtrar por etiqueta
        if ($request->has('tag') && is_numeric($request->tag)) {
            $query->whereHas('tags', fn ($q) => $q->where('tags.id', (int) $request->tag));
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
        // Usamos paginación basada en cursor (last_message_at) para evitar duplicados
        // cuando las conversaciones cambian de posición entre páginas
        $perPage = 50;
        $page = $request->get('page', 1);
        $cursor = $request->get('cursor'); // timestamp ISO del último elemento cargado
        
        if ($cursor) {
            // Paginación por cursor: obtener conversaciones más antiguas que el cursor
            $query->where(function ($q) use ($cursor) {
                $q->where('last_message_at', '<', $cursor)
                  ->orWhereNull('last_message_at');
            });
        }

        $conversations = $query
            ->select(['id', 'phone_number', 'contact_name', 'status', 'unread_count', 'assigned_to', 'resolved_by', 'resolved_at', 'last_message_at'])
            ->limit($perPage)
            ->get();
        
        // Contar total solo si es la primera página (para evitar queries innecesarias)
        $hasMore = $conversations->count() === $perPage;
        
        // Calcular el cursor para la siguiente página
        $nextCursor = null;
        if ($hasMore && $conversations->isNotEmpty()) {
            $lastConv = $conversations->last();
            $nextCursor = $lastConv->last_message_at?->toISOString();
        }

        // Inyectar is_pinned / pinned_at por usuario
        $convIds = $conversations->pluck('id');
        $userPins = \DB::table('conversation_user_pins')
            ->where('user_id', auth()->id())
            ->whereIn('conversation_id', $convIds)
            ->pluck('pinned_at', 'conversation_id');

        $conversations = $conversations->map(function ($conv) use ($userPins) {
            $conv->is_pinned = $userPins->has($conv->id);
            $conv->pinned_at = $userPins->get($conv->id);
            return $conv;
        })->sortByDesc(function ($conv) {
            // Pinned first, then by last_message_at
            return [$conv->is_pinned ? 1 : 0, $conv->last_message_at?->timestamp ?? 0];
        })->values();

        // Obtener todos los usuarios (asesores) disponibles para asignación
        $users = User::select('id', 'name', 'role')->get();

        // Obtener todas las etiquetas disponibles
        $allTags = \App\Models\Tag::withCount('conversations')->orderBy('name')->get();

        // Si es una petición de paginación (AJAX), devolver solo las conversaciones
        if ($request->wantsJson() || $request->has('page') || $request->has('cursor')) {
            return response()->json([
                'conversations' => $conversations,
                'hasMore' => $hasMore,
                'page' => (int) $page,
                'nextCursor' => $nextCursor,
            ]);
        }

        return Inertia::render('conversations/index', [
            'conversations' => $conversations,
            'hasMore' => $hasMore,
            'users' => $users,
            'allTags' => $allTags,
            'filters' => $request->only(['status', 'assigned', 'search', 'tag']),
        ]);
    }

    /**
     * Mostrar una conversación específica con sus mensajes
     */
    public function show(Request $request, Conversation $conversation)
    {
        $user = auth()->user();
        
        // Validar acceso: asesores solo pueden ver conversaciones asignadas a ellos
        // EXCEPTO si están de turno (pueden ver sin asignar + las suyas)
        if ($user->isAdvisor()) {
            if ($user->isOnDuty()) {
                // Asesor de turno puede ver: sin asignar O asignadas a él
                $canAccess = is_null($conversation->assigned_to) || $conversation->assigned_to === auth()->id();
                if (!$canAccess) {
                    abort(403, 'No tienes permiso para ver esta conversación.');
                }
            } else {
                // Asesor normal solo ve las asignadas a él
                if ($conversation->assigned_to !== auth()->id()) {
                    abort(403, 'No tienes permiso para ver esta conversación.');
                }
            }
        }

        $query = Conversation::with(['lastMessage', 'assignedUser', 'resolvedByUser', 'tags'])
            ->orderBy('last_message_at', 'desc');

        // Si es asesor, verificar si está de turno
        if ($user->isAdvisor()) {
            if ($user->isOnDuty()) {
                // Asesor de turno: ve chats SIN asignar + chats asignados a él
                $query->where(function ($q) {
                    $q->whereNull('assigned_to')
                      ->orWhere('assigned_to', auth()->id());
                });
            } else {
                // Asesor normal: solo ve las asignadas a él
                $query->where('assigned_to', auth()->id());
            }
        }

        // Filtrar por estado (disponible para todos los usuarios)
        $filteringByTag = $request->has('tag') && is_numeric($request->tag);

        if ($request->has('status') && $request->status !== 'all') {
            if ($request->status === 'unanswered') {
                $query->where('unread_count', '>', 0);
            } else {
                $query->where('status', $request->status);
            }
        } elseif ($user->isAdvisor() && !$filteringByTag) {
            // Sin filtro de estado explícito y sin etiqueta: mostrar active+pending (NO resolved)
            // Si hay filtro de etiqueta, mostrar todos los estados para que las resueltas aparezcan
            $query->whereIn('status', ['active', 'pending']);
        }

        // Aplicar filtros adicionales si existen (solo admin)
        if ($user->isAdmin()) {

            if ($request->has('assigned')) {
                if ($request->assigned === 'me') {
                    $query->where('assigned_to', auth()->id());
                } elseif ($request->assigned === 'unassigned') {
                    $query->whereNull('assigned_to');
                } elseif (is_numeric($request->assigned)) {
                    $query->where('assigned_to', (int) $request->assigned);
                }
            }
        }

        // Filtrar por etiqueta
        if ($request->has('tag') && is_numeric($request->tag)) {
            $query->whereHas('tags', fn ($q) => $q->where('tags.id', (int) $request->tag));
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
            ->select(['id', 'phone_number', 'contact_name', 'status', 'unread_count', 'assigned_to', 'resolved_by', 'resolved_at', 'last_message_at'])
            ->limit($perPage)
            ->get();
        
        $hasMore = $conversations->count() === $perPage;

        // Inyectar is_pinned / pinned_at por usuario
        $convIds = $conversations->pluck('id');
        $userPins = \DB::table('conversation_user_pins')
            ->where('user_id', auth()->id())
            ->whereIn('conversation_id', $convIds)
            ->pluck('pinned_at', 'conversation_id');

        $conversations = $conversations->map(function ($conv) use ($userPins) {
            $conv->is_pinned = $userPins->has($conv->id);
            $conv->pinned_at = $userPins->get($conv->id);
            return $conv;
        })->sortByDesc(function ($conv) {
            return [$conv->is_pinned ? 1 : 0, $conv->last_message_at?->timestamp ?? 0];
        })->values();
        
        // Cargar la conversación seleccionada con todos sus mensajes
        $conversation->load(['messages.sender', 'assignedUser', 'resolvedByUser', 'tags']);
        
        // Marcar mensajes como leídos
        $conversation->markAsRead();

        // Obtener todos los usuarios (asesores) disponibles para asignación
        $users = User::select('id', 'name', 'role')->get();

        // Obtener todas las etiquetas disponibles
        $allTags = \App\Models\Tag::withCount('conversations')->orderBy('name')->get();

        // Obtener plantillas activas (globales o asignadas al usuario actual)
        $templates = Template::active()
            ->availableForUser(auth()->id())
            ->select(['id', 'name', 'content', 'message_type', 'media_url', 'media_filename', 'media_files'])
            ->get()
            ->map(function ($template) {
                return [
                    'id' => $template->id,
                    'name' => $template->name,
                    'content' => $template->content,
                    'message_type' => $template->message_type,
                    'media_url' => $template->media_url,
                    'media_filename' => $template->media_filename,
                    'media_files' => $template->getMediaFilesArray(),
                ];
            });

        return Inertia::render('conversations/index', [
            'conversations' => $conversations,
            'hasMore' => $hasMore,
            'selectedConversation' => $conversation,
            'users' => $users,
            'allTags' => $allTags,
            'filters' => $request->only(['status', 'assigned', 'search', 'tag']),
            'templates' => $templates,
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
            'template_media_url' => 'nullable|string', // URL de imagen de plantilla (legacy)
            'template_media_files' => 'nullable|string', // JSON array de archivos de plantilla
            'template_id' => 'nullable|integer|exists:templates,id', // ID de plantilla usada
        ]);

        // Si se usó una plantilla, incrementar su contador de uso
        if (!empty($validated['template_id'])) {
            $template = Template::find($validated['template_id']);
            if ($template) {
                $template->incrementUsage();
            }
        }

        // Detectar comando /saludo para enviar plantilla de saludo
        $content = trim($validated['content'] ?? '');
        if (strtolower($content) === '/saludo') {
            return $this->sendGreetingCommand($conversation, $whatsappService);
        }

        // Verificar si hay múltiples archivos de plantilla
        $templateMediaFiles = [];
        if (!empty($validated['template_media_files'])) {
            $templateMediaFiles = json_decode($validated['template_media_files'], true) ?? [];
        }

        // Si hay múltiples archivos de plantilla, enviarlos todos
        if (count($templateMediaFiles) > 0) {
            return $this->sendMultipleTemplateMedia(
                $conversation, 
                $whatsappService, 
                $templateMediaFiles, 
                $validated['content'] ?? ''
            );
        }

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
        } elseif (!empty($validated['template_media_url'])) {
            // Si viene una URL de imagen de plantilla (legacy), usarla
            $templateMediaUrl = $validated['template_media_url'];
            $mediaUrl = $templateMediaUrl;
            $mediaFilename = basename($templateMediaUrl);
            
            // Determinar tipo basado en extensión de la URL
            $extension = strtolower(pathinfo($templateMediaUrl, PATHINFO_EXTENSION));
            if (in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp'])) {
                $messageType = 'image';
            } elseif (in_array($extension, ['mp4', 'mov', 'avi', 'mkv', '3gp'])) {
                $messageType = 'video';
            } elseif (in_array($extension, ['pdf', 'doc', 'docx'])) {
                $messageType = 'document';
            } else {
                $messageType = 'image'; // Por defecto para plantillas
            }
            
            \Log::info('Template media URL received', [
                'url' => $templateMediaUrl,
                'type' => $messageType,
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

        // Auto-asignar al asesor que responde si el chat no tiene asignación
        // Esto implementa el "pool compartido" donde el primero en responder toma el chat
        $updateData = ['last_message_at' => now()];
        $wasUnassigned = is_null($conversation->assigned_to);
        if ($wasUnassigned) {
            $updateData['assigned_to'] = auth()->id();
            $updateData['status'] = 'active';
        }
        $conversation->update($updateData);

        // Si el chat acaba de ser tomado, notificar a todos los demás asesores
        // para que lo eliminen de su bandeja inmediatamente (sin esperar polling)
        if ($wasUnassigned) {
            broadcast(new \App\Events\ConversationAssigned($conversation->fresh()))->toOthers();
        }

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

        // Si es petición AJAX/JSON, devolver JSON
        if ($request->expectsJson() || $request->ajax()) {
            return response()->json([
                'success' => true,
                'message' => $message->fresh(['sender']),
            ]);
        }

        return back();
    }

    /**
     * Enviar múltiples archivos de plantilla a una conversación
     */
    private function sendMultipleTemplateMedia(
        Conversation $conversation, 
        WhatsAppService $whatsappService, 
        array $mediaFiles, 
        string $content
    ) {
        \Log::info('sendMultipleTemplateMedia called', [
            'conversation_id' => $conversation->id,
            'phone' => $conversation->phone_number,
            'media_files_count' => count($mediaFiles),
            'content' => $content,
            'media_files' => $mediaFiles,
        ]);

        $messages = [];
        $allSuccess = true;

        foreach ($mediaFiles as $index => $mediaFile) {
            $mediaUrl = $mediaFile['url'] ?? null;
            $mediaFilename = $mediaFile['filename'] ?? 'archivo';
            $mediaType = $mediaFile['type'] ?? 'document';
            
            // El caption solo va en el primer archivo si hay texto
            $caption = ($index === 0 && !empty($content)) ? $content : null;
            
            // IMPORTANTE: Convertir WebP a PNG al vuelo si es necesario
            // WhatsApp Cloud API NO soporta WebP, solo PNG y JPEG
            if ($mediaType === 'image' && $mediaUrl) {
                $extension = strtolower(pathinfo($mediaUrl, PATHINFO_EXTENSION));
                if ($extension === 'webp') {
                    \Log::info('Detected WebP image, converting to PNG', [
                        'index' => $index,
                        'original_url' => $mediaUrl,
                    ]);
                    
                    $convertedUrl = $this->convertWebpToPng($mediaUrl);
                    if ($convertedUrl) {
                        $mediaUrl = $convertedUrl;
                        $mediaFilename = pathinfo($convertedUrl, PATHINFO_BASENAME);
                        \Log::info('WebP converted to PNG successfully', [
                            'index' => $index,
                            'new_url' => $mediaUrl,
                        ]);
                    } else {
                        \Log::error('Failed to convert WebP to PNG', [
                            'index' => $index,
                            'original_url' => $mediaFile['url'],
                        ]);
                    }
                }
            }
            
            \Log::info('Processing media file', [
                'index' => $index,
                'url' => $mediaUrl,
                'filename' => $mediaFilename,
                'type' => $mediaType,
                'caption' => $caption,
            ]);
            
            // Crear el mensaje en la base de datos
            $message = $conversation->messages()->create([
                'content' => $caption ?? '',
                'message_type' => $mediaType,
                'media_url' => $mediaUrl,
                'media_filename' => $mediaFilename,
                'is_from_user' => false,
                'sent_by' => auth()->id(),
                'status' => 'pending',
            ]);

            // Enviar mensaje usando WhatsApp Business API
            if ($whatsappService->isConfigured()) {
                $absoluteMediaUrl = config('app.url') . $mediaUrl;
                $result = null;

                \Log::info('Sending template media to WhatsApp', [
                    'index' => $index,
                    'type' => $mediaType,
                    'absolute_url' => $absoluteMediaUrl,
                ]);

                $result = match ($mediaType) {
                    'image' => $whatsappService->sendImageMessage(
                        $conversation->phone_number,
                        $absoluteMediaUrl,
                        $caption
                    ),
                    'video' => $whatsappService->sendVideoMessage(
                        $conversation->phone_number,
                        $absoluteMediaUrl,
                        $caption
                    ),
                    'document' => $whatsappService->sendDocumentMessage(
                        $conversation->phone_number,
                        $absoluteMediaUrl,
                        $mediaFilename,
                        $caption
                    ),
                    default => $whatsappService->sendDocumentMessage(
                        $conversation->phone_number,
                        $absoluteMediaUrl,
                        $mediaFilename,
                        $caption
                    ),
                };

                \Log::info('WhatsApp API response for template media', [
                    'index' => $index,
                    'result' => $result,
                ]);

                if ($result && $result['success']) {
                    $message->update([
                        'status' => 'sent',
                        'whatsapp_message_id' => $result['message_id'] ?? null,
                    ]);
                } else {
                    $allSuccess = false;
                    $errorMsg = $result['error'] ?? 'Unknown error';
                    \Log::error('Failed to send template media', [
                        'index' => $index,
                        'error' => $errorMsg,
                        'result' => $result,
                    ]);
                    $message->update([
                        'status' => 'failed',
                        'error_message' => $errorMsg,
                    ]);
                }
            } else {
                $allSuccess = false;
                $message->update([
                    'status' => 'failed',
                    'error_message' => 'WhatsApp API not configured.',
                ]);
            }

            $messages[] = $message;

            // Pequeño delay entre archivos para evitar rate limiting
            if ($index < count($mediaFiles) - 1) {
                usleep(300000); // 0.3 segundos
            }
        }

        // Actualizar conversación
        $conversation->update(['last_message_at' => now()]);
        if (is_null($conversation->assigned_to)) {
            $conversation->update([
                'assigned_to' => auth()->id(),
                'status' => 'active',
            ]);
        }

        // Emitir evento de broadcasting para el último mensaje
        if (!empty($messages)) {
            $lastMessage = end($messages);
            broadcast(new MessageSent($lastMessage->fresh(['sender']), $conversation->fresh(['lastMessage', 'assignedUser'])))->toOthers();
        }

        return response()->json([
            'success' => $allSuccess,
            'messages' => collect($messages)->map(fn($m) => $m->fresh(['sender'])),
            'total_sent' => count($messages),
        ]);
    }

    /**
     * Asignación masiva de conversaciones
     */
    public function bulkAssign(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'exists:conversations,id',
            'user_id' => 'nullable|exists:users,id',
        ]);

        $userId = $validated['user_id'];
        $updateData = ['assigned_to' => $userId];
        
        // Si se asigna a un usuario, reactivar la conversación
        if ($userId) {
            $updateData['status'] = 'active';
        }

        Conversation::whereIn('id', $validated['ids'])->update($updateData);

        return back()->with('success', count($validated['ids']) . ' conversaciones actualizadas.');
    }

    /**
     * Actualización masiva de estado
     */
    public function bulkUpdateStatus(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'exists:conversations,id',
            'status' => 'required|in:active,pending,resolved',
        ]);

        $status = $validated['status'];
        $updateData = ['status' => $status];

        if ($status === 'resolved') {
            $updateData['resolved_by'] = auth()->id();
            $updateData['resolved_at'] = now();
            $updateData['unread_count'] = 0;
        } else {
            $updateData['resolved_by'] = null;
            $updateData['resolved_at'] = null;
        }

        Conversation::whereIn('id', $validated['ids'])->update($updateData);

        // Si se resuelven, marcar todos los mensajes de usuario como leídos
        if ($status === 'resolved') {
            Message::whereIn('conversation_id', $validated['ids'])
                ->where('is_from_user', true)
                ->where('status', '!=', 'read')
                ->update(['status' => 'read']);
        }

        return back()->with('success', count($validated['ids']) . ' conversaciones actualizadas.');
    }

    /**
     * Asignar conversación a un asesor
     */
    public function assign(Request $request, Conversation $conversation)
    {
        $validated = $request->validate([
            'user_id' => 'nullable|exists:users,id',
        ]);

        // Si user_id está presente en la petición (incluso si es null), usarlo
        // Si no está presente, usar el usuario actual
        $userId = $request->has('user_id') ? $validated['user_id'] : auth()->id();
        
        $conversation->update([
            'assigned_to' => $userId,
            'status' => $userId ? 'active' : $conversation->status,
        ]);

        // Notificar a todos los demás en tiempo real sobre el cambio de asignación
        if ($userId) {
            broadcast(new \App\Events\ConversationAssigned($conversation->fresh()))->toOthers();
        }

        $message = $userId ? 'Conversación asignada exitosamente.' : 'Asignación removida exitosamente.';
        return back()->with('success', $message);
    }

    /**
     * Cambiar estado de la conversación
     */
    public function updateStatus(Request $request, Conversation $conversation)
    {
        $validated = $request->validate([
            'status' => 'required|in:active,pending,resolved',
        ]);

        $updateData = [
            'status' => $validated['status'],
        ];

        if ($validated['status'] === 'resolved') {
            // Guardar quién resolvió y cuándo
            $updateData['resolved_by'] = auth()->id();
            $updateData['resolved_at'] = now();
        } else {
            // Si se reabre, limpiar info de resolución
            $updateData['resolved_by'] = null;
            $updateData['resolved_at'] = null;
        }

        $conversation->update($updateData);

        // Si se resuelve, marcar todos los mensajes como leídos
        if ($validated['status'] === 'resolved') {
            $conversation->markAsRead();
        }

        $resolverName = auth()->user()->name;

        if ($validated['status'] === 'resolved') {
            // Al resolver, redirigir al listado para que el chat desaparezca de la vista del asesor
            return redirect()->route('admin.chat.index')
                ->with('success', "Conversación resuelta por {$resolverName}.");
        }

        return back()->with('success', 'Estado actualizado.');
    }

    /**
     * Ocultar conversación (marcar como resuelta)
     */
    public function hide(Conversation $conversation)
    {
        // Marcar como resuelta y marcar mensajes como leídos
        $conversation->update([
            'status' => 'resolved',
            'resolved_by' => auth()->id(),
            'resolved_at' => now(),
            'notes' => ($conversation->notes ? $conversation->notes . "\n\n" : '') . 
                      'Chat marcado como resuelto por ' . auth()->user()->name . ' el ' . now()->format('Y-m-d H:i:s')
        ]);

        // Marcar todos los mensajes como leídos para que el badge baje
        $conversation->markAsRead();

        return redirect()->route('admin.chat.index')->with('success', 'Conversación marcada como resuelta.');
    }

    /**
     * Fijar o desfijar una conversación (por usuario)
     */
    public function togglePin(Conversation $conversation)
    {
        $userId = auth()->id();

        $exists = \DB::table('conversation_user_pins')
            ->where('user_id', $userId)
            ->where('conversation_id', $conversation->id)
            ->exists();

        if ($exists) {
            \DB::table('conversation_user_pins')
                ->where('user_id', $userId)
                ->where('conversation_id', $conversation->id)
                ->delete();
            $isPinned = false;
        } else {
            \DB::table('conversation_user_pins')->insert([
                'user_id'         => $userId,
                'conversation_id' => $conversation->id,
                'pinned_at'       => now(),
            ]);
            $isPinned = true;
        }

        return response()->json([
            'success'  => true,
            'is_pinned' => $isPinned,
        ]);
    }

    /**
     * Enviar plantilla de saludo usando el comando /saludo
     */
    protected function sendGreetingCommand(Conversation $conversation, WhatsAppService $whatsappService)
    {
        $user = auth()->user();
        // Usar solo el primer nombre del asesor
        $advisorName = explode(' ', trim($user->name))[0];
        
        // Generar el texto del mensaje para guardar en BD
        $greetingText = "Buen día.\n" .
            "Le saludamos de Hospital Universitario del Valle.\n" .
            "A partir de este momento será atendido(a) por {$advisorName}, quien estará a cargo de la asignación y seguimiento de su cita.\n" .
            "Quedamos atentos a cualquier consulta adicional.";
        
        // Crear el mensaje en la base de datos
        $message = $conversation->messages()->create([
            'content' => $greetingText,
            'message_type' => 'text',
            'is_from_user' => false,
            'sent_by' => $user->id,
            'status' => 'pending',
        ]);

        // Auto-asignar al asesor si no está asignado
        $updateData = ['last_message_at' => now()];
        if (is_null($conversation->assigned_to)) {
            $updateData['assigned_to'] = $user->id;
            $updateData['status'] = 'active';
        }
        $conversation->update($updateData);

        // Enviar usando la plantilla de WhatsApp
        if ($whatsappService->isConfigured()) {
            $result = $whatsappService->sendGreetingTemplate(
                $conversation->phone_number,
                $advisorName
            );

            if ($result && $result['success']) {
                $message->update([
                    'status' => 'sent',
                    'whatsapp_message_id' => $result['message_id'] ?? null,
                ]);
            } else {
                $message->update([
                    'status' => 'failed',
                    'error_message' => $result['error'] ?? 'Error desconocido',
                ]);
            }
        } else {
            $message->update([
                'status' => 'failed',
                'error_message' => 'WhatsApp API no configurada',
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => $message->fresh()->load('sender'),
        ]);
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
            'assigned_to' => 'nullable|exists:users,id',
            'message' => 'required|string|max:4096',
        ]);

        // Obtener el asesor seleccionado o usar el usuario actual (admin)
        $assignedUser = $validated['assigned_to'] 
            ? \App\Models\User::find($validated['assigned_to']) 
            : auth()->user();

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
            // Si existe, actualizar asignación y reactivar si está resuelta
            $conversation->update([
                'status' => 'active',
                'assigned_to' => $assignedUser->id,
                'last_message_at' => now(),
            ]);
        } else {
            // Crear nueva conversación asignada al asesor seleccionado
            $conversation = Conversation::create([
                'phone_number' => $phoneNumber,
                'contact_name' => $validated['contact_name'] ?? null,
                'status' => 'active',
                'assigned_to' => $assignedUser->id,
                'last_message_at' => now(),
                'unread_count' => 0,
            ]);
        }

        // Usar plantilla de saludo con el primer nombre del asesor seleccionado
        $advisorName = explode(' ', trim($assignedUser->name))[0];
        
        // Generar el texto del mensaje de saludo para guardar en BD
        $greetingText = "Buen día.\n" .
            "Le saludamos de Hospital Universitario del Valle.\n" .
            "A partir de este momento será atendido(a) por {$advisorName}, quien estará a cargo de la asignación y seguimiento de su cita.\n" .
            "Quedamos atentos a cualquier consulta adicional.";
        
        // Crear el mensaje en la base de datos (enviado por el asesor seleccionado)
        $message = $conversation->messages()->create([
            'content' => $greetingText,
            'message_type' => 'text',
            'is_from_user' => false,
            'sent_by' => $assignedUser->id,
            'status' => 'pending',
        ]);

        // Enviar usando la plantilla de saludo de WhatsApp
        if ($whatsappService->isConfigured()) {
            $result = $whatsappService->sendGreetingTemplate(
                $phoneNumber,
                $advisorName
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

    /**
     * Convierte una imagen WebP a PNG para compatibilidad con WhatsApp Cloud API.
     * WhatsApp NO soporta WebP, solo PNG y JPEG.
     * 
     * @param string $mediaUrl URL relativa del archivo (ej: /storage/templates/archivo.webp)
     * @return string|null URL del archivo PNG convertido, o null si falla
     */
    private function convertWebpToPng(string $mediaUrl): ?string
    {
        try {
            // Obtener la ruta del archivo en el storage
            $relativePath = str_replace('/storage/', '', $mediaUrl);
            $fullPath = storage_path('app/public/' . $relativePath);
            
            if (!file_exists($fullPath)) {
                \Log::error('WebP file not found for conversion', ['path' => $fullPath]);
                return null;
            }
            
            // Crear imagen desde WebP
            $image = @imagecreatefromwebp($fullPath);
            
            if ($image === false) {
                \Log::error('Failed to read WebP image', ['path' => $fullPath]);
                return null;
            }
            
            // Preservar transparencia
            imagesavealpha($image, true);
            
            // Generar nuevo nombre de archivo PNG
            $pathInfo = pathinfo($relativePath);
            $newFilename = $pathInfo['filename'] . '_converted_' . time() . '.png';
            $newRelativePath = $pathInfo['dirname'] . '/' . $newFilename;
            $newFullPath = storage_path('app/public/' . $newRelativePath);
            
            // Guardar como PNG
            $success = imagepng($image, $newFullPath, 9); // 9 = máxima compresión
            imagedestroy($image);
            
            if (!$success) {
                \Log::error('Failed to save PNG image', ['path' => $newFullPath]);
                return null;
            }
            
            \Log::info('WebP to PNG conversion successful', [
                'original' => $mediaUrl,
                'converted' => '/storage/' . $newRelativePath,
            ]);
            
            return '/storage/' . $newRelativePath;
            
        } catch (\Exception $e) {
            \Log::error('Exception during WebP to PNG conversion', [
                'error' => $e->getMessage(),
                'mediaUrl' => $mediaUrl,
            ]);
            return null;
        }
    }
}
