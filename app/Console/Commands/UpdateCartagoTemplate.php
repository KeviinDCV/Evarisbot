<?php

namespace App\Console\Commands;

use App\Models\Setting;
use App\Models\WhatsappTemplate;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class UpdateCartagoTemplate extends Command
{
    protected $signature = 'templates:update-cartago';
    protected $description = 'Actualizar plantilla reprogramacion_cartago para quitar la variable de especialidad (queda con 5 parámetros)';

    public function handle()
    {
        $token = Setting::get('whatsapp_token');
        if (!$token) {
            $this->error('WhatsApp API no configurada.');
            return 1;
        }

        $tpl = WhatsappTemplate::where('meta_template_name', 'reprogramacion_cartago')->first();
        if (!$tpl || !$tpl->meta_template_id) {
            $this->error('No se encontró la plantilla reprogramacion_cartago con meta_template_id.');
            return 1;
        }

        $newBody = "Buen día,\nCordial saludo, SR(A) {{1}}\nSe escribe del HOSPITAL UNIVERSITARIO DEL VALLE EVARISTO GARCIA con el fin de informar que la cita del día {{2}} SE CANCELA Y SE REPROGRAMA PARA EL DIA {{3}} a las {{4}} con el DR.(A) {{5}} SEDE CARTAGO Carrera 3b # 1a - 163 Barrio Collarejo traer autorización vigente, orden médica, historia clínica llegar 40 minutos antes de la consulta para facturar.";

        $examples = ['Juan Pérez', '10 de abril de 2026', '20 de abril de 2026', '10:00 AM', 'García'];

        $components = [[
            'type' => 'BODY',
            'text' => $newBody,
            'example' => ['body_text' => [$examples]],
        ]];

        $this->info("Actualizando plantilla en Meta (ID: {$tpl->meta_template_id})...");

        try {
            $response = Http::withToken($token)
                ->post("https://graph.facebook.com/v21.0/{$tpl->meta_template_id}", [
                    'components' => $components,
                ]);

            if (!$response->successful()) {
                $err = $response->json();
                $msg = $err['error']['message'] ?? 'Error desconocido';
                $userMsg = $err['error']['error_user_msg'] ?? '';
                $this->error("✗ Meta: {$msg}" . ($userMsg ? " — {$userMsg}" : ''));
                return 1;
            }

            $tpl->update([
                'preview_text' => $newBody,
                'default_params' => array_fill(0, 5, ''),
                'status' => 'PENDING',
            ]);

            $this->info("✓ Plantilla actualizada. Meta debe re-aprobar el cambio (status: PENDING).");
            $this->info("  Espera la aprobación para volver a enviar campañas con esta plantilla.");
            return 0;
        } catch (\Exception $e) {
            $this->error("✗ " . $e->getMessage());
            return 1;
        }
    }
}
