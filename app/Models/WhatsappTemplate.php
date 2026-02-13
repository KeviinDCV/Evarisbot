<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WhatsappTemplate extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'meta_template_name',
        'preview_text',
        'language',
        'default_params',
        'is_active',
    ];

    protected $casts = [
        'default_params' => 'array',
        'is_active' => 'boolean',
    ];

    /**
     * Scope para templates activos
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
