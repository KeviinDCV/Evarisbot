<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WelcomeFlowStep extends Model
{
    protected $fillable = [
        'welcome_flow_id',
        'step_key',
        'order',
        'message',
        'message_type',
        'buttons',
        'options',
        'next_steps',
        'next_step_on_text',
        'fallback_message',
        'is_entry_point',
    ];

    protected $casts = [
        'buttons' => 'array',
        'options' => 'array',
        'next_steps' => 'array',
        'is_entry_point' => 'boolean',
        'order' => 'integer',
    ];

    /**
     * Flujo al que pertenece
     */
    public function welcomeFlow(): BelongsTo
    {
        return $this->belongsTo(WelcomeFlow::class);
    }

    /**
     * Obtener el siguiente paso basado en un button_id
     */
    public function getNextStepKey(?string $buttonId = null): ?string
    {
        if ($buttonId && $this->next_steps && isset($this->next_steps[$buttonId])) {
            return $this->next_steps[$buttonId];
        }

        return $this->next_step_on_text;
    }
}
