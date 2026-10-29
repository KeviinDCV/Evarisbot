<?php

namespace App\Console\Commands;

use App\Services\AppointmentReminderService;
use Illuminate\Console\Command;

/**
 * Envía UNA plantilla de recordatorio v2 a un número de prueba, usando el MISMO método
 * de envío que producción (sendTemplateMessage). No escribe en la base de datos, no cambia
 * ninguna configuración y no toca el flujo real de recordatorios: solo manda un mensaje al
 * número indicado para validar visualmente que la línea "Consultorio" se ve bien.
 *
 * Requiere que la plantilla v2 ya esté APROBADA en Meta.
 *   php artisan templates:test-reminder-v2 3117486124            (Cali)
 *   php artisan templates:test-reminder-v2 3117486124 --cartago  (Cartago)
 */
class TestReminderV2 extends Command
{
    protected $signature = 'templates:test-reminder-v2 {phone} {--cartago : Usar la plantilla de Cartago}';
    protected $description = 'Envía una plantilla de recordatorio v2 a un número de prueba (no toca producción).';

    public function handle(): int
    {
        $phone = preg_replace('/[^0-9]/', '', $this->argument('phone'));
        if (strlen($phone) === 10) {
            $phone = '57' . $phone;
        }
        if (strlen($phone) < 12) {
            $this->error("Número inválido: {$phone}");
            return 1;
        }

        $template = $this->option('cartago') ? 'appointment_reminder_cartago_v2' : 'appointment_reminder_v2';

        // Datos de ejemplo (6 parámetros = incluye el nuevo Consultorio).
        $params = [
            'PACIENTE DE PRUEBA',
            'lunes 7 de julio de 2026',
            '10:30 AM',
            'DRA. MARIA GOMEZ',
            'GINECOLOGIA Y OBSTETRICIA',
            'G04 - GINECOLOGIA',
        ];
        $components = [[
            'type' => 'body',
            'parameters' => array_map(fn ($p) => ['type' => 'text', 'text' => $p], $params),
        ]];

        $this->info("Enviando '{$template}' a {$phone} (6 parámetros, incluye Consultorio)...");

        $svc = app(AppointmentReminderService::class);
        $m = new \ReflectionMethod($svc, 'sendTemplateMessage');
        $m->setAccessible(true);

        try {
            $resp = $m->invoke($svc, $phone, $template, $components);
            if (isset($resp['messages'][0]['id'])) {
                $this->info('✓ Enviado. message_id=' . $resp['messages'][0]['id']);
                return 0;
            }
            $this->warn('Respuesta inesperada: ' . json_encode($resp, JSON_UNESCAPED_UNICODE));
            return 1;
        } catch (\Throwable $e) {
            $this->error('✗ ' . $e->getMessage());
            return 1;
        }
    }
}
