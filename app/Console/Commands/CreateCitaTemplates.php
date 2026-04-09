<?php

namespace App\Console\Commands;

use App\Models\Setting;
use App\Models\WhatsappTemplate;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class CreateCitaTemplates extends Command
{
    protected $signature = 'templates:create-citas';
    protected $description = 'Crear las 5 plantillas de citas en Meta WhatsApp API';

    public function handle()
    {
        $businessAccountId = Setting::get('whatsapp_business_account_id');
        $token = Setting::get('whatsapp_token');

        if (!$businessAccountId || !$token) {
            $this->error('WhatsApp API no configurada.');
            return 1;
        }

        $templates = [
            [
                'name' => 'programacion_cita_pendiente',
                'display_name' => 'Programación de cita pendiente',
                'body' => "Buen día,\nCordial saludo, SR(A) {{1}}\nSe escribe del HOSPITAL UNIVERSITARIO DEL VALLE EVARISTO GARCIA con el fin de informar que la cita DE {{2}} que estaba pendiente queda programada para el día {{3}} con el Dr. {{4}} a las {{5}} SEDE PRINCIPAL DEL HOSPITAL calle 5 #36-08 san fernando traer autorizacion vigente, orden medica, historia clinica llegar 40 minutos antes de la consulta para facturar.",
                'examples' => ['Juan Pérez', 'Cardiología', '15 de abril de 2026', 'García', '10:00 AM'],
            ],
            [
                'name' => 'cambio_horario_cita',
                'display_name' => 'Cambio de horario de la cita',
                'body' => "Buen día,\nCordial saludo, SR(A) {{1}}\nSe escribe del HOSPITAL UNIVERSITARIO DEL VALLE EVARISTO GARCIA con el fin de informar que la cita de {{2}} del día {{3}} SE MODIFICA DE HORARIO para las {{4}} con el DR.(A) {{5}} EN LA SEDE PRINCIPAL DEL HOSPITAL calle 5 #36-08 san Fernando traer autorización vigente, orden medica, historia clínica llegar 40 minutos antes de la consulta para facturar.",
                'examples' => ['Juan Pérez', 'Cardiología', '15 de abril de 2026', '2:00 PM', 'García'],
            ],
            [
                'name' => 'cancelacion_cita',
                'display_name' => 'Cancelación de cita',
                'body' => "Buen día,\nCordial saludo, SR(A) {{1}}\nSe escribe del HOSPITAL UNIVERSITARIO DEL VALLE EVARISTO GARCIA con el fin de informar que la cita de {{2}} del día {{3}} con el DR.(A) {{4}} queda CANCELADA Y PENDIENTE DE REPROGRAMAR. POR FAVOR ESTAR PENDIENTE A LOS NÚMEROS DE TELEFONO YA QUE ESTAREMOS LLAMANDO.",
                'examples' => ['Juan Pérez', 'Cardiología', '15 de abril de 2026', 'García'],
            ],
            [
                'name' => 'reprogramacion_cita',
                'display_name' => 'Reprogramación de cita',
                'body' => "Buen día,\nCordial saludo, SR(A) {{1}}\nSe escribe del HOSPITAL UNIVERSITARIO DEL VALLE EVARISTO GARCIA con el fin de informar que la cita DE {{2}} del día {{3}} SE CANCELA Y SE REPROGRAMA PARA EL DIA {{4}} a las {{5}} con el DR.(A) {{6}} SEDE PRINCIPAL DEL HOSPITAL calle 5 #36-08 San Fernando traer autorización vigente, orden médica, historia clínica llegar 40 minutos antes de la consulta para facturar.",
                'examples' => ['Juan Pérez', 'Cardiología', '10 de abril de 2026', '20 de abril de 2026', '10:00 AM', 'García'],
            ],
            [
                'name' => 'adelanto_cita',
                'display_name' => 'Adelanto de cita',
                'body' => "Buen día,\nCordial saludo, SR(A) {{1}}\nSe escribe del HOSPITAL UNIVERSITARIO DEL VALLE EVARISTO GARCIA con el fin de informar que la cita DE {{2}} DEL día {{3}} SE ADELANTA para el {{4}} a las {{5}} con el DR.(A) {{6}} EN LA SEDE PRINCIPAL DEL HOSPITAL calle 5 #36-08 san Fernando, traer autorización vigente, orden médica, historia clínica llegar 40 minutos antes de la consulta para facturar.",
                'examples' => ['Juan Pérez', 'Cardiología', '20 de abril de 2026', '15 de abril de 2026', '10:00 AM', 'García'],
            ],
        ];

        foreach ($templates as $i => $tpl) {
            $num = $i + 1;
            $this->info("{$num}/5 — {$tpl['display_name']}");

            if (WhatsappTemplate::where('meta_template_name', $tpl['name'])->exists()) {
                $this->warn("  Ya existe localmente, saltando.");
                continue;
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

                    $this->info("  ✓ Enviada (ID: " . ($data['id'] ?? 'N/A') . ", Status: " . ($data['status'] ?? 'PENDING') . ")");
                } else {
                    $err = $response->json();
                    $msg = $err['error']['message'] ?? 'Error desconocido';
                    $userMsg = $err['error']['error_user_msg'] ?? '';
                    $this->error("  ✗ {$msg}" . ($userMsg ? " — {$userMsg}" : ''));
                }
            } catch (\Exception $e) {
                $this->error("  ✗ " . $e->getMessage());
            }
        }

        $this->newLine();
        $this->info('Proceso completado. Sincronice desde Envíos Masivos para actualizar estados.');

        return 0;
    }
}
