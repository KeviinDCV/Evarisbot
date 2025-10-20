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
        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            $table->string('phone_number')->unique();
            $table->string('contact_name')->nullable();
            $table->string('profile_picture_url')->nullable();
            $table->enum('status', ['active', 'pending', 'in_progress', 'resolved', 'closed'])->default('active');
            $table->foreignId('assigned_to')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('last_message_at')->nullable();
            $table->integer('unread_count')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
            
            $table->index('phone_number');
            $table->index('status');
            $table->index('assigned_to');
            $table->index('last_message_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('conversations');
    }
};
