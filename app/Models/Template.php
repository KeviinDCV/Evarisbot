<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Template extends Model
{
    protected $fillable = [
        'name',
        'subject',
        'content',
        'is_active',
        'message_type',
        'media_url',
        'media_filename',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
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
     * Verificar si la plantilla puede ser usada
     */
    public function canBeUsed(): bool
    {
        return $this->is_active && !empty($this->content);
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
}
