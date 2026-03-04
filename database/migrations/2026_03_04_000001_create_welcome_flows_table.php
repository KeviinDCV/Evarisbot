<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('welcome_flows', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // Nombre del flujo (ej: "Menú de Bienvenida")
            $table->text('message'); // Mensaje de bienvenida
            $table->json('buttons')->nullable(); // Botones interactivos [{ id, title }]
            $table->json('responses')->nullable(); // Respuestas por botón { button_id: response_text }
            $table->boolean('is_active')->default(false); // Toggle activar/desactivar
            $table->enum('trigger_type', ['first_contact', 'every_new_conversation', 'always'])->default('first_contact');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('welcome_flows');
    }
};
