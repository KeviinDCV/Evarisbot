<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InternalChatParticipant extends Model
{
    protected $fillable = [
        'internal_chat_id',
        'user_id',
        'role',
        'last_read_at',
    ];

    protected $casts = [
        'last_read_at' => 'datetime',
    ];

    public function chat(): BelongsTo
    {
        return $this->belongsTo(InternalChat::class, 'internal_chat_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
