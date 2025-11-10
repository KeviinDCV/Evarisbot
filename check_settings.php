<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "=== CONFIGURACIÓN ACTUAL ===\n\n";

$token = \App\Models\Setting::get('whatsapp_token');
$phoneId = \App\Models\Setting::get('whatsapp_phone_number_id');
$businessId = \App\Models\Setting::get('whatsapp_business_account_id');

echo "Token: " . ($token ? '✅ Configurado' : '❌ NO configurado') . "\n";
echo "Phone Number ID: " . ($phoneId ?: '❌ NO configurado') . "\n";
echo "Business Account ID: " . ($businessId ?: '❌ NO configurado') . "\n\n";

if ($phoneId) {
    echo "Phone Number ID debe ser: 895419550310430\n";
    echo "Phone Number ID actual es: $phoneId\n";
    
    if ($phoneId === '895419550310430') {
        echo "✅ Phone Number ID es CORRECTO\n";
    } else {
        echo "❌ Phone Number ID es INCORRECTO\n";
    }
}
