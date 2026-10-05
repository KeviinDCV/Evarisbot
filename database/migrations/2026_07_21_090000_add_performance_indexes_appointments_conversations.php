<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Índices para las dos consultas más lentas medidas en producción.
 *
 * 1) appointments (service, citfc, reminder_sent): los contadores de recordatorios de la
 *    página de Citas filtran por esas tres columnas. Medido: 1.941 ms + 1.808 ms por
 *    consulta sobre ~100k filas. Junto con quitar el DATE(citfc) que anulaba el índice,
 *    esto es lo que hacía que la petición diferida tardara 4,3 s.
 *
 * 2) conversations (specialty): la lista de conversaciones agrupa por especialidad
 *    (SELECT specialty, COUNT(*) ... GROUP BY specialty). Sin índice escaneaba las ~51k
 *    filas. Medido: 763 ms de los 1.134 ms de /admin/chat.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->index(['service', 'citfc', 'reminder_sent'], 'appointments_service_citfc_sent_idx');
        });

        Schema::table('conversations', function (Blueprint $table) {
            $table->index('specialty', 'conversations_specialty_idx');
        });
    }

    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropIndex('appointments_service_citfc_sent_idx');
        });

        Schema::table('conversations', function (Blueprint $table) {
            $table->dropIndex('conversations_specialty_idx');
        });
    }
};
