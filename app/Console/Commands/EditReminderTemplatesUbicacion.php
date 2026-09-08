<?php

namespace App\Console\Commands;

use App\Models\Setting;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * Edita las plantillas ORIGINALES de recordatorio (appointment_reminder y
 * appointment_reminder_cartago) para agregar la línea "Ubicación: {{6}}" entre
 * Especialidad y Dirección. Meta las vuelve a revisar (la versión aprobada anterior
 * sigue activa mientras tanto). NO toca las plantillas _v2 que están en uso ahora,
 * así que los recordatorios siguen saliendo sin interrupción.
 *
 * Con --dry-run solo muestra el cuerpo, no envía nada a Meta.
 */
class EditReminderTemplatesUbicacion extends Command
{
    protected $signature = 'templates:edit-reminders-ubicacion {--dry-run : Muestra el cuerpo sin enviarlo a Meta}';
    protected $description = 'Edita las plantillas reales de recordatorio agregando "Ubicación: {{6}}" (requiere re-aprobación de Meta).';

    public function handle(): int
    {
        $token = Setting::get('whatsapp_token');
        $waba = Setting::get('whatsapp_business_account_id');
        if (!$token || !$waba) {
            $this->error('Falta whatsapp_token o whatsapp_business_account_id.');
            return 1;
        }

        // Resolver los IDs actuales de las plantillas originales por nombre.
        $resp = Http::withToken($token)->get(
            "https://graph.facebook.com/v21.0/{$waba}/message_templates",
            ['fields' => 'name,id,status', 'limit' => 250]
        );
        $idByName = [];
        foreach (($resp->json()['data'] ?? []) as $t) {
            $idByName[$t['name']] = ['id' => $t['id'], 'status' => $t['status']];
        }

        $targets = [
            ['name' => 'appointment_reminder',         'direccion' => 'Calle 5 #36-08, barrio San Fernando.'],
            ['name' => 'appointment_reminder_cartago', 'direccion' => 'Carrera 3b # 1a - 163, barrio Collarejo, Cartago.'],
        ];

        foreach ($targets as $t) {
            $meta = $idByName[$t['name']] ?? null;
            if (!$meta) {
                $this->error("No se encontró la plantilla {$t['name']} en Meta.");
                continue;
            }

            $body = "Estimado(a) {{1}}\n"
                . "Reciba un cordial saludo.\n"
                . "Le recordamos que tiene una cita médica programada en el Hospital Universitario del Valle, con los siguientes detalles:\n"
                . "Fecha: {{2}}\n"
                . "Hora: {{3}}\n"
                . "Médico: {{4}}\n"
                . "Especialidad: {{5}}\n"
                . "Ubicación: {{6}}\n"
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
                        'MEDICINA GENERAL - M01',
                    ]]],
                ],
                ['type' => 'BUTTONS', 'buttons' => [
                    ['type' => 'QUICK_REPLY', 'text' => 'Confirmar'],
                    ['type' => 'QUICK_REPLY', 'text' => 'Cancelar'],
                ]],
            ];

            $this->newLine();
            $this->info(str_repeat('=', 64));
            $this->info("EDITAR: {$t['name']}  (id={$meta['id']}, estado actual={$meta['status']})");
            $this->info(str_repeat('=', 64));
            $this->line($body);

            if ($this->option('dry-run')) {
                $this->warn('  [DRY-RUN] No se envió a Meta.');
                continue;
            }

            // Editar = POST al ID de la plantilla con los nuevos componentes.
            $edit = Http::withToken($token)->post(
                "https://graph.facebook.com/v21.0/{$meta['id']}",
                [
                    'category' => 'MARKETING',
                    'components' => $components,
                ]
            );

            if (!$edit->successful()) {
                $err = $edit->json();
                $msg = $err['error']['message'] ?? 'Error desconocido';
                $userMsg = $err['error']['error_user_msg'] ?? '';
                $this->error("  ✗ Meta ({$edit->status()}): {$msg}" . ($userMsg ? " — {$userMsg}" : ''));
                continue;
            }

            $this->info('  ✓ Editada y enviada a revisión: ' . json_encode($edit->json(), JSON_UNESCAPED_UNICODE));
        }

        if (!$this->option('dry-run')) {
            $this->newLine();
            $this->line('Las originales quedaron en revisión (PENDING). Su versión aprobada anterior');
            $this->line('sigue activa. Como los recordatorios usan las _v2, no hay interrupción.');
        }

        return 0;
    }
}
