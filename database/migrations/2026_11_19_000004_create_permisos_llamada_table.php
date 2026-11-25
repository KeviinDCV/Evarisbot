<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Permiso de cada paciente para recibir RECORDATORIOS DE CITA POR LLAMADA (voz automática). Pedido del 19/11/2026: se
 * llama solo a quien aceptó. Es un registro histórico (nunca se borra ni se edita una fila): cada cambio es una fila
 * nueva y vale la más reciente de cada número. Sirve de soporte de la autorización (Ley 1581 de 2012).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('permisos_llamada', function (Blueprint $table) {
            $table->id();
            $table->string('telefono', 20); // solo dígitos, con indicativo
            // true = aceptó; false = no aceptó o lo quitó; null = se le preguntó y aún no responde
            $table->boolean('acepta')->nullable();
            // whatsapp (botón), asesor (lo marcó un asesor), no_llamar (escribió NO LLAMAR), meta (permiso de WhatsApp),
            // pregunta (se le hizo la pregunta)
            $table->string('canal', 20);
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('conversation_id')->nullable()->constrained()->nullOnDelete();
            $table->string('nota', 255)->nullable();
            $table->timestamps();
            $table->index(['telefono', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('permisos_llamada');
    }
};
