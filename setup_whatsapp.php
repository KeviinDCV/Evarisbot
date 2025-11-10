<?php
/**
 * Script para configurar WhatsApp en .env y base de datos
 */

echo "=== CONFIGURACIÓN DE WHATSAPP ===\n\n";

// Credenciales
$credentials = [
    'WHATSAPP_TOKEN' => 'EAAbZA9bE8nv8BP23UkFnxvmgoZBX9PeLypP4J2T68RpUQIQQpApOmwkxAjALT57o8GN67cRVzotIiErKPsTx31ZARmsDhJhPMaJcSCq3HGQIJDA6jM0IuEsI8YN4T5vvjg0KWBXxCYhaIZAaMfc5cIkjffT90cZBpTGWS1i4CVdKIVngseU4PaeZCe5ZBDzOpaf6QZDZD',
    'WHATSAPP_PHONE_NUMBER_ID' => '895419550310430',
    'WHATSAPP_BUSINESS_ACCOUNT_ID' => '1290633555933503',
    'WHATSAPP_SYSTEM_USER_ID' => '61582822919896',
    'WHATSAPP_VERIFY_TOKEN' => 'huv_webhook_secret_2024',
];

$envFile = __DIR__ . '/.env';

if (!file_exists($envFile)) {
    die("❌ Error: Archivo .env no encontrado\n");
}

echo "📝 Actualizando archivo .env...\n";

$envContent = file_get_contents($envFile);

foreach ($credentials as $key => $value) {
    $pattern = "/^{$key}=.*$/m";
    
    if (preg_match($pattern, $envContent)) {
        // Actualizar existente
        $envContent = preg_replace($pattern, "{$key}={$value}", $envContent);
        echo "  ✅ Actualizado: {$key}\n";
    } else {
        // Agregar nuevo
        $envContent .= "\n{$key}={$value}";
        echo "  ➕ Agregado: {$key}\n";
    }
}

file_put_contents($envFile, $envContent);

echo "\n✅ Archivo .env actualizado\n\n";

// Ahora guardar en base de datos
echo "📝 Guardando en base de datos...\n";

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

// Guardar en Settings
\App\Models\Setting::set('whatsapp_token', $credentials['WHATSAPP_TOKEN']);
\App\Models\Setting::set('whatsapp_phone_number_id', $credentials['WHATSAPP_PHONE_NUMBER_ID']);
\App\Models\Setting::set('whatsapp_business_account_id', $credentials['WHATSAPP_BUSINESS_ACCOUNT_ID']);
\App\Models\Setting::set('whatsapp_verify_token', $credentials['WHATSAPP_VERIFY_TOKEN']);

echo "  ✅ Token guardado\n";
echo "  ✅ Phone Number ID guardado: {$credentials['WHATSAPP_PHONE_NUMBER_ID']}\n";
echo "  ✅ Business Account ID guardado: {$credentials['WHATSAPP_BUSINESS_ACCOUNT_ID']}\n";
echo "  ✅ Verify Token guardado\n";

// Verificar
echo "\n🔍 Verificando configuración...\n";

$token = \App\Models\Setting::get('whatsapp_token');
$phoneId = \App\Models\Setting::get('whatsapp_phone_number_id');
$businessId = \App\Models\Setting::get('whatsapp_business_account_id');

if ($token && $phoneId && $businessId) {
    echo "\n✅ ¡TODO CONFIGURADO CORRECTAMENTE!\n\n";
    echo "Phone Number ID: {$phoneId}\n";
    echo "Business Account ID: {$businessId}\n";
    echo "\n🎉 Ahora puedes:\n";
    echo "  1. Enviar un mensaje desde tu celular a: +57 310 2432780\n";
    echo "  2. Ver el mensaje en: http://192.168.2.202:8000/admin/chat\n\n";
} else {
    echo "\n❌ Error: Algo salió mal\n";
}
