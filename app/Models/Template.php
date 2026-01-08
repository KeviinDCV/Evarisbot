<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Template extends Model
{
    protected $fillable = [
        'name',
        'subject',
        'content',
        'is_active',
        'is_global',
        'message_type',
        'media_url',
        'media_filename',
        'media_files',
        'usage_count',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_global' => 'boolean',
        'media_files' => 'array',
    ];

    /**
     * Obtener todos los archivos multimedia de la plantilla
     * Soporta tanto el formato antiguo (media_url) como el nuevo (media_files)
     */
    public function getMediaFilesArray(): array
    {
        // Si tiene media_files, usarlo
        if (!empty($this->media_files)) {
            return $this->media_files;
        }

        // Fallback al formato antiguo
        if (!empty($this->media_url)) {
            return [[
                'url' => $this->media_url,
                'filename' => $this->media_filename,
                'type' => $this->message_type,
            ]];
        }

        return [];
    }

    /**
     * Verificar si la plantilla tiene archivos multimedia
     */
    public function hasMedia(): bool
    {
        return !empty($this->media_files) || !empty($this->media_url);
    }

    /**
     * Usuario que creó la plantilla
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Usuario que actualizó la plantilla
     */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Envíos masivos de esta plantilla
     */
    public function sends(): HasMany
    {
        return $this->hasMany(TemplateSend::class);
    }

    /**
     * Usuarios asignados a esta plantilla (cuando no es global)
     */
    public function assignedUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'template_user');
    }

    /**
     * Verificar si la plantilla puede ser usada
     */
    public function canBeUsed(): bool
    {
        return $this->is_active && !empty($this->content);
    }

    /**
     * Verificar si la plantilla está disponible para un usuario específico
     */
    public function isAvailableForUser(?int $userId): bool
    {
        if (!$this->canBeUsed()) {
            return false;
        }

        // Si es global, está disponible para todos
        if ($this->is_global) {
            return true;
        }

        // Si no es global, verificar si está asignada al usuario
        if (!$userId) {
            return false;
        }

        return $this->assignedUsers()->where('user_id', $userId)->exists();
    }

    /**
     * Activar la plantilla
     */
    public function markAsActive(): void
    {
        $this->update(['is_active' => true]);
    }

    /**
     * Desactivar la plantilla
     */
    public function markAsInactive(): void
    {
        $this->update(['is_active' => false]);
    }

    /**
     * Alternar estado activo/inactivo
     */
    public function toggleStatus(): void
    {
        $this->update(['is_active' => !$this->is_active]);
    }

    /**
     * Obtener estadísticas de uso de la plantilla
     */
    public function getUsageStats(): array
    {
        return [
            'total_sends' => $this->usage_count ?? 0,
        ];
    }

    /**
     * Incrementar el contador de uso de la plantilla
     */
    public function incrementUsage(): void
    {
        $this->increment('usage_count');
    }

    /**
     * Scopes
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeInactive($query)
    {
        return $query->where('is_active', false);
    }

    public function scopeByUser($query, $userId)
    {
        return $query->where('created_by', $userId);
    }

    public function scopeOfType($query, $type)
    {
        return $query->where('message_type', $type);
    }

    public function scopeAvailableForUser($query, $userId)
    {
        return $query->where(function ($q) use ($userId) {
            $q->where('is_global', true)
              ->orWhereHas('assignedUsers', function ($subQuery) use ($userId) {
                  $subQuery->where('user_id', $userId);
              });
        });
    }
}
