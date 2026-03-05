<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Comando rápido para resetear el flujo de bienvenida de una conversación (testing)
Artisan::command('flow:reset {phone?}', function (?string $phone = null) {
    if ($phone) {
        // Normalizar: quitar + y espacios
        $phone = preg_replace('/[^0-9]/', '', $phone);
        $conversations = \App\Models\Conversation::where('phone_number', 'LIKE', '%' . substr($phone, -10) . '%')->get();
    } else {
        // Sin teléfono: resetear la última conversación que tenga flujo (completado o en progreso)
        $conversations = \App\Models\Conversation::where(function ($q) {
                $q->whereNotNull('welcome_flow_step')
                  ->orWhere('welcome_flow_completed', true);
            })
            ->orderByDesc('last_message_at')
            ->take(1)
            ->get();
    }

    if ($conversations->isEmpty()) {
        $this->error('No se encontró ninguna conversación.');
        $this->line('Uso: php artisan flow:reset [teléfono]');
        $this->line('Ejemplo: php artisan flow:reset 573045782893');
        return;
    }

    foreach ($conversations as $conv) {
        $conv->update([
            'welcome_flow_step' => null,
            'welcome_flow_completed' => false,
            'welcome_flow_data' => null,
        ]);
        $this->info("✅ Flujo reseteado para: {$conv->phone_number} (ID: {$conv->id})");
        $this->line("   Ahora al escribir de nuevo, el flujo iniciará desde 0.");
    }
})->purpose('Resetear flujo de bienvenida de una conversación para testing');

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

// Procesar cola de recordatorios cada minuto (SOLO para cPanel sin queue:work permanente)
// DESACTIVADO cuando se usa `php artisan queue:work` ya que compite por el lock
// y causa que los jobs se atasquen sin enviar realmente.
// Schedule::command('reminders:process-queue --limit=50')
//     ->everyMinute()
//     ->withoutOverlapping()
//     ->runInBackground();

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
