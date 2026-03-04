<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WelcomeFlow extends Model
{
    protected $fillable = [
        'name',
        'message',
        'buttons',
        'responses',
        'is_active',
        'trigger_type',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'buttons' => 'array',
        'responses' => 'array',
        'is_active' => 'boolean',
    ];

    /**
     * Obtener el flujo activo (solo puede haber uno activo a la vez)
     */
    public static function getActive(): ?self
    {
        return static::where('is_active', true)->first();
    }

    /**
     * Pasos del flujo
     */
    public function steps(): HasMany
    {
        return $this->hasMany(WelcomeFlowStep::class)->orderBy('order');
    }

    /**
     * Obtener el paso de entrada del flujo
     */
    public function getEntryStep(): ?WelcomeFlowStep
    {
        return $this->steps()->where('is_entry_point', true)->first();
    }

    /**
     * Obtener un paso por su key
     */
    public function getStepByKey(string $key): ?WelcomeFlowStep
    {
        return $this->steps()->where('step_key', $key)->first();
    }

    /**
     * Creador del flujo
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Último editor del flujo
     */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
