<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $settings = [
            [
                'key' => 'reminder_days_in_advance',
                'value' => '2',
                'is_encrypted' => false,
                'description' => 'Días de anticipación para enviar recordatorios (recomendado: 2 días)',
                'updated_by' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'key' => 'reminder_enabled',
                'value' => 'true',
                'is_encrypted' => false,
                'description' => 'Activar/desactivar envío automático de recordatorios',
                'updated_by' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'key' => 'reminder_max_per_day',
                'value' => '500',
                'is_encrypted' => false,
                'description' => 'Máximo de recordatorios a enviar por día (respeta límites de Meta)',
                'updated_by' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'key' => 'reminder_template_name',
                'value' => 'appointment_reminder',
                'is_encrypted' => false,
                'description' => 'Nombre del template de WhatsApp para recordatorios',
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
        DB::table('settings')->whereIn('key', [
            'reminder_days_in_advance',
            'reminder_enabled',
            'reminder_max_per_day',
            'reminder_template_name',
        ])->delete();
    }
};
