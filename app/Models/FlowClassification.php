<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FlowClassification extends Model
{
    protected $fillable = [
        'conversation_id',
        'accepted_privacy',
        'document_type',
        'eps',
        'regimen',
        'service',
        'sub_service',
        'outcome',
        'last_step',
        'started_at',
        'completed_at',
    ];

    protected $casts = [
        'accepted_privacy' => 'boolean',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }
}
