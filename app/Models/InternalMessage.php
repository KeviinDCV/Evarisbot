<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
    ];

    public function chat(): BelongsTo
    {
        return $this->belongsTo(InternalChat::class, 'internal_chat_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * URL pública del archivo (si aplica)
     */
    public function getFileUrlAttribute(): ?string
    {
        if (!$this->file_path) {
            return null;
        }

        return asset('storage/' . $this->file_path);
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
