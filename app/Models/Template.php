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
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_global' => 'boolean',
    ];

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
        $sends = $this->sends()->get();
        
        return [
            'total_sends' => $sends->count(),
            'total_recipients' => $sends->sum('total_recipients'),
            'successful_sends' => $sends->sum('successful_sends'),
            'failed_sends' => $sends->sum('failed_sends'),
            'last_sent_at' => $sends->max('completed_at'),
        ];
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
