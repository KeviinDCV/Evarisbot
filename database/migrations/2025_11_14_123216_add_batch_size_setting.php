<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Agregar configuración de tamaño de lote/batch
        DB::table('settings')->insert([
            [
                'key' => 'reminder_batch_size',
                'value' => '10',
                'is_encrypted' => false,
                'description' => 'Número de recordatorios a enviar por lote/tanda antes de pausar',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'key' => 'reminder_batch_pause_seconds',
                'value' => '5',
                'is_encrypted' => false,
                'description' => 'Segundos de pausa entre cada lote/tanda de recordatorios',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('settings')->whereIn('key', [
            'reminder_batch_size',
            'reminder_batch_pause_seconds',
        ])->delete();
    }
};
