<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Reacciones (emojis) a mensajes del chat interno.
 * Cada usuario tiene como máximo UNA reacción por mensaje (reaccionar de nuevo
 * con el mismo emoji la quita; con otro emoji la reemplaza).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('internal_message_reactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('internal_message_id')->constrained('internal_messages')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('emoji', 16);
            $table->timestamps();

            $table->unique(['internal_message_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('internal_message_reactions');
    }
};
