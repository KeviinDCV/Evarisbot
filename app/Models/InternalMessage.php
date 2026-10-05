<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InternalMessage extends Model
{
    protected $fillable = [
        'internal_chat_id',
        'user_id',
        'body',
        'type',
        'file_path',
        'file_name',
        'file_mime',
        'file_size',
        'reply_to_id',
        'edited_at',
    ];

    protected $casts = [
        'edited_at' => 'datetime',
    ];

    public function reactions(): HasMany
    {
        return $this->hasMany(InternalMessageReaction::class);
    }

    public function chat(): BelongsTo
    {
        return $this->belongsTo(InternalChat::class, 'internal_chat_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function replyTo(): BelongsTo
    {
        return $this->belongsTo(InternalMessage::class, 'reply_to_id');
    }

    /**
     * URL pública del archivo (si aplica).
     * Devuelve null si el archivo físico no existe en disco,
     * para que el frontend no genere requests 403/404 a archivos perdidos
     * en la migración del servidor anterior.
     */
    public function getFileUrlAttribute(): ?string
    {
        if (!$this->file_path) {
            return null;
        }

        if (!\Storage::disk('public')->exists($this->file_path)) {
            return null;
        }

        return asset('storage/' . $this->file_path);
    }

    /**
     * Indica si el archivo físico está disponible.
     * Útil para que el frontend muestre placeholder "no disponible".
     */
    public function getFileMissingAttribute(): bool
    {
        return $this->file_path
            && !\Storage::disk('public')->exists($this->file_path);
    }

    /**
     * Tamaño humano del archivo
     */
    public function getFileSizeHumanAttribute(): ?string
    {
        if (!$this->file_size) {
            return null;
        }

        $units = ['B', 'KB', 'MB', 'GB'];
        $size = $this->file_size;
        $unitIndex = 0;

        while ($size >= 1024 && $unitIndex < count($units) - 1) {
            $size /= 1024;
            $unitIndex++;
        }

        return round($size, 1) . ' ' . $units[$unitIndex];
    }
}
