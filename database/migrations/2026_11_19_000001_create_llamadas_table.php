<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Llamadas de WhatsApp (Calling API de Meta). Una fila por llamada: quién llamó, en qué chat, quién contestó, cuánto
 * duró y cómo terminó. El SDP de la oferta (datos técnicos para conectar el audio) solo se guarda mientras timbra.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('llamadas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->nullable()->constrained()->nullOnDelete();
            $table->string('wa_call_id', 191)->unique();
            $table->string('direccion', 20)->default('entrante');
            // timbrando → conectando → en_curso → terminada; o perdida / rechazada / fallida
            $table->string('estado', 20)->default('timbrando');
            $table->string('telefono', 32)->nullable();
            // Hora en que el paciente llamó, según Meta (el aviso puede llegar tarde): de aquí cuenta el timbre.
            $table->timestamp('iniciada_en')->nullable();
            $table->mediumText('sdp_oferta')->nullable();
            $table->foreignId('atendida_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('contestada_en')->nullable();
            $table->timestamp('terminada_en')->nullable();
            $table->unsignedInteger('duracion')->nullable();
            $table->string('fin_meta', 30)->nullable();
            $table->string('motivo', 120)->nullable();
            $table->timestamps();
            $table->index(['estado', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('llamadas');
    }
};
