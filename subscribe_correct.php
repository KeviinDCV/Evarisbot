<?php
/**
 * SUSCRIPCIÓN CORRECTA - Usando WABA ID
 */

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "=== SUSCRIPCIÓN CORRECTA DE WEBHOOK ===\n\n";

$token = \App\Models\Setting::get('whatsapp_token');
$wabaId = \App\Models\Setting::get('whatsapp_business_account_id');
$phoneNumberId = \App\Models\Setting::get('whatsapp_phone_number_id');

if (!$token || !$wabaId) {
    die("❌ Credenciales no configuradas\n");
}

echo "WABA ID: {$wabaId}\n";
echo "Phone Number ID: {$phoneNumberId}\n\n";

// SUSCRIBIR usando WABA ID (correcto)
$url = "https://graph.facebook.com/v18.0/{$wabaId}/subscribed_apps";

echo "Suscribiendo webhook a la WABA...\n";

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $token,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP Code: {$httpCode}\n";
echo "Response: {$response}\n\n";

if ($httpCode == 200) {
    $data = json_decode($response, true);
    if ($data['success'] ?? false) {
        echo "✅ ¡WEBHOOK SUSCRITO EXITOSAMENTE!\n\n";
    } else {
        echo "Respuesta: " . json_encode($data, JSON_PRETTY_PRINT) . "\n\n";
    }
} else {
    $error = json_decode($response, true);
    echo "❌ Error: " . ($error['error']['message'] ?? 'Desconocido') . "\n\n";
    
    // Si ya está suscrito, es OK
    if (strpos($response, 'already') !== false) {
        echo "⚠️ Posiblemente ya está suscrito\n\n";
    }
}

// Verificar suscripción
echo "🔍 Verificando suscripciones actuales...\n";

$verifyUrl = "https://graph.facebook.com/v18.0/{$wabaId}/subscribed_apps";

$ch = curl_init($verifyUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $token,
]);

$verifyResponse = curl_exec($ch);
$verifyHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP Code: {$verifyHttpCode}\n";
echo "Response: {$verifyResponse}\n\n";

if ($verifyHttpCode == 200) {
    $verifyData = json_decode($verifyResponse, true);
    
    if (!empty($verifyData['data'])) {
        echo "✅ Apps suscritas:\n";
        foreach ($verifyData['data'] as $app) {
            echo "  - App ID: " . ($app['id'] ?? 'N/A') . "\n";
            if (isset($app['subscribed_fields'])) {
                echo "    Campos: " . implode(', ', $app['subscribed_fields']) . "\n";
            }
        }
        echo "\n";
    } else {
        echo "⚠️ No hay apps suscritas\n\n";
    }
}

echo "=== ¡AHORA SÍ! PRUEBA FINAL ===\n";
echo "1. Envía WhatsApp desde tu celular a: +57 310 2432780\n";
echo "2. Mensaje: 'Ya funciona'\n";
echo "3. Debe aparecer en: http://192.168.2.202:8000/admin/chat\n";
echo "4. Y en ngrok: http://127.0.0.1:4040\n\n";
