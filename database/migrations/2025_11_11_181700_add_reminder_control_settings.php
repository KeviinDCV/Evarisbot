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
        // Usar Settings existente en lugar de crear tabla nueva
        DB::table('settings')->insert([
            [
                'key' => 'reminders_enabled',
                'value' => 'false',
                'is_encrypted' => false,
                'description' => 'Control si el envío automático de recordatorios está activo',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'key' => 'reminders_rate_limit',
                'value' => '20',
                'is_encrypted' => false,
                'description' => 'Máximo de mensajes por minuto (recomendado: 20-40)',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'key' => 'reminders_batch_size',
                'value' => '50',
                'is_encrypted' => false,
                'description' => 'Cantidad de recordatorios por lote',
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
        DB::table('settings')
            ->whereIn('key', ['reminders_enabled', 'reminders_rate_limit', 'reminders_batch_size'])
            ->delete();
    }
};
