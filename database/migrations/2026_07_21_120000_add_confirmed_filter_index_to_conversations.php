<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Índice para el filtro "Confirmados".
 *
 * Ese filtro busca las confirmaciones de cita que el sistema auto-resolvió:
 *   WHERE status = 'resolved' AND resolved_by IS NULL  ORDER BY resolved_at DESC
 *
 * Sin índice tardaba 1.792 ms (escaneando ~51k conversaciones). El índice compuesto
 * cubre el WHERE y además da el ORDER BY ya ordenado, evitando el filesort.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->index(['status', 'resolved_by', 'resolved_at'], 'conversations_status_resolvedby_idx');
        });
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->dropIndex('conversations_status_resolvedby_idx');
        });
    }
};
