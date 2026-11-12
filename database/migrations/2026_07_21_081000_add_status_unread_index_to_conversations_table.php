<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Índice compuesto para el contador de no leídos.
 *
 * HandleInertiaRequests::share() ejecuta en CADA request:
 *   WHERE status IN ('active','pending') AND unread_count > 0
 *
 * Sólo existían índices sueltos de status y de unread_count, así que MySQL usaba el de
 * unread_count (rango) y luego releía cada fila para filtrar por status — con la BD
 * mayormente fuera del buffer pool, esas relecturas iban a disco (~174 ms por request).
 *
 * (status, unread_count) resuelve ambas condiciones con un solo índice: igualdad en status
 * primero, rango en unread_count después.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->index(['status', 'unread_count'], 'conversations_status_unread_idx');
        });
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->dropIndex('conversations_status_unread_idx');
        });
    }
};
