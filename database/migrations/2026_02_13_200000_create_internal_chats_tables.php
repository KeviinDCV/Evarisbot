<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Conversaciones internas (1-a-1 o grupo)
        Schema::create('internal_chats', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable(); // Nombre del grupo (null para 1-a-1)
            $table->enum('type', ['direct', 'group'])->default('direct');
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->timestamps();
        });

        // Participantes de cada chat
        Schema::create('internal_chat_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('internal_chat_id')->constrained('internal_chats')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->enum('role', ['admin', 'member'])->default('member');
            $table->timestamp('last_read_at')->nullable();
            $table->timestamps();

            $table->unique(['internal_chat_id', 'user_id']);
        });

        // Mensajes del chat interno
        Schema::create('internal_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('internal_chat_id')->constrained('internal_chats')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->text('body')->nullable(); // Texto del mensaje
            $table->enum('type', ['text', 'image', 'video', 'document', 'audio'])->default('text');
            $table->string('file_path')->nullable();
            $table->string('file_name')->nullable();
            $table->string('file_mime')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->timestamps();

            $table->index(['internal_chat_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('internal_messages');
        Schema::dropIfExists('internal_chat_participants');
        Schema::dropIfExists('internal_chats');
    }
};
