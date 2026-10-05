<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cuándo se asignó la conversación a su asesor actual.
 *
 * La liberación automática por inactividad cuenta el tiempo desde el último mensaje del
 * paciente sin respuesta, pero nunca desde antes de la asignación: si un asesor toma de la
 * bandeja un chat con un mensaje de hace 4 horas, el reloj empieza cuando lo toma, no
 * cuando el paciente escribió. Sin esta fecha, el chat se le quitaría al instante.
 *
 * Solo agrega una columna que admite vacío: no toca ni borra datos existentes. Las
 * conversaciones ya asignadas quedan con NULL y cuentan desde el mensaje del paciente.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('conversations', 'assigned_at')) {
            return;
        }

        Schema::table('conversations', function (Blueprint $table) {
            $table->timestamp('assigned_at')->nullable()->after('assigned_to');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('conversations', 'assigned_at')) {
            return;
        }

        Schema::table('conversations', function (Blueprint $table) {
            $table->dropColumn('assigned_at');
        });
    }
};
