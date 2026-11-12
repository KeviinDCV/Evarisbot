<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Índices de COBERTURA para los contadores de la página de Citas.
 *
 * Las métricas ejecutan COUNT(*) filtrando por (service, reminder_sent) y por
 * (service, reminder_status). Con índices que cubren exactamente esas columnas, MySQL
 * resuelve el conteo leyendo SÓLO el índice (index-only scan), sin tocar las filas.
 *
 * Medido antes: 832 ms y 519 ms sobre ~100k filas.
 *
 * Nota: se probó sustituir ambos COUNT por un único SUM(condición) "de una pasada" y
 * resultó 2,5x MÁS LENTO (3.418 ms), porque SUM(expresión) obliga a leer las filas
 * completas y pierde el index-only scan. Por eso el arreglo son índices, no reescribir.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->index(['service', 'reminder_sent'], 'appointments_service_sent_idx');
            $table->index(['service', 'reminder_status'], 'appointments_service_status_idx');
        });
    }

    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropIndex('appointments_service_sent_idx');
            $table->dropIndex('appointments_service_status_idx');
        });
    }
};
