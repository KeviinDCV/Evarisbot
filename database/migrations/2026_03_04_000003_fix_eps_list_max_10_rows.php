<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Actualizar el paso de EPS para que tenga máximo 10 opciones (límite de WhatsApp)
        // Se eliminaron ARL, AIC, COMFACHOCO, FOMAG, POLICIA (menos comunes)
        // Se consolidó en 1 sola sección y se quitaron descriptions vacías
        DB::table('welcome_flow_steps')
            ->where('step_key', 'eps_selection')
            ->update([
                'options' => json_encode([
                    'button_text' => 'Seleccionar EPS',
                    'sections' => [
                        [
                            'title' => 'EPS Disponibles',
                            'rows' => [
                                ['id' => 'eps_nueva_eps', 'title' => 'NUEVA EPS'],
                                ['id' => 'eps_coosalud', 'title' => 'COOSALUD'],
                                ['id' => 'eps_emssanar', 'title' => 'EMSSANAR'],
                                ['id' => 'eps_sura', 'title' => 'SURA'],
                                ['id' => 'eps_sanitas', 'title' => 'SANITAS'],
                                ['id' => 'eps_salud_total', 'title' => 'SALUD TOTAL'],
                                ['id' => 'eps_comfenalco', 'title' => 'COMFENALCO'],
                                ['id' => 'eps_famisanar', 'title' => 'FAMISANAR'],
                                ['id' => 'eps_sos', 'title' => 'SOS'],
                                ['id' => 'eps_otro', 'title' => 'Otro'],
                            ],
                        ],
                    ],
                ]),
                'next_steps' => json_encode([
                    'eps_nueva_eps' => 'regimen',
                    'eps_coosalud' => 'regimen',
                    'eps_emssanar' => 'regimen',
                    'eps_sura' => 'regimen',
                    'eps_sanitas' => 'regimen',
                    'eps_salud_total' => 'regimen',
                    'eps_comfenalco' => 'regimen',
                    'eps_famisanar' => 'regimen',
                    'eps_sos' => 'regimen',
                    'eps_otro' => 'regimen',
                ]),
            ]);
    }

    public function down(): void
    {
        // Restaurar las 15 opciones originales
        DB::table('welcome_flow_steps')
            ->where('step_key', 'eps_selection')
            ->update([
                'options' => json_encode([
                    'button_text' => 'Seleccionar EPS',
                    'sections' => [
                        [
                            'title' => 'EPS',
                            'rows' => [
                                ['id' => 'eps_arl', 'title' => 'ARL', 'description' => ''],
                                ['id' => 'eps_aic', 'title' => 'AIC', 'description' => ''],
                                ['id' => 'eps_coosalud', 'title' => 'COOSALUD', 'description' => ''],
                                ['id' => 'eps_comfenalco', 'title' => 'COMFENALCO', 'description' => ''],
                                ['id' => 'eps_comfachoco', 'title' => 'COMFACHOCO', 'description' => ''],
                                ['id' => 'eps_emssanar', 'title' => 'EMSSANAR', 'description' => ''],
                                ['id' => 'eps_fomag', 'title' => 'FOMAG', 'description' => ''],
                                ['id' => 'eps_famisanar', 'title' => 'FAMISANAR', 'description' => ''],
                                ['id' => 'eps_nueva_eps', 'title' => 'NUEVA EPS', 'description' => ''],
                                ['id' => 'eps_sos', 'title' => 'SOS', 'description' => ''],
                            ],
                        ],
                        [
                            'title' => 'Más opciones',
                            'rows' => [
                                ['id' => 'eps_sura', 'title' => 'SURA', 'description' => ''],
                                ['id' => 'eps_salud_total', 'title' => 'SALUD TOTAL', 'description' => ''],
                                ['id' => 'eps_sanitas', 'title' => 'SANITAS', 'description' => ''],
                                ['id' => 'eps_policia', 'title' => 'POLICIA', 'description' => ''],
                                ['id' => 'eps_otro', 'title' => 'Otro', 'description' => ''],
                            ],
                        ],
                    ],
                ]),
                'next_steps' => json_encode([
                    'eps_arl' => 'regimen',
                    'eps_aic' => 'regimen',
                    'eps_coosalud' => 'regimen',
                    'eps_comfenalco' => 'regimen',
                    'eps_comfachoco' => 'regimen',
                    'eps_emssanar' => 'regimen',
                    'eps_fomag' => 'regimen',
                    'eps_famisanar' => 'regimen',
                    'eps_nueva_eps' => 'regimen',
                    'eps_sos' => 'regimen',
                    'eps_sura' => 'regimen',
                    'eps_salud_total' => 'regimen',
                    'eps_sanitas' => 'regimen',
                    'eps_policia' => 'regimen',
                    'eps_otro' => 'regimen',
                ]),
            ]);
    }
};
