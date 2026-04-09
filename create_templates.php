<?php

/**
 * Script temporal para crear las 5 plantillas de citas en Meta WhatsApp API.
 * Ejecutar: php create_templates.php
 * Eliminar después de usar.
 */

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->handleRequest(\Illuminate\Http\Request::capture());

use App\Models\Setting;
use App\Models\WhatsappTemplate;
use Illuminate\Support\Facades\Http;

$businessAccountId = Setting::get('whatsapp_business_account_id');
$token = Setting::get('whatsapp_token');

if (!$businessAccountId || !$token) {
    echo "ERROR: WhatsApp API no configurada. Falta Business Account ID o Token.\n";
    exit(1);
}

$templates = [
    [
        'name' => 'programacion_cita_pendiente',
        'display_name' => 'Programación de cita pendiente',
        'category' => 'UTILITY',
        'language' => 'es',
        'body' => "Buen día,\nCordial saludo, SR(A) {{1}}\nSe escribe del HOSPITAL UNIVERSITARIO DEL VALLE EVARISTO GARCIA con el fin de informar que la cita DE {{2}} que estaba pendiente queda programada para el día {{3}} con el Dr. {{4}} a las {{5}} SEDE PRINCIPAL DEL HOSPITAL calle 5 #36-08 san fernando traer autorizacion vigente, orden medica, historia clinica llegar 40 minutos antes de la consulta para facturar.",
        'example_params' => ['Juan Pérez', 'Cardiología', '15 de abril de 2026', 'García', '10:00 AM'],
    ],
    [
        'name' => 'cambio_horario_cita',
        'display_name' => 'Cambio de horario de la cita',
        'category' => 'UTILITY',
        'language' => 'es',
        'body' => "Buen día,\nCordial saludo, SR(A) {{1}}\nSe escribe del HOSPITAL UNIVERSITARIO DEL VALLE EVARISTO GARCIA con el fin de informar que la cita de {{2}} del día {{3}} SE MODIFICA DE HORARIO para las {{4}} con el DR.(A) {{5}} EN LA SEDE PRINCIPAL DEL HOSPITAL calle 5 #36-08 san Fernando traer autorización vigente, orden medica, historia clínica llegar 40 minutos antes de la consulta para facturar.",
        'example_params' => ['Juan Pérez', 'Cardiología', '15 de abril de 2026', '2:00 PM', 'García'],
    ],
    [
        'name' => 'cancelacion_cita',
        'display_name' => 'Cancelación de cita',
        'category' => 'UTILITY',
        'language' => 'es',
        'body' => "Buen día,\nCordial saludo, SR(A) {{1}}\nSe escribe del HOSPITAL UNIVERSITARIO DEL VALLE EVARISTO GARCIA con el fin de informar que la cita de {{2}} del día {{3}} con el DR.(A) {{4}} queda CANCELADA Y PENDIENTE DE REPROGRAMAR. POR FAVOR ESTAR PENDIENTE A LOS NÚMEROS DE TELEFONO YA QUE ESTAREMOS LLAMANDO.",
        'example_params' => ['Juan Pérez', 'Cardiología', '15 de abril de 2026', 'García'],
    ],
    [
        'name' => 'reprogramacion_cita',
        'display_name' => 'Reprogramación de cita',
        'category' => 'UTILITY',
        'language' => 'es',
        'body' => "Buen día,\nCordial saludo, SR(A) {{1}}\nSe escribe del HOSPITAL UNIVERSITARIO DEL VALLE EVARISTO GARCIA con el fin de informar que la cita DE {{2}} del día {{3}} SE CANCELA Y SE REPROGRAMA PARA EL DIA {{4}} a las {{5}} con el DR.(A) {{6}} SEDE PRINCIPAL DEL HOSPITAL calle 5 #36-08 San Fernando traer autorización vigente, orden médica, historia clínica llegar 40 minutos antes de la consulta para facturar.",
        'example_params' => ['Juan Pérez', 'Cardiología', '10 de abril de 2026', '20 de abril de 2026', '10:00 AM', 'García'],
    ],
    [
        'name' => 'adelanto_cita',
        'display_name' => 'Adelanto de cita',
        'category' => 'UTILITY',
        'language' => 'es',
        'body' => "Buen día,\nCordial saludo, SR(A) {{1}}\nSe escribe del HOSPITAL UNIVERSITARIO DEL VALLE EVARISTO GARCIA con el fin de informar que la cita DE {{2}} DEL día {{3}} SE ADELANTA para el {{4}} a las {{5}} con el DR.(A) {{6}} EN LA SEDE PRINCIPAL DEL HOSPITAL calle 5 #36-08 san Fernando, traer autorización vigente, orden médica, historia clínica llegar 40 minutos antes de la consulta para facturar.",
        'example_params' => ['Juan Pérez', 'Cardiología', '20 de abril de 2026', '15 de abril de 2026', '10:00 AM', 'García'],
    ],
];

echo "=== Creando 5 plantillas en Meta WhatsApp API ===\n\n";

foreach ($templates as $tpl) {
    echo "--- {$tpl['display_name']} ({$tpl['name']}) ---\n";

    // Verificar si ya existe localmente
    if (WhatsappTemplate::where('meta_template_name', $tpl['name'])->exists()) {
        echo "  ⚠ Ya existe localmente, saltando.\n\n";
        continue;
    }

    // Construir componentes
    $components = [];

    $bodyComponent = [
        'type' => 'BODY',
        'text' => $tpl['body'],
        'example' => [
            'body_text' => [$tpl['example_params']],
        ],
    ];
    $components[] = $bodyComponent;

    // Enviar a Meta
    try {
        $response = Http::withToken($token)
            ->post("https://graph.facebook.com/v21.0/{$businessAccountId}/message_templates", [
                'name' => $tpl['name'],
                'category' => $tpl['category'],
                'language' => $tpl['language'],
                'components' => $components,
            ]);

        if ($response->successful()) {
            $data = $response->json();

            WhatsappTemplate::create([
                'name' => $tpl['display_name'],
                'meta_template_name' => $tpl['name'],
                'preview_text' => $tpl['body'],
                'language' => $tpl['language'],
                'category' => $tpl['category'],
                'status' => $data['status'] ?? 'PENDING',
                'meta_template_id' => $data['id'] ?? null,
                'header_text' => null,
                'header_format' => null,
                'footer_text' => null,
                'default_params' => array_fill(0, count($tpl['example_params']), ''),
                'is_active' => false,
            ]);

            echo "  ✓ Enviada a revisión (ID: " . ($data['id'] ?? 'N/A') . ", Status: " . ($data['status'] ?? 'PENDING') . ")\n\n";
        } else {
            $errorData = $response->json();
            $errorMsg = $errorData['error']['message'] ?? 'Error desconocido';
            $errorUserMsg = $errorData['error']['error_user_msg'] ?? '';
            echo "  ✗ Error de Meta: {$errorMsg}" . ($errorUserMsg ? " — {$errorUserMsg}" : '') . "\n\n";
        }
    } catch (\Exception $e) {
        echo "  ✗ Excepción: " . $e->getMessage() . "\n\n";
    }
}

echo "=== Proceso completado ===\n";
echo "Recuerde sincronizar desde la UI (Envíos Masivos → Sincronizar con Meta) para actualizar estados.\n";
