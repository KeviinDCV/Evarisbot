<?php
/**
 * SCRIPT DEFINITIVO - Suscribir webhook al número real
 */

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "=== SUSCRIPCIÓN FORZADA DE WEBHOOK ===\n\n";

// Obtener credenciales
$token = \App\Models\Setting::get('whatsapp_token');
$phoneNumberId = \App\Models\Setting::get('whatsapp_phone_number_id');

if (!$token) {
    die("❌ Token no configurado\n");
}

if (!$phoneNumberId) {
    die("❌ Phone Number ID no configurado\n");
}

echo "Phone Number ID: {$phoneNumberId}\n";
echo "Suscribiendo webhook...\n\n";

// PASO 1: Suscribir el webhook
$url = "https://graph.facebook.com/v18.0/{$phoneNumberId}/subscribed_apps";

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $token,
    'Content-Type: application/json',
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP Code: {$httpCode}\n";
echo "Response: {$response}\n\n";

if ($httpCode == 200) {
    $data = json_decode($response, true);
    if ($data['success'] ?? false) {
        echo "✅ Webhook suscrito exitosamente!\n\n";
    } else {
        echo "⚠️ Respuesta: " . json_encode($data) . "\n\n";
    }
} else {
    echo "❌ Error HTTP: {$httpCode}\n";
    $error = json_decode($response, true);
    if ($error) {
        echo "Error: " . ($error['error']['message'] ?? 'Desconocido') . "\n";
    }
    echo "\n";
}

// PASO 2: Verificar suscripción
echo "🔍 Verificando suscripción...\n";

$verifyUrl = "https://graph.facebook.com/v18.0/{$phoneNumberId}/subscribed_apps";

$ch = curl_init($verifyUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $token,
]);

$verifyResponse = curl_exec($ch);
$verifyHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "Verificación HTTP Code: {$verifyHttpCode}\n";
echo "Verificación Response: {$verifyResponse}\n\n";

if ($verifyHttpCode == 200) {
    $verifyData = json_decode($verifyResponse, true);
    if (!empty($verifyData['data'])) {
        echo "✅ Webhook está suscrito!\n";
        echo "Apps suscritas: " . json_encode($verifyData['data'], JSON_PRETTY_PRINT) . "\n\n";
    } else {
        echo "❌ Webhook NO está suscrito\n\n";
    }
}

// PASO 3: Instrucciones finales
echo "=== PRUEBA FINAL ===\n";
echo "1. Envía un WhatsApp desde tu celular a: +57 310 2432780\n";
echo "2. Mensaje: 'Prueba definitiva'\n";
echo "3. Verifica en: http://192.168.2.202:8000/admin/chat\n";
echo "4. Revisa ngrok: http://127.0.0.1:4040\n\n";
