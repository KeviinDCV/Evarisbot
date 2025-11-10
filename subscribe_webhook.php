<?php
/**
 * Script para suscribir webhook al número de WhatsApp
 * Ejecutar con: php subscribe_webhook.php
 */

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$token = \App\Models\Setting::get('whatsapp_token');
$phoneNumberId = \App\Models\Setting::get('whatsapp_phone_number_id');

if (!$token || !$phoneNumberId) {
    die("Error: Token o Phone Number ID no configurado en Settings\n");
}

echo "Suscribiendo webhook...\n";
echo "Phone Number ID: $phoneNumberId\n";

$url = "https://graph.facebook.com/v18.0/{$phoneNumberId}/subscribed_apps";

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $token,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP Code: $httpCode\n";
echo "Response: $response\n";

if ($httpCode == 200) {
    $data = json_decode($response, true);
    if ($data['success'] ?? false) {
        echo "\n✅ Webhook suscrito exitosamente!\n";
    } else {
        echo "\n❌ Error: " . json_encode($data) . "\n";
    }
} else {
    echo "\n❌ Error HTTP: $httpCode\n";
    echo "Response: $response\n";
}
