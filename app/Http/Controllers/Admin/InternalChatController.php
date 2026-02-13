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
            ->with('user')
            ->orderBy('created_at', 'asc')
            ->limit(200)
            ->get()
            ->map(fn($m) => [
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
                'created_at_full' => $m->created_at->format('Y-m-d H:i'),
            ]);

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
        // Solo administradores pueden crear chats/grupos
        if (auth()->user()->role !== 'admin') {
            return response()->json(['error' => 'Solo los administradores pueden crear chats o grupos'], 403);
        }

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
        ]);

        $message->load('user');

        // Marcar como leído para el remitente
        InternalChatParticipant::where('internal_chat_id', $chat->id)
            ->where('user_id', $userId)
            ->update(['last_read_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => [
                'id' => $message->id,
                'body' => $message->body,
                'type' => $message->type,
                'file_url' => $message->file_url,
                'file_name' => $message->file_name,
                'file_mime' => $message->file_mime,
                'file_size_human' => $message->file_size_human,
                'user' => [
                    'id' => $message->user->id,
                    'name' => $message->user->name,
                ],
                'is_mine' => true,
                'created_at' => $message->created_at->format('H:i'),
                'created_at_full' => $message->created_at->format('Y-m-d H:i'),
            ],
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

        $query = $chat->messages()->with('user');

        if ($since) {
            $query->where('created_at', '>', $since);
        }

        $messages = $query->orderBy('created_at', 'asc')
            ->get()
            ->map(fn($m) => [
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
                'created_at_full' => $m->created_at->format('Y-m-d H:i'),
            ]);

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
}
