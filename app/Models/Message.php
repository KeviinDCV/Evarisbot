<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Message extends Model
{
    protected $fillable = [
        'conversation_id',
        'content',
        'message_type',
        'media_url',
        'media_mime_type',
        'media_filename',
        'transcription',
        'is_from_user',
        'is_hidden',
        'whatsapp_message_id',
        'reply_to_id',
        'status',
        'error_message',
        'sent_by',
        'pricing_category',
        'pricing_model',
        'billable',
        'conversation_origin_type',
        'wa_conversation_id',
    ];

    protected $casts = [
        'is_from_user' => 'boolean',
        'is_hidden' => 'boolean',
        'billable' => 'boolean',
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
     * Mensaje al que se está respondiendo
     */
    public function replyTo(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'reply_to_id');
    }

    /**
     * Reacciones (emojis) sobre este mensaje.
     * Como máximo una por lado (paciente / negocio).
     */
    public function reactions(): HasMany
    {
        return $this->hasMany(MessageReaction::class);
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

    /**
     * Solo mensajes visibles para los asesores (excluye respuestas
     * automáticas de cita marcadas como ocultas).
     */
    public function scopeVisible($query)
    {
        return $query->where('is_hidden', false);
    }
}
