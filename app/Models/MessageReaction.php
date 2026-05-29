<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MessageReaction extends Model
{
    protected $fillable = [
        'message_id',
        'emoji',
        'from_user',
        'reacted_by',
        'whatsapp_message_id',
    ];

    protected $casts = [
        'from_user' => 'boolean',
    ];

    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class);
    }

    public function reactor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reacted_by');
    }
}
