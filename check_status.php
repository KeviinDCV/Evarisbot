<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo "=== ESTADO DE CITAS ===" . PHP_EOL . PHP_EOL;

$total = \App\Models\Appointment::where('uploaded_by', 1)->count();
echo "Total citas en BD: {$total}" . PHP_EOL;

$sent = \App\Models\Appointment::where('uploaded_by', 1)
    ->where('reminder_sent', true)
    ->count();
echo "Recordatorios enviados: {$sent}" . PHP_EOL;

$pending = \App\Models\Appointment::where('uploaded_by', 1)
    ->where('reminder_sent', false)
    ->count();
echo "Recordatorios pendientes: {$pending}" . PHP_EOL . PHP_EOL;

// Ver las últimas enviadas
echo "=== ÚLTIMAS 5 ENVIADAS ===" . PHP_EOL;
$lastSent = \App\Models\Appointment::where('uploaded_by', 1)
    ->where('reminder_sent', true)
    ->orderBy('reminder_sent_at', 'desc')
    ->take(5)
    ->get(['id', 'nom_paciente', 'pactel', 'reminder_sent_at']);

foreach ($lastSent as $app) {
    echo "ID: {$app->id} | {$app->nom_paciente} | Tel: {$app->pactel} | Enviado: {$app->reminder_sent_at}" . PHP_EOL;
}

echo PHP_EOL . "=== PRIMERAS 5 PENDIENTES ===" . PHP_EOL;
$pendingList = \App\Models\Appointment::where('uploaded_by', 1)
    ->where('reminder_sent', false)
    ->whereNotNull('citfc')
    ->whereNotNull('pactel')
    ->orderBy('citfc', 'asc')
    ->take(5)
    ->get(['id', 'nom_paciente', 'pactel', 'citfc']);

foreach ($pendingList as $app) {
    echo "ID: {$app->id} | {$app->nom_paciente} | Tel: {$app->pactel} | Cita: {$app->citfc}" . PHP_EOL;
}
