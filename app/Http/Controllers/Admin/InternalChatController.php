<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\InternalChat;
use App\Models\InternalChatParticipant;
use App\Models\InternalMessage;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class InternalChatController extends Controller
{
    /**
     * Formatear un mensaje para la respuesta JSON
     */
    private function formatMessage(InternalMessage $m, int $userId): array
    {
        $data = [
            'id' => $m->id,
            'body' => $m->body,
            'type' => $m->type,
            'file_url' => $m->file_url,
            'file_name' => $m->file_name,
            'file_mime' => $m->file_mime,
            'file_size_human' => $m->file_size_human,
            'user' => [
                'id' => $m->user->id,
                'name' => $m->user->name,
            ],
            'is_mine' => $m->user_id === $userId,
            'created_at' => $m->created_at->format('H:i'),
            'created_at_full' => $m->created_at->toISOString(),
            'reply_to' => null,
        ];

        if ($m->reply_to_id && $m->replyTo) {
            $r = $m->replyTo;
            $data['reply_to'] = [
                'id' => $r->id,
                'body' => $r->body,
                'type' => $r->type,
                'file_name' => $r->file_name,
                'user_name' => $r->user?->name ?? 'Usuario',
            ];
        }

        return $data;
    }

    /**
     * Mostrar la interfaz del chat interno
     */
    public function index()
    {
        $userId = auth()->id();

        $chats = InternalChat::whereHas('participants', function ($q) use ($userId) {
            $q->where('users.id', $userId);
        })
            ->with(['latestMessage.user', 'participants'])
            ->get()
            ->map(function ($chat) use ($userId) {
                return [
                    'id' => $chat->id,
                    'name' => $chat->displayNameFor($userId),
                    'type' => $chat->type,
                    'created_by' => $chat->created_by,
                    'unread' => $chat->unreadCountFor($userId),
                    'participants' => $chat->participants->map(fn($u) => [
                        'id' => $u->id,
                        'name' => $u->name,
                        'role' => $u->role,
                        'is_online' => $u->isOnline(),
                    ]),
                    'latest_message' => $chat->latestMessage ? [
                        'body' => $chat->latestMessage->body,
                        'type' => $chat->latestMessage->type,
                        'user_name' => $chat->latestMessage->user->name,
                        'created_at' => $chat->latestMessage->created_at->diffForHumans(),
                    ] : null,
                    'latest_message_raw' => $chat->latestMessage?->created_at?->toISOString(),
                ];
            })
            ->sortBy([
                fn($a, $b) => ($b['unread'] > 0 ? 1 : 0) <=> ($a['unread'] > 0 ? 1 : 0), // No leídos primero
                fn($a, $b) => ($b['latest_message_raw'] ?? '') <=> ($a['latest_message_raw'] ?? ''), // Más recientes primero
            ])
            ->map(function ($c) { unset($c['latest_message_raw']); return $c; })
            ->values();

        $users = User::where('id', '!=', $userId)
            ->orderBy('name')
            ->get()
            ->map(fn($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'role' => $u->role,
                'is_online' => $u->isOnline(),
            ]);

        return Inertia::render('admin/internal-chat/index', [
            'chats' => $chats,
            'users' => $users,
        ]);
    }

    /**
     * API: obtener lista de chats como JSON puro (para polling sin Inertia)
     */
    public function chatList()
    {
        $userId = auth()->id();

        $chats = InternalChat::whereHas('participants', function ($q) use ($userId) {
            $q->where('users.id', $userId);
        })
            ->with(['latestMessage.user', 'participants'])
            ->get()
            ->map(function ($chat) use ($userId) {
                return [
                    'id' => $chat->id,
                    'name' => $chat->displayNameFor($userId),
                    'type' => $chat->type,
                    'created_by' => $chat->created_by,
                    'unread' => $chat->unreadCountFor($userId),
                    'participants' => $chat->participants->map(fn($u) => [
                        'id' => $u->id,
                        'name' => $u->name,
                        'role' => $u->role,
                        'is_online' => $u->isOnline(),
                    ]),
                    'latest_message' => $chat->latestMessage ? [
                        'body' => $chat->latestMessage->body,
                        'type' => $chat->latestMessage->type,
                        'user_name' => $chat->latestMessage->user->name,
                        'created_at' => $chat->latestMessage->created_at->diffForHumans(),
                    ] : null,
                    'latest_message_raw' => $chat->latestMessage?->created_at?->toISOString(),
                ];
            })
            ->sortBy([
                fn($a, $b) => ($b['unread'] > 0 ? 1 : 0) <=> ($a['unread'] > 0 ? 1 : 0),
                fn($a, $b) => ($b['latest_message_raw'] ?? '') <=> ($a['latest_message_raw'] ?? ''),
            ])
            ->map(function ($c) { unset($c['latest_message_raw']); return $c; })
            ->values();

        return response()->json(['chats' => $chats]);
    }

    /**
     * Obtener mensajes de un chat
     */
    public function messages(InternalChat $chat)
    {
        $userId = auth()->id();

        if (!$chat->hasParticipant($userId)) {
            return response()->json(['error' => 'No autorizado'], 403);
        }

        // Marcar como leído
        InternalChatParticipant::where('internal_chat_id', $chat->id)
            ->where('user_id', $userId)
            ->update(['last_read_at' => now()]);

        $messages = $chat->messages()
            ->with(['user', 'replyTo.user'])
            ->orderBy('created_at', 'desc')
            ->limit(200)
            ->get()
            ->reverse()
            ->values()
            ->map(fn($m) => $this->formatMessage($m, $userId));

        $chatData = [
            'id' => $chat->id,
            'name' => $chat->displayNameFor($userId),
            'type' => $chat->type,
            'participants' => $chat->participants->map(fn($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'role' => $u->role,
                'is_online' => $u->isOnline(),
            ]),
        ];

        return response()->json([
            'chat' => $chatData,
            'messages' => $messages,
        ]);
    }

    /**
     * Crear chat directo o grupal
     */
    public function create(Request $request)
    {
        $userId = auth()->id();

        $request->validate([
            'type' => 'required|in:direct,group',
            'name' => 'nullable|string|max:100',
            'user_ids' => 'required|array|min:1',
            'user_ids.*' => 'exists:users,id',
        ]);

        $type = $request->input('type');
        $userIds = $request->input('user_ids');

        // Para chat directo, verificar que no exista ya
        if ($type === 'direct' && count($userIds) === 1) {
            $targetUserId = $userIds[0];

            $existing = InternalChat::where('type', 'direct')
                ->whereHas('participants', fn($q) => $q->where('users.id', $userId))
                ->whereHas('participants', fn($q) => $q->where('users.id', $targetUserId))
                ->first();

            if ($existing) {
                return response()->json([
                    'success' => true,
                    'chat_id' => $existing->id,
                    'existing' => true,
                ]);
            }
        }

        $chat = InternalChat::create([
            'name' => $type === 'group' ? ($request->input('name') ?: 'Nuevo grupo') : null,
            'type' => $type,
            'created_by' => $userId,
        ]);

        // Agregar creador como admin
        $chat->participants()->attach($userId, ['role' => 'admin']);

        // Agregar otros participantes
        foreach ($userIds as $uid) {
            if ($uid != $userId) {
                $chat->participants()->attach($uid, ['role' => 'member']);
            }
        }

        return response()->json([
            'success' => true,
            'chat_id' => $chat->id,
        ]);
    }

    /**
     * Enviar mensaje (texto o archivo)
     */
    public function send(Request $request, InternalChat $chat)
    {
        $userId = auth()->id();

        if (!$chat->hasParticipant($userId)) {
            return response()->json(['error' => 'No autorizado'], 403);
        }

        $request->validate([
            'body' => 'nullable|string|max:5000',
            'content' => 'nullable|string|max:5000',
            'file' => 'nullable|file|max:25600', // Max 25MB
            'reply_to_id' => 'nullable|integer|exists:internal_messages,id',
        ]);

        // Accept both 'body' and 'content' from frontend
        $bodyText = $request->input('body') ?? $request->input('content');

        $type = 'text';
        $filePath = null;
        $fileName = null;
        $fileMime = null;
        $fileSize = null;

        // Procesar archivo
        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $fileName = $file->getClientOriginalName();
            $fileMime = $file->getMimeType();
            $fileSize = $file->getSize();

            // Detectar tipo por MIME
            if (str_starts_with($fileMime, 'image/')) {
                $type = 'image';
            } elseif (str_starts_with($fileMime, 'video/')) {
                $type = 'video';
            } elseif (str_starts_with($fileMime, 'audio/')) {
                $type = 'audio';
            } else {
                $type = 'document';
            }

            $filePath = $file->store('internal-chat/' . $chat->id, 'public');
        }

        if (!$bodyText && !$filePath) {
            return response()->json(['error' => 'Envíe un mensaje o archivo'], 422);
        }

        $message = InternalMessage::create([
            'internal_chat_id' => $chat->id,
            'user_id' => $userId,
            'body' => $bodyText,
            'type' => $type,
            'file_path' => $filePath,
            'file_name' => $fileName,
            'file_mime' => $fileMime,
            'file_size' => $fileSize,
            'reply_to_id' => $request->input('reply_to_id'),
        ]);

        $message->load(['user', 'replyTo.user']);

        // Marcar como leído para el remitente
        InternalChatParticipant::where('internal_chat_id', $chat->id)
            ->where('user_id', $userId)
            ->update(['last_read_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => $this->formatMessage($message, $userId),
        ]);
    }

    /**
     * Marcar chat como leído
     */
    public function markRead(InternalChat $chat)
    {
        $userId = auth()->id();

        InternalChatParticipant::where('internal_chat_id', $chat->id)
            ->where('user_id', $userId)
            ->update(['last_read_at' => now()]);

        return response()->json(['success' => true]);
    }

    /**
     * Obtener conteo total de no leídos del chat interno
     */
    public function unreadCount()
    {
        $userId = auth()->id();

        $count = InternalChat::whereHas('participants', function ($q) use ($userId) {
            $q->where('users.id', $userId);
        })->get()->sum(fn($chat) => $chat->unreadCountFor($userId));

        return response()->json(['count' => $count]);
    }

    /**
     * Polling: obtener nuevos mensajes desde cierta hora
     */
    public function poll(Request $request, InternalChat $chat)
    {
        $userId = auth()->id();

        if (!$chat->hasParticipant($userId)) {
            return response()->json(['error' => 'No autorizado'], 403);
        }

        $since = $request->query('since');

        $query = $chat->messages()->with(['user', 'replyTo.user']);

        if ($since) {
            $query->where('created_at', '>', $since);
        }

        $messages = $query->orderBy('created_at', 'asc')
            ->get()
            ->map(fn($m) => $this->formatMessage($m, $userId));

        // Actualizar last_read_at
        if ($messages->count() > 0) {
            InternalChatParticipant::where('internal_chat_id', $chat->id)
                ->where('user_id', $userId)
                ->update(['last_read_at' => now()]);
        }

        return response()->json(['messages' => $messages]);
    }

    /**
     * Renombrar un chat grupal
     */
    public function rename(Request $request, InternalChat $chat)
    {
        $userId = auth()->id();

        if (!$chat->hasParticipant($userId)) {
            return response()->json(['error' => 'No autorizado'], 403);
        }

        if ($chat->type !== 'group') {
            return response()->json(['error' => 'Solo se pueden renombrar grupos'], 400);
        }

        $request->validate([
            'name' => 'required|string|max:100',
        ]);

        $chat->update(['name' => $request->input('name')]);

        return response()->json(['success' => true, 'name' => $chat->name]);
    }

    /**
     * Eliminar un chat (salir del chat)
     */
    public function destroy(InternalChat $chat)
    {
        $userId = auth()->id();

        if (!$chat->hasParticipant($userId)) {
            return response()->json(['error' => 'No autorizado'], 403);
        }

        if ($chat->type === 'direct') {
            // En chat directo, eliminar para ambos: borrar mensajes y el chat
            $chat->messages()->delete();
            $chat->participants()->detach();
            $chat->delete();
        } else {
            // En grupo: si es el creador, eliminar todo; si no, solo salir
            if ($chat->created_by === $userId) {
                $chat->messages()->delete();
                $chat->participants()->detach();
                $chat->delete();
            } else {
                // Solo salir del grupo
                $chat->participants()->detach($userId);
            }
        }

        return response()->json(['success' => true]);
    }

    /**
     * Obtener quién ha leído el chat (read receipts)
     * Devuelve por cada participante (excepto el propio usuario) su last_read_at,
     * para que el frontend pueda mostrar "Visto por X" en el último mensaje leído.
     */
    public function readReceipts(InternalChat $chat)
    {
        $userId = auth()->id();

        if (!$chat->hasParticipant($userId)) {
            return response()->json(['error' => 'No autorizado'], 403);
        }

        $receipts = InternalChatParticipant::where('internal_chat_id', $chat->id)
            ->where('user_id', '!=', $userId)
            ->whereNotNull('last_read_at')
            ->with('user')
            ->get()
            ->map(fn($p) => [
                'user_id'      => $p->user_id,
                'user_name'    => $p->user->name,
                'last_read_at' => $p->last_read_at->toISOString(),
            ]);

        return response()->json(['receipts' => $receipts]);
    }

    /**
     * Agregar participantes a un grupo existente
     */
    public function addParticipants(Request $request, InternalChat $chat)
    {
        $userId = auth()->id();

        if (!$chat->hasParticipant($userId)) {
            return response()->json(['error' => 'No autorizado'], 403);
        }

        if ($chat->type !== 'group') {
            return response()->json(['error' => 'Solo se pueden agregar participantes a grupos'], 400);
        }

        $request->validate([
            'user_ids' => 'required|array|min:1',
            'user_ids.*' => 'exists:users,id',
        ]);

        $added = [];
        foreach ($request->input('user_ids') as $uid) {
            if (!$chat->hasParticipant($uid)) {
                $chat->participants()->attach($uid, ['role' => 'member']);
                $user = User::find($uid);
                $added[] = $user->name;
            }
        }

        if (empty($added)) {
            return response()->json(['success' => false, 'message' => 'Los usuarios seleccionados ya son participantes'], 400);
        }

        // Recargar participantes
        $chat->load('participants');
        $participants = $chat->participants->map(fn($u) => [
            'id' => $u->id,
            'name' => $u->name,
            'role' => $u->pivot->role ?? 'member',
            'is_online' => $u->isOnline(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Se agregaron: ' . implode(', ', $added),
            'participants' => $participants,
        ]);
    }

    /**
     * Eliminar un participante de un grupo
     */
    public function removeParticipant(InternalChat $chat, User $user)
    {
        $userId = auth()->id();

        if (!$chat->hasParticipant($userId)) {
            return response()->json(['error' => 'No autorizado'], 403);
        }

        if ($chat->type !== 'group') {
            return response()->json(['error' => 'Solo se pueden eliminar participantes de grupos'], 400);
        }

        // No se puede eliminar al creador del grupo
        if ($user->id === $chat->created_by) {
            return response()->json(['error' => 'No se puede eliminar al creador del grupo'], 400);
        }

        // No se puede eliminar a uno mismo con este endpoint (usar destroy/leave)
        if ($user->id === $userId) {
            return response()->json(['error' => 'Para salir del grupo, usa la opción "Salir del grupo"'], 400);
        }

        if (!$chat->hasParticipant($user->id)) {
            return response()->json(['error' => 'El usuario no es participante de este grupo'], 400);
        }

        $chat->participants()->detach($user->id);

        // Recargar participantes
        $chat->load('participants');
        $participants = $chat->participants->map(fn($u) => [
            'id' => $u->id,
            'name' => $u->name,
            'role' => $u->pivot->role ?? 'member',
            'is_online' => $u->isOnline(),
        ]);

        return response()->json([
            'success' => true,
            'message' => $user->name . ' fue eliminado del grupo',
            'participants' => $participants,
        ]);
    }
}
