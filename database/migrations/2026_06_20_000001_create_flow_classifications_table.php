<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('flow_classifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->boolean('accepted_privacy')->nullable();
            $table->string('document_type')->nullable();
            $table->string('eps')->nullable();
            $table->string('regimen')->nullable();       // subsidiado | contributivo
            $table->string('service')->nullable();        // agendamiento | cancelacion | informacion | asesor
            $table->string('sub_service')->nullable();    // detalle (medicina especializada, etc.)
            // in_progress | self_service | advisor | rejected
            $table->string('outcome')->default('in_progress');
            $table->string('last_step')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->unique('conversation_id');
            $table->index('service');
            $table->index('eps');
            $table->index('regimen');
            $table->index('outcome');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('flow_classifications');
    }
};
