<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bulk_sends', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable(); // Nombre descriptivo del envío
            $table->string('template_name'); // Nombre del template de WhatsApp
            $table->json('template_params')->nullable(); // Parámetros del template (JSON)
            $table->enum('status', ['draft', 'processing', 'completed', 'failed', 'cancelled'])->default('draft');
            $table->unsignedInteger('total_recipients')->default(0);
            $table->unsignedInteger('sent_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            $table->string('batch_id')->nullable(); // Laravel Bus Batch ID
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->timestamps();
        });

        Schema::create('bulk_send_recipients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bulk_send_id')->constrained('bulk_sends')->onDelete('cascade');
            $table->string('phone_number');
            $table->string('contact_name')->nullable();
            $table->enum('status', ['pending', 'sent', 'failed'])->default('pending');
            $table->text('error')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bulk_send_recipients');
        Schema::dropIfExists('bulk_sends');
    }
};
