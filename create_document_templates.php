<?php

/**
 * Script para crear plantillas de WhatsApp con header de documento (PDF).
 * Cistoscopia y Urodinamia.
 * 
 * Ejecutar: php create_document_templates.php
 * Eliminar después de usar.
 */

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Setting;
use App\Models\WhatsappTemplate;
use Illuminate\Support\Facades\Http;

$businessAccountId = Setting::get('whatsapp_business_account_id');
$token = Setting::get('whatsapp_token');

if (!$businessAccountId || !$token) {
    echo "ERROR: WhatsApp API no configurada. Falta Business Account ID o Token.\n";
    exit(1);
}

// ===== Paso 1: Obtener App ID desde Meta API =====
echo "=== Obteniendo App ID desde Meta API ===\n";
$appResponse = Http::withToken($token)->get("https://graph.facebook.com/v21.0/app");
if (!$appResponse->successful()) {
    echo "ERROR: No se pudo obtener el App ID: " . ($appResponse->json()['error']['message'] ?? 'Error desconocido') . "\n";
    exit(1);
}
$appId = $appResponse->json()['id'];
echo "  App ID: {$appId}\n\n";

// ===== Función para subir un archivo PDF a Meta (Resumable Upload API) =====
function uploadPdfToMeta(string $appId, string $token, string $filePath, string $fileName): ?string
{
    if (!file_exists($filePath)) {
        echo "  ERROR: Archivo no encontrado: {$filePath}\n";
        return null;
    }

    $fileSize = filesize($filePath);
    echo "  Subiendo {$fileName} ({$fileSize} bytes)...\n";

    // Paso 1: Crear sesión de upload
    $sessionResponse = Http::withToken($token)
        ->post("https://graph.facebook.com/v21.0/{$appId}/uploads", [
            'file_length' => $fileSize,
            'file_type' => 'application/pdf',
            'file_name' => $fileName,
        ]);

    if (!$sessionResponse->successful()) {
        echo "  ERROR al crear sesión de upload: " . ($sessionResponse->json()['error']['message'] ?? 'Error desconocido') . "\n";
        echo "  Response: " . $sessionResponse->body() . "\n";
        return null;
    }

    $uploadSessionId = $sessionResponse->json()['id'];
    echo "  Sesión creada: {$uploadSessionId}\n";

    // Paso 2: Subir el archivo binario
    $fileContent = file_get_contents($filePath);
    $uploadResponse = Http::withHeaders([
        'Authorization' => "OAuth {$token}",
        'file_offset' => '0',
        'Content-Type' => 'application/pdf',
    ])->withBody($fileContent, 'application/pdf')
      ->post("https://graph.facebook.com/v21.0/{$uploadSessionId}");

    if (!$uploadResponse->successful()) {
        echo "  ERROR al subir archivo: " . ($uploadResponse->json()['error']['message'] ?? 'Error desconocido') . "\n";
        echo "  Response: " . $uploadResponse->body() . "\n";
        return null;
    }

    $handle = $uploadResponse->json()['h'];
    echo "  ✓ Handle obtenido: " . substr($handle, 0, 50) . "...\n";

    return $handle;
}

// ===== Plantillas a crear =====
$templates = [
    [
        'name' => 'cistoscopia_urocultivo',
        'display_name' => 'Cistoscopia - Solicitud de Urocultivo',
        'category' => 'UTILITY',
        'language' => 'es',
        'body' => "Buen día,\nCordial saludo, SR(A) {{1}}\nSe escribe del HOSPITAL UNIVERSITARIO DEL VALLE EVARISTO GARCIA con el fin de informar que para su procedimiento de CISTOSCOPIA, Debe enviar al numero de telefono 3148870463, el resultado del urocultivo, lo anterior con el fin de confirmar la asistencia a su cita.",
        'example_params' => ['Juan Pérez'],
        'pdf_file' => 'Cistoscopia.pdf',
        'pdf_path' => __DIR__ . '/public/Cistoscopia.pdf',
    ],
    [
        'name' => 'urodinamia_urocultivo',
        'display_name' => 'Urodinamia - Solicitud de Urocultivo',
        'category' => 'UTILITY',
        'language' => 'es',
        'body' => "Buen día,\nCordial saludo, SR(A) {{1}}\nSe escribe del HOSPITAL UNIVERSITARIO DEL VALLE EVARISTO GARCIA con el fin de informar que para su procedimiento de URODINAMIA, Debe enviar al numero de telefono 3148870463, el resultado del urocultivo, lo anterior con el fin de confirmar la asistencia a su cita.",
        'example_params' => ['Juan Pérez'],
        'pdf_file' => 'Urodinamia.pdf',
        'pdf_path' => __DIR__ . '/public/Urodinamia.pdf',
    ],
];

