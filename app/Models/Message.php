<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Message extends Model
{
    protected $fillable = [
        'conversation_id',
        'content',
        'message_type',
        'media_url',
        'media_mime_type',
        'media_filename',
        'is_from_user',
        'whatsapp_message_id',
        'status',
        'error_message',
        'sent_by',
    ];

    protected $casts = [
        'is_from_user' => 'boolean',
    ];

    /**
     * Relación con la conversación
     */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /**
     * Usuario que envió el mensaje (asesor)
     */
    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }

    /**
     * Verificar si el mensaje es del usuario (cliente)
     */
    public function isFromUser(): bool
    {
        return $this->is_from_user;
    }

    /**
     * Verificar si el mensaje es de un asesor
     */
    public function isFromAdvisor(): bool
    {
        return !$this->is_from_user;
    }

    /**
     * Verificar si el mensaje tiene multimedia
     */
    public function hasMedia(): bool
    {
        return !empty($this->media_url);
    }

    /**
     * Obtener el icono según el tipo de mensaje
     */
    public function getTypeIcon(): string
    {
        return match($this->message_type) {
            'image' => '🖼️',
            'document' => '📄',
            'audio' => '🎵',
            'video' => '🎥',
            'location' => '📍',
            default => '💬',
        };
    }

    /**
     * Scopes
     */
    public function scopeFromUser($query)
    {
        return $query->where('is_from_user', true);
    }

    public function scopeFromAdvisor($query)
    {
        return $query->where('is_from_user', false);
    }

    public function scopeUnread($query)
    {
        return $query->where('status', '!=', 'read');
    }
}
