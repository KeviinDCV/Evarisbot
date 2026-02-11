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

// Envío automático de recordatorios cada 5 minutos
// Detecta citas para mañana y pasado mañana que aún no tienen recordatorio enviado
// y lanza el batch de envío automáticamente (como si se presionara el botón manual)
Schedule::command('appointments:auto-send')
    ->everyFiveMinutes()
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

// ============================================================================
// OPTIMIZACIÓN DE MEMORIA - Tareas Automáticas
// ============================================================================
// IMPORTANTE: Estas tareas están DESACTIVADAS por defecto.
// Se activan configurando OPTIMIZATION_ENABLED=true en .env
// ============================================================================

// Limpieza de datos antiguos (mensajes, jobs, sesiones)
// Se ejecuta diariamente a las 3:00 AM para no interferir con producción
Schedule::command('cleanup:old-data')
    ->dailyAt(config('optimization.cleanup_data.time', '03:00'))
    ->timezone('America/Bogota')
    ->withoutOverlapping()
    ->onOneServer()
    ->when(function () {
        return config('optimization.enabled', false) 
            && config('optimization.cleanup_data.enabled', false);
    })
    ->onSuccess(function () {
        \Illuminate\Support\Facades\Log::info('✅ Limpieza de datos completada automáticamente');
    })
    ->onFailure(function () {
        \Illuminate\Support\Facades\Log::error('❌ Error en limpieza automática de datos');
    });

// Limpieza de logs antiguos
// Se ejecuta diariamente a las 3:30 AM
Schedule::command('cleanup:logs')
    ->dailyAt(config('optimization.cleanup_logs.time', '03:30'))
    ->timezone('America/Bogota')
    ->withoutOverlapping()
    ->onOneServer()
    ->when(function () {
        return config('optimization.enabled', false) 
            && config('optimization.cleanup_logs.enabled', false);
    })
    ->onSuccess(function () {
        \Illuminate\Support\Facades\Log::info('✅ Limpieza de logs completada automáticamente');
    })
    ->onFailure(function () {
        \Illuminate\Support\Facades\Log::error('❌ Error en limpieza automática de logs');
    });

// Reinicio automático de servicios
// Se ejecuta diariamente a las 4:00 AM para liberar memoria acumulada
Schedule::command('services:restart --force')
    ->dailyAt('04:00')
    ->timezone('America/Bogota')
    ->withoutOverlapping()
    ->onOneServer()
    ->when(function () {
        return config('optimization.enabled', false);
    })
    ->onSuccess(function () {
        \Illuminate\Support\Facades\Log::info('✅ Servicios reiniciados automáticamente');
    });
