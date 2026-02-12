<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Conversation extends Model
{
    protected $fillable = [
        'phone_number',
        'contact_name',
        'profile_picture_url',
        'status',
        'assigned_to',
        'resolved_by',
        'resolved_at',
        'last_message_at',
        'unread_count',
        'notes',
    ];

    protected $casts = [
        'last_message_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    /**
     * Relación con los mensajes
     */
    public function messages(): HasMany
    {
        return $this->hasMany(Message::class)->orderBy('created_at', 'asc');
    }

    /**
     * Último mensaje de la conversación
     */
    public function lastMessage()
    {
        return $this->hasOne(Message::class)->latestOfMany();
    }

    /**
     * Usuario (asesor) asignado
     */
    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    /**
     * Usuario que resolvió la conversación
     */
    public function resolvedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    /**
     * Marcar mensajes como leídos
     */
    public function markAsRead(): void
    {
        $this->update(['unread_count' => 0]);
        
        $this->messages()
            ->where('is_from_user', true)
            ->where('status', '!=', 'read')
            ->update(['status' => 'read']);
    }

    /**
     * Incrementar contador de no leídos
     */
    public function incrementUnread(): void
    {
        $this->increment('unread_count');
    }

    /**
     * Scopes para filtrar conversaciones
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeAssignedTo($query, $userId)
    {
        return $query->where('assigned_to', $userId);
    }

    public function scopeUnassigned($query)
    {
        return $query->whereNull('assigned_to');
    }

    public function scopeWithUnread($query)
    {
        return $query->where('unread_count', '>', 0);
    }

    /**
     * Etiquetas de la conversación
     */
    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class, 'conversation_tag')->withTimestamps();
    }
}
