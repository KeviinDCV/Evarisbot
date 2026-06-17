<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Métricas de uso de la validación de cédulas (para reportes que justifiquen el feature).
 * IMPORTANTE: NO se guarda la cédula ni el nombre (minimización de datos / Habeas Data),
 * solo quién consultó, en qué chat, con qué proveedor, el resultado y cuándo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cedula_validation_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();          // asesor que disparó la consulta
            $table->unsignedBigInteger('internal_chat_id')->nullable(); // chat donde ocurrió
            $table->string('provider', 20);                             // didit | verifik
            $table->string('outcome', 20);                              // found | not_found | error
            $table->timestamp('created_at')->nullable();

            $table->index('created_at');
            $table->index('outcome');
            $table->index('provider');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cedula_validation_logs');
    }
};
