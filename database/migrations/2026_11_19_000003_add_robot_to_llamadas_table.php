<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Llamadas que hace el robot (recordatorios de cita por voz): de qué cita es, qué tecla marcó el paciente y qué pasó
 * con la cita. «origen» separa las del robot de las que hace o contesta un asesor.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('llamadas', function (Blueprint $table) {
            $table->string('origen', 10)->default('asesor')->after('direccion');
            $table->unsignedBigInteger('cita_id')->nullable()->after('conversation_id');
            $table->string('tecla', 5)->nullable()->after('motivo');
            $table->string('resultado_robot', 30)->nullable()->after('tecla');
            $table->index(['origen', 'created_at']);
            $table->index('cita_id');
        });
    }

    public function down(): void
    {
        Schema::table('llamadas', function (Blueprint $table) {
            $table->dropIndex(['origen', 'created_at']);
            $table->dropIndex(['cita_id']);
            $table->dropColumn(['origen', 'cita_id', 'tecla', 'resultado_robot']);
        });
    }
};
