<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Agregar columna de parámetros dinámicos por destinatario
        Schema::table('bulk_send_recipients', function (Blueprint $table) {
            $table->json('params')->nullable()->after('contact_name');
        });

        // Agregar plantilla de cancelación de cita
        DB::table('whatsapp_templates')->insert([
            'name' => 'Cancelación de Cita',
            'meta_template_name' => 'cancelacion_cita',
            'preview_text' => 'Estimado/a paciente, {{1}}. Le informamos que su cita médica programada para el {{2}} a las {{3}} ha sido cancelada...',
            'language' => 'es_CO',
            'default_params' => json_encode([
                ['key' => 'nombre', 'label' => 'Nombre del paciente', 'from_column' => 'nombre'],
                ['key' => 'fecha', 'label' => 'Fecha de la cita', 'from_column' => 'fecha'],
                ['key' => 'hora', 'label' => 'Hora de la cita', 'from_column' => 'hora'],
            ]),
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::table('bulk_send_recipients', function (Blueprint $table) {
            $table->dropColumn('params');
        });

        DB::table('whatsapp_templates')->where('meta_template_name', 'cancelacion_cita')->delete();
    }
};
