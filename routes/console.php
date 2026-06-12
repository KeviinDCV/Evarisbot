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

// Verificar timeouts del flujo de bienvenida cada minuto
// 5 min → recordatorio, 10 min → cierre de sesión
Schedule::command('flow:check-timeouts')
    ->everyMinute()
    ->timezone('America/Bogota')
    ->withoutOverlapping()
    ->runInBackground();

// Verificar inactividad en los chats con la IA cada minuto
// 5 min → "¿Sigues ahí?", 10 min → reiniciar historial (umbrales configurables)
Schedule::command('ai:check-timeouts')
    ->everyMinute()
    ->timezone('America/Bogota')
    ->withoutOverlapping()
    ->runInBackground();

// TEMPORAL (jun-2026): relevo de la plantilla de reprogramación Cartago.
// Cuando Meta apruebe la v2 se activa y se oculta la antigua, para que el
// selector nunca muestre las dos. Tras el relevo queda en no-op; se puede
// borrar este bloque cuando la v2 esté activa.
Schedule::call(function () {
    $v2 = \App\Models\WhatsappTemplate::where('meta_template_name', 'reprogramacion_cartago_v2')->first();
    if (!$v2 || !$v2->meta_template_id || $v2->is_active || $v2->status === 'REJECTED') {
        return; // relevo ya hecho, rechazada o no existe
    }
    try {
        $r = \Illuminate\Support\Facades\Http::withToken(\App\Models\Setting::get('whatsapp_token'))
            ->timeout(15)
            ->get('https://graph.facebook.com/v21.0/' . $v2->meta_template_id, ['fields' => 'status']);
        $status = $r->json()['status'] ?? null;
        if ($status === 'APPROVED') {
            $v2->update(['status' => 'APPROVED', 'is_active' => true]);
            \App\Models\WhatsappTemplate::where('meta_template_name', 'reprogramacion_cartago')
                ->update(['is_active' => false, 'name' => 'Reprogramación de cita (Cartago) — ANTIGUA']);
            \Illuminate\Support\Facades\Log::info('Plantilla Cartago v2 APROBADA: v2 activada, antigua oculta');
        } elseif ($status === 'REJECTED') {
            $v2->update(['status' => 'REJECTED']);
            \Illuminate\Support\Facades\Log::warning('Plantilla Cartago v2 RECHAZADA por Meta');
        }
    } catch (\Throwable $e) {
        // Sin red o Meta caído: se reintenta en el próximo ciclo
    }
})->everyFiveMinutes()->name('swap-cartago-v2')->withoutOverlapping();

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
