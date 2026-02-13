<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BulkSendRecipient extends Model
{
    protected $fillable = [
        'bulk_send_id',
        'phone_number',
        'contact_name',
        'status',
        'error',
        'sent_at',
    ];

    protected $casts = [
        'sent_at' => 'datetime',
    ];

    /**
     * Envío masivo al que pertenece este destinatario
     */
    public function bulkSend(): BelongsTo
    {
        return $this->belongsTo(BulkSend::class);
    }

    /**
     * Marcar como enviado
     */
    public function markAsSent(): void
    {
        $this->update([
            'status' => 'sent',
            'sent_at' => now(),
            'error' => null,
        ]);
    }

    /**
     * Marcar como fallido
     */
    public function markAsFailed(string $error): void
    {
        $this->update([
            'status' => 'failed',
            'error' => $error,
        ]);
    }
}
