<?php

namespace App\Console\Commands;

use App\Models\Setting;
use App\Models\WhatsappTemplate;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class CreateCartagoTemplate extends Command
{
    protected $signature = 'templates:create-cartago';
    protected $description = 'Crear plantilla de reprogramación de cita para sede Cartago en Meta WhatsApp API';

    public function handle()
    {
        $businessAccountId = Setting::get('whatsapp_business_account_id');
        $token = Setting::get('whatsapp_token');

        if (!$businessAccountId || !$token) {
            $this->error('WhatsApp API no configurada.');
            return 1;
        }

        $tpl = [
            'name' => 'reprogramacion_cartago',
            'display_name' => 'Reprogramación de cita (Cartago)',
            'body' => "Buen día,\nCordial saludo, SR(A) {{1}}\nSe escribe del HOSPITAL UNIVERSITARIO DEL VALLE EVARISTO GARCIA con el fin de informar que la cita DE {{2}} del día {{3}} SE CANCELA Y SE REPROGRAMA PARA EL DIA {{4}} a las {{5}} con el DR.(A) {{6}} SEDE CARTAGO Carrera 3b # 1a - 163 Barrio Collarejo traer autorización vigente, orden médica, historia clínica llegar 40 minutos antes de la consulta para facturar.",
            'examples' => ['Juan Pérez', 'Cardiología', '10 de abril de 2026', '20 de abril de 2026', '10:00 AM', 'García'],
        ];

        $this->info("Creando plantilla: {$tpl['display_name']}");

        if (WhatsappTemplate::where('meta_template_name', $tpl['name'])->exists()) {
            $this->warn("Ya existe localmente.");
            return 0;
        }

        $components = [
            [
                'type' => 'BODY',
                'text' => $tpl['body'],
                'example' => [
                    'body_text' => [$tpl['examples']],
                ],
            ],
        ];

        try {
            $response = Http::withToken($token)
                ->post("https://graph.facebook.com/v21.0/{$businessAccountId}/message_templates", [
                    'name' => $tpl['name'],
                    'category' => 'UTILITY',
                    'language' => 'es',
                    'components' => $components,
                ]);

            if ($response->successful()) {
                $data = $response->json();

                WhatsappTemplate::create([
                    'name' => $tpl['display_name'],
                    'meta_template_name' => $tpl['name'],
                    'preview_text' => $tpl['body'],
                    'language' => 'es',
                    'category' => 'UTILITY',
                    'status' => $data['status'] ?? 'PENDING',
                    'meta_template_id' => $data['id'] ?? null,
                    'default_params' => array_fill(0, count($tpl['examples']), ''),
                    'is_active' => false,
                ]);

                $this->info("✓ Enviada a Meta (ID: " . ($data['id'] ?? 'N/A') . ", Status: " . ($data['status'] ?? 'PENDING') . ")");
                return 0;
            }

            $err = $response->json();
            $msg = $err['error']['message'] ?? 'Error desconocido';
            $userMsg = $err['error']['error_user_msg'] ?? '';
            $this->error("✗ {$msg}" . ($userMsg ? " — {$userMsg}" : ''));
            return 1;
        } catch (\Exception $e) {
            $this->error("✗ " . $e->getMessage());
            return 1;
        }
    }
}
