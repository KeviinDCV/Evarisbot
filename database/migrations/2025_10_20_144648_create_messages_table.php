<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->onDelete('cascade');
            $table->text('content');
            $table->enum('message_type', ['text', 'image', 'document', 'audio', 'video', 'location'])->default('text');
            $table->string('media_url')->nullable();
            $table->string('media_mime_type')->nullable();
            $table->string('media_filename')->nullable();
            $table->boolean('is_from_user')->default(true);
            $table->string('whatsapp_message_id')->nullable()->unique();
            $table->enum('status', ['pending', 'sent', 'delivered', 'read', 'failed'])->default('pending');
            $table->text('error_message')->nullable();
            $table->foreignId('sent_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
            
            $table->index('conversation_id');
            $table->index('whatsapp_message_id');
            $table->index('is_from_user');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('messages');
    }
};