echo "=== Creando " . count($templates) . " plantillas con header de documento ===\n\n";

foreach ($templates as $tpl) {
    echo "--- {$tpl['display_name']} ({$tpl['name']}) ---\n";

    // Verificar si ya existe localmente
    if (WhatsappTemplate::where('meta_template_name', $tpl['name'])->exists()) {
        echo "  ⚠ Ya existe localmente, saltando.\n\n";
        continue;
    }

    // Verificar que el PDF existe
    if (!file_exists($tpl['pdf_path'])) {
        echo "  ⚠ ADVERTENCIA: El archivo {$tpl['pdf_file']} no existe en public/\n";
        echo "  Sube el archivo a: {$tpl['pdf_path']}\n";
        echo "  Creando plantilla sin header de documento...\n\n";
        
        // Crear sin header de documento
        $components = [
            [
                'type' => 'BODY',
                'text' => $tpl['body'],
                'example' => [
                    'body_text' => [$tpl['example_params']],
                ],
            ],
        ];

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
                    'header_format' => null,
                    'header_media_url' => null,
                    'default_params' => array_fill(0, count($tpl['example_params']), ''),
                    'is_active' => false,
                ]);

                echo "  ✓ Plantilla (sin documento) enviada a revisión (ID: " . ($data['id'] ?? 'N/A') . ")\n\n";
            } else {
                $errorData = $response->json();
                echo "  ✗ Error: " . ($errorData['error']['message'] ?? 'Error desconocido') . "\n";
                if (isset($errorData['error']['error_user_msg'])) {
                    echo "    Detalle: " . $errorData['error']['error_user_msg'] . "\n";
                }
                echo "\n";
            }
        } catch (\Exception $e) {
            echo "  ✗ Excepción: " . $e->getMessage() . "\n\n";
        }

        continue;
    }

    // Subir PDF a Meta
    $handle = uploadPdfToMeta($appId, $token, $tpl['pdf_path'], $tpl['pdf_file']);

    if (!$handle) {
        echo "  ✗ No se pudo subir el PDF, saltando.\n\n";
        continue;
    }

    // Construir componentes con header de documento
    $components = [
        [
            'type' => 'HEADER',
            'format' => 'DOCUMENT',
            'example' => [
                'header_handle' => [$handle],
            ],
        ],
        [
            'type' => 'BODY',
            'text' => $tpl['body'],
            'example' => [
                'body_text' => [$tpl['example_params']],
            ],
        ],
    ];

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
                'header_format' => 'DOCUMENT',
                'header_media_url' => '/' . $tpl['pdf_file'],
                'default_params' => array_fill(0, count($tpl['example_params']), ''),
                'is_active' => false,
            ]);

            echo "  ✓ Enviada a revisión con documento (ID: " . ($data['id'] ?? 'N/A') . ", Status: " . ($data['status'] ?? 'PENDING') . ")\n\n";
        } else {
            $errorData = $response->json();
            echo "  ✗ Error: " . ($errorData['error']['message'] ?? 'Error desconocido') . "\n";
            if (isset($errorData['error']['error_user_msg'])) {
                echo "    Detalle: " . $errorData['error']['error_user_msg'] . "\n";
            }
            echo "    Response completa: " . json_encode($errorData, JSON_PRETTY_PRINT) . "\n\n";
        }
    } catch (\Exception $e) {
        echo "  ✗ Excepción: " . $e->getMessage() . "\n\n";
    }
}

echo "\n=== Proceso completado ===\n";
echo "NOTA: Las plantillas deben ser aprobadas por Meta antes de poder usarlas.\n";
echo "      Sincroniza las plantillas desde la página de Envíos Masivos para actualizar el estado.\n";
