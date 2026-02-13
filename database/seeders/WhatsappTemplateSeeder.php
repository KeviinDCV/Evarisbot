<?php

namespace Database\Seeders;

use App\Models\WhatsappTemplate;
use Illuminate\Database\Seeder;

class WhatsappTemplateSeeder extends Seeder
{
    public function run(): void
    {
        WhatsappTemplate::updateOrCreate(
            ['meta_template_name' => 'nuevo_contrato_policia'],
            [
                'name' => 'Nuevo contrato Policía - HUV',
                'preview_text' => 'SR. USUARIO EL HUV INFORMA DESDE 20.02.2026 INICIA NUEVO CONTRATO CON LA POLICIA PARA GARANTIZAR SU ATENCIÓN DEBE SOLICITAR NUEVO AUTORIZACIÓN EN FATIMA.',
                'language' => 'es_CO',
                'default_params' => null,
                'is_active' => true,
            ]
        );
    }
}
