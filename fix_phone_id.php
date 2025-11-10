<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "Guardando Phone Number ID...\n\n";

\App\Models\Setting::set('whatsapp_phone_number_id', '895419550310430');

echo "✅ Phone Number ID guardado: 895419550310430\n";

// Verificar
$saved = \App\Models\Setting::get('whatsapp_phone_number_id');
echo "\nVerificación: $saved\n";

if ($saved === '895419550310430') {
    echo "\n✅ TODO LISTO - Ahora envía un mensaje de prueba desde tu celular\n";
} else {
    echo "\n❌ Error al guardar\n";
}
