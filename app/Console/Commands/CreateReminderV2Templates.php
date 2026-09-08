<?php

namespace App\Console\Commands;

use App\Models\Setting;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * Crea en Meta las plantillas de recordatorio versión 2 (Cali y Cartago), idénticas a las
 * actuales pero con una línea nueva "Consultorio: {{6}}" entre Especialidad y Dirección.
 *
 * IMPORTANTE: NO toca las plantillas actuales (appointment_reminder / appointment_reminder_cartago).
 * Estas se crean aparte y el sistema las usará solo cuando se cambie el Setting correspondiente
 * (activación reversible). Con --dry-run solo muestra el cuerpo, no envía nada a Meta.
 */
class CreateReminderV2Templates extends Command
{
    protected $signature = 'templates:create-reminder-v2 {--dry-run : Muestra el cuerpo sin enviarlo a Meta}';
    protected $description = 'Crea appointment_reminder_v2 y appointment_reminder_cartago_v2 en Meta (agregan la línea Consultorio). No toca las plantillas actuales.';

    public function handle(): int
    {
        $token = Setting::get('whatsapp_token');
        $waba = Setting::get('whatsapp_business_account_id');
        if (!$token || !$waba) {
            $this->error('Falta whatsapp_token o whatsapp_business_account_id en configuración.');
            return 1;
        }

        // Direcciones EXACTAS de las plantillas vivas actuales (no se cambian).
        $templates = [
            ['name' => 'appointment_reminder_v2',         'direccion' => 'Calle 5 #36-08, barrio San Fernando.'],
            ['name' => 'appointment_reminder_cartago_v2', 'direccion' => 'Carrera 3b # 1a - 163, barrio Collarejo, Cartago.'],
        ];

        foreach ($templates as $t) {
            $body = "Estimado(a) {{1}}\n"
                . "Reciba un cordial saludo.\n"
                . "Le recordamos que tiene una cita médica programada en el Hospital Universitario del Valle, con los siguientes detalles:\n"
                . "Fecha: {{2}}\n"
                . "Hora: {{3}}\n"
                . "Médico: {{4}}\n"
                . "Especialidad: {{5}}\n"
                . "Consultorio: {{6}}\n"
                . "Dirección: {$t['direccion']}\n"
                . "Le solicitamos presentarse con 40 minutos de anticipación y portar su *documento de identificación, autorización de la eps, orden médica e historia clínica.*\n"
                . "Para cualquier inquietud o si necesita reprogramar su cita, por favor comuníquese con nosotros.\n"
                . "Atentamente,\n"
                . "Hospital Universitario del Valle";

            $components = [
                ['type' => 'HEADER', 'format' => 'TEXT', 'text' => 'Hospital Universitario del Valle'],
                [
                    'type' => 'BODY',
                    'text' => $body,
                    'example' => ['body_text' => [[
                        'Juan Pérez García',
                        'lunes 13 de enero de 2026',
                        '10:30 AM',
                        'Carlos Rodríguez López',
                        'Medicina General',
                        'G04 - GINECOLOGIA',
                    ]]],
                ],
                ['type' => 'BUTTONS', 'buttons' => [
                    ['type' => 'QUICK_REPLY', 'text' => 'Confirmar'],
                    ['type' => 'QUICK_REPLY', 'text' => 'Cancelar'],
                ]],
            ];

            $this->newLine();
            $this->info(str_repeat('=', 64));
            $this->info("PLANTILLA: {$t['name']}  (language=es_CO, category=MARKETING)");
            $this->info(str_repeat('=', 64));
            $this->line($body);

            if ($this->option('dry-run')) {
                $this->warn('  [DRY-RUN] No se envió a Meta.');
                continue;
            }

            $response = Http::withToken($token)->post(
                "https://graph.facebook.com/v21.0/{$waba}/message_templates",
                [
                    'name' => $t['name'],
                    'language' => 'es_CO',
                    'category' => 'MARKETING',
                    'components' => $components,
                ]
            );

            if (!$response->successful()) {
                $err = $response->json();
                $msg = $err['error']['message'] ?? 'Error desconocido';
                $userMsg = $err['error']['error_user_msg'] ?? '';
                $this->error("  ✗ Meta ({$response->status()}): {$msg}" . ($userMsg ? " — {$userMsg}" : ''));
                continue;
            }

            $data = $response->json();
            $this->info("  ✓ Enviada. id={$data['id']} | estado=" . ($data['status'] ?? 'PENDING'));
        }

        if (!$this->option('dry-run')) {
            $this->newLine();
            $this->line('Meta debe aprobarlas (minutos a horas). Verifica el estado con:');
            $this->line('  php artisan tinker → consultar message_templates');
            $this->line('Las plantillas actuales NO se tocaron; los recordatorios siguen igual hasta activar el cambio.');
        }

        return 0;
    }
}
