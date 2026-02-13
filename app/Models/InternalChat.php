<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class InternalChat extends Model
{
    protected $fillable = [
        'name',
        'type',
        'created_by',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function participants(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'internal_chat_participants')
            ->withPivot('role', 'last_read_at')
            ->withTimestamps();
    }

    public function participantRecords(): HasMany
    {
        return $this->hasMany(InternalChatParticipant::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(InternalMessage::class);
    }

    public function latestMessage(): HasOne
    {
        return $this->hasOne(InternalMessage::class)->latestOfMany();
    }

    /**
     * Verificar si un usuario es participante del chat
     */
    public function hasParticipant(int $userId): bool
    {
        return $this->participants()->where('users.id', $userId)->exists();
    }

    /**
     * Cantidad de mensajes no leídos para un usuario
     */
    public function unreadCountFor(int $userId): int
    {
        $participant = $this->participantRecords()->where('user_id', $userId)->first();

        if (!$participant) {
            return 0;
        }

        $query = $this->messages()->where('user_id', '!=', $userId);

        if ($participant->last_read_at) {
            $query->where('created_at', '>', $participant->last_read_at);
        }

        return $query->count();
    }

    /**
     * Nombre a mostrar para el chat
     */
    public function displayNameFor(int $userId): string
    {
        if ($this->type === 'group') {
            return $this->name ?? 'Grupo sin nombre';
        }

        // Para chats directos: mostrar el nombre del otro participante
        $other = $this->participants()->where('users.id', '!=', $userId)->first();
        return $other?->name ?? 'Chat';
    }
}
