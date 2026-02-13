<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Skip if settings table doesn't exist yet (will be seeded later)
        if (!Schema::hasTable('settings')) {
            return;
        }

        $settings = [
            [
                'key' => 'reminder_paused',
                'value' => 'false',
                'is_encrypted' => false,
                'description' => 'Estado de pausa del envío de recordatorios',
                'updated_by' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'key' => 'reminder_processing',
                'value' => 'false',
                'is_encrypted' => false,
                'description' => 'Indica si hay un proceso de envío de recordatorios en curso',
                'updated_by' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'key' => 'reminder_messages_per_minute',
                'value' => '20',
                'is_encrypted' => false,
                'description' => 'Mensajes por minuto para respetar límites de Meta (recomendado: 20 para Tier 1)',
                'updated_by' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ];

        foreach ($settings as $setting) {
            DB::table('settings')->updateOrInsert(
                ['key' => $setting['key']],
                $setting
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (!Schema::hasTable('settings')) {
            return;
        }

        DB::table('settings')->whereIn('key', [
            'reminder_paused',
            'reminder_processing',
            'reminder_messages_per_minute'
        ])->delete();
    }
};

