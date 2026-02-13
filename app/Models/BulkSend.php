<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BulkSend extends Model
{
    protected $fillable = [
        'name',
        'template_name',
        'template_params',
        'status',
        'total_recipients',
        'sent_count',
        'failed_count',
        'batch_id',
        'created_by',
    ];

    protected $casts = [
        'template_params' => 'array',
    ];

    /**
     * Usuario que creó el envío masivo
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Destinatarios del envío masivo
     */
    public function recipients(): HasMany
    {
        return $this->hasMany(BulkSendRecipient::class);
    }

    /**
     * Incrementar contador de enviados atómicamente
     */
    public function incrementSent(): void
    {
        $this->increment('sent_count');
    }

    /**
     * Incrementar contador de fallidos atómicamente
     */
    public function incrementFailed(): void
    {
        $this->increment('failed_count');
    }
}
