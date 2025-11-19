<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// Verificar fechas en la BD
echo "=== VERIFICANDO FECHAS ===" . PHP_EOL . PHP_EOL;

$apps = \App\Models\Appointment::where('uploaded_by', 1)
    ->take(10)
    ->get(['id', 'citfc', 'pactel', 'nom_paciente']);

foreach ($apps as $app) {
    echo "ID: {$app->id}" . PHP_EOL;
    echo "  CITFC: {$app->citfc}" . PHP_EOL;
    echo "  Paciente: {$app->nom_paciente}" . PHP_EOL;
    echo "  Tel: {$app->pactel}" . PHP_EOL;
    echo "---" . PHP_EOL;
}

echo PHP_EOL . "Total citas: " . \App\Models\Appointment::where('uploaded_by', 1)->count() . PHP_EOL;

// Ver cuál es la fecha objetivo
$daysInAdvance = 2;
$targetDate = now()->addDays($daysInAdvance)->startOfDay();
$targetDateString = $targetDate->format('Y-m-d');

echo PHP_EOL . "Fecha objetivo (pasado mañana): {$targetDateString}" . PHP_EOL;

// Buscar citas con esa fecha
$count = \App\Models\Appointment::query()
    ->where('uploaded_by', 1)
    ->whereDate('citfc', '=', $targetDateString)
    ->where('reminder_sent', false)
    ->whereNotNull('citfc')
    ->whereNotNull('pactel')
    ->count();

echo "Citas que coinciden: {$count}" . PHP_EOL;
