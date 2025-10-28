<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TemplateSend extends Model
{
    protected $fillable = [
        'template_id',
        'sent_by',
        'total_recipients',
        'successful_sends',
        'failed_sends',
        'status',
        'sent_to_all',
        'recipient_ids',
        'started_at',
        'completed_at',
    ];

    protected $casts = [
        'sent_to_all' => 'boolean',
        'recipient_ids' => 'array',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    /**
     * Plantilla relacionada
     */
    public function template(): BelongsTo
    {
        return $this->belongsTo(Template::class);
    }

    /**
     * Usuario que envió
     */
    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }

    /**
     * Marcar como completado
     */
    public function markAsCompleted(): void
    {
        $this->update([
            'status' => 'completed',
            'completed_at' => now(),
        ]);
    }

    /**
     * Marcar como fallido
     */
    public function markAsFailed(): void
    {
        $this->update([
            'status' => 'failed',
            'completed_at' => now(),
        ]);
    }

    /**
     * Marcar como en progreso
     */
    public function markAsInProgress(): void
    {
        $this->update([
            'status' => 'in_progress',
            'started_at' => now(),
        ]);
    }

    /**
     * Incrementar contador de envíos exitosos
     */
    public function incrementSuccessful(): void
    {
        $this->increment('successful_sends');
    }

    /**
     * Incrementar contador de envíos fallidos
     */
    public function incrementFailed(): void
    {
        $this->increment('failed_sends');
    }

    /**
     * Obtener progreso de envío
     */
    public function getProgress(): float
    {
        if ($this->total_recipients === 0) {
            return 0;
        }

        $processed = $this->successful_sends + $this->failed_sends;
        return round(($processed / $this->total_recipients) * 100, 2);
    }

    /**
     * Verificar si el envío está completo
     */
    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    /**
     * Verificar si el envío está en progreso
     */
    public function isInProgress(): bool
    {
        return $this->status === 'in_progress';
    }

    /**
     * Scopes
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    public function scopeInProgress($query)
    {
        return $query->where('status', 'in_progress');
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeBySender($query, $userId)
    {
        return $query->where('sent_by', $userId);
    }
}
