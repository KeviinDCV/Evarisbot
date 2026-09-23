<?php

namespace App\Console\Commands;

use App\Models\Setting;
use App\Models\WhatsappTemplate;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * Crea en Meta la plantilla de recordatorio para la sede CARTAGO, idéntica a la de Cali
 * (appointment_reminder) salvo la dirección. El servicio de recordatorios la usa
 * automáticamente cuando el código citcon de la cita empieza por "W".
 */
class CreateReminderCartagoTemplate extends Command
{
    protected $signature = 'templates:create-reminder-cartago';
    protected $description = 'Crea la plantilla appointment_reminder_cartago en Meta (recordatorio sede Cartago)';

    public function handle()
    {
        $token = Setting::get('whatsapp_token');
        $waba = Setting::get('whatsapp_business_account_id');
        if (!$token || !$waba) {
            $this->error('Falta whatsapp_token o whatsapp_business_account_id en configuración.');
            return 1;
        }

        $body = "Estimado(a) {{1}}\n"
            . "Reciba un cordial saludo.\n"
            . "Le recordamos que tiene una cita médica programada en el Hospital Universitario del Valle, con los siguientes detalles:\n"
            . "Fecha: {{2}}\n"
            . "Hora: {{3}}\n"
            . "Médico: {{4}}\n"
            . "Especialidad: {{5}}\n"
            . "Dirección: Carrera 3b # 1a - 163, barrio Collarejo, Cartago.\n"
            . "Le solicitamos presentarse con 40 minutos de anticipación y portar su *documento de identificación, autorización de la eps, orden médica e historia clínica.*\n"
            . "Para cualquier inquietud o si necesita reprogramar su cita, por favor comuníquese con nosotros.\n"
            . "Atentamente,\n"
            . "Hospital Universitario del Valle";

        $components = [
            ['type' => 'HEADER', 'format' => 'TEXT', 'text' => 'Hospital Universitario del Valle'],
            [
                'type' => 'BODY',
                'text' => $body,
                'example' => ['body_text' => [['Juan Pérez García', 'lunes 13 de enero de 2026', '10:30 AM', 'Carlos Rodríguez López', 'Medicina General']]],
            ],
            ['type' => 'BUTTONS', 'buttons' => [
                ['type' => 'QUICK_REPLY', 'text' => 'Confirmar'],
                ['type' => 'QUICK_REPLY', 'text' => 'Cancelar'],
            ]],
        ];

        $this->info('Enviando plantilla appointment_reminder_cartago a Meta...');

        try {
            $response = Http::withToken($token)->post("https://graph.facebook.com/v21.0/{$waba}/message_templates", [
                'name' => 'appointment_reminder_cartago',
                'language' => 'es_CO',
                'category' => 'MARKETING',
                'components' => $components,
            ]);

            if (!$response->successful()) {
                $err = $response->json();
                $msg = $err['error']['message'] ?? 'Error desconocido';
                $userMsg = $err['error']['error_user_msg'] ?? '';
                $this->error("✗ Meta: {$msg}" . ($userMsg ? " — {$userMsg}" : ''));
                return 1;
            }

            $data = $response->json();

            WhatsappTemplate::updateOrCreate(
                ['meta_template_name' => 'appointment_reminder_cartago'],
                [
                    'name' => 'Recordatorio de cita (Cartago)',
                    'preview_text' => $body,
                    'language' => 'es_CO',
                    'category' => 'MARKETING',
                    'status' => strtoupper($data['status'] ?? 'PENDING'),
                    'meta_template_id' => $data['id'] ?? null,
                    'header_text' => 'Hospital Universitario del Valle',
                    'header_format' => 'TEXT',
                    'default_params' => array_fill(0, 5, ''),
                    'is_active' => true,
                ]
            );

            Setting::set('reminder_template_name_cartago', 'appointment_reminder_cartago');

            $this->info("✓ Plantilla enviada (estado: " . ($data['status'] ?? 'PENDING') . ").");
            $this->line('  Meta debe aprobarla (suele tardar minutos). El recordatorio de Cartago empezará a');
            $this->line('  funcionar automáticamente para las citas con citcon que empiezan por "W".');

            return 0;
        } catch (\Exception $e) {
            $this->error('✗ ' . $e->getMessage());
            return 1;
        }
    }
}
