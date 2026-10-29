<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Mensajes ocultos para los asesores: respuestas automáticas de cita
     * (confirmar/cancelar del paciente y la respuesta del sistema). No deben
     * inundar la lista de "Conversaciones" ni aparecer en el hilo, pero se
     * conservan en la BD para auditoría y para los reportes de citas.
     */
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->boolean('is_hidden')->default(false)->index()->after('is_from_user');
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn('is_hidden');
        });
    }
};
