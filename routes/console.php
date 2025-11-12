<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Programar envío automático de recordatorios de citas
// Se ejecuta todos los días a las 9:00 AM
Schedule::command('appointments:send-reminders')
    ->dailyAt('09:00')
    ->timezone('America/Bogota')
    ->withoutOverlapping()
    ->onOneServer()
    ->runInBackground();

// Procesar cola de recordatorios cada minuto (para cPanel)
// Esto procesa cualquier job que haya quedado pendiente en la cola
Schedule::command('reminders:process-queue --limit=50')
    ->everyMinute()
    ->withoutOverlapping()
    ->runInBackground();
