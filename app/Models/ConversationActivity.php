<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ConversationActivity extends Model
{
    protected $fillable = [
        'conversation_id',
        'user_id',
        'type',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function conversation()
    {
        return $this->belongsTo(Conversation::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Log an activity for a conversation.
     */
    public static function log(int $conversationId, string $type, ?int $userId = null, ?array $metadata = null): self
    {
        return static::create([
            'conversation_id' => $conversationId,
            'user_id' => $userId ?? auth()->id(),
            'type' => $type,
            'metadata' => $metadata,
        ]);
    }
}
