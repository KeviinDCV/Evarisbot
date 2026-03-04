<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Evolucionar welcome_flows para soportar pasos encadenados
        // Cada "step" es un nodo del flujo con su propio mensaje y botones
        Schema::create('welcome_flow_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('welcome_flow_id')->constrained('welcome_flows')->cascadeOnDelete();
            $table->string('step_key')->index(); // Identificador único del paso (ej: "welcome", "document_type", "document_number")
            $table->integer('order')->default(0); // Orden visual
            $table->text('message'); // Mensaje que se envía en este paso
            $table->enum('message_type', ['interactive_buttons', 'interactive_list', 'text', 'wait_response'])->default('interactive_buttons');
            // interactive_buttons = mensaje con botones
            // text = solo texto (sin botones)
            // wait_response = espera texto libre del usuario (ej: número de documento)
            $table->json('buttons')->nullable(); // Botones [{ id, title }] - máx 3 para buttons
            $table->json('options')->nullable(); // Para list: sections con opciones
            $table->json('next_steps')->nullable(); // Mapeo { button_id: "step_key" } - qué paso sigue al presionar cada botón
            $table->string('next_step_on_text')->nullable(); // Para wait_response: qué step sigue después de recibir texto libre
            $table->text('fallback_message')->nullable(); // Mensaje si la respuesta no es válida
            $table->boolean('is_entry_point')->default(false); // Es el primer paso del flujo?
            $table->timestamps();

            $table->unique(['welcome_flow_id', 'step_key']);
        });

        // Trackear en qué paso del flujo se encuentra cada conversación
        Schema::table('conversations', function (Blueprint $table) {
            $table->string('welcome_flow_step')->nullable()->after('notes'); // step_key actual
            $table->boolean('welcome_flow_completed')->default(false)->after('welcome_flow_step'); // Si ya completó el flujo
            $table->json('welcome_flow_data')->nullable()->after('welcome_flow_completed'); // Datos recolectados (tipo doc, número, etc.)
        });
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->dropColumn(['welcome_flow_step', 'welcome_flow_completed', 'welcome_flow_data']);
        });
        Schema::dropIfExists('welcome_flow_steps');
    }
};
