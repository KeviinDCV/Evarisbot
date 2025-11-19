<?php

use App\Http\Controllers\Admin\StatisticsController;
use App\Http\Controllers\Admin\TemplateController;
use App\Http\Controllers\Admin\UserController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return redirect()->route('login');
});

// Páginas públicas (requeridas para Meta)
Route::get('/privacy-policy', function () {
    $path = public_path('POLITICA-DE-SEGURIDAD-DIGITAL-POL-HUV-HUV-003-VER-003-REV-01-2021-04-13.pdf');
    
    if (file_exists($path)) {
        return response()->file($path);
    }
    
    // Fallback a la vista HTML si no existe el PDF
    return view('legal.privacy-policy');
})->name('privacy-policy');

Route::get('/terms-of-service', function () {
    $path = public_path('terms-of-service.pdf');
    
    if (file_exists($path)) {
        return response()->file($path);
    }
    
    // Fallback a la vista HTML si no existe el PDF
    return view('legal.terms-of-service');
})->name('terms-of-service');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        // Redirigir al chat tanto para admins como para asesores
        return redirect()->route('admin.chat.index');
    })->name('dashboard');
});

// Rutas del Administrador
Route::middleware(['auth', 'verified', 'role:admin'])->prefix('admin')->name('admin.')->group(function () {
    // Redirigir /admin a /admin/chat
    Route::get('/', function () {
        return redirect()->route('admin.chat.index');
    });
    
    Route::resource('users', UserController::class);
    
    // Plantillas para envíos masivos
    Route::resource('templates', TemplateController::class);
    Route::post('templates/{template}/toggle', [TemplateController::class, 'toggleStatus'])->name('templates.toggle');
    Route::get('templates/{template}/send-form', [TemplateController::class, 'sendForm'])->name('templates.send-form');
    Route::post('templates/{template}/send', [TemplateController::class, 'sendMassive'])->name('templates.send');
    
    // Gestión de Citas
    Route::controller(\App\Http\Controllers\AppointmentController::class)->prefix('appointments')->name('appointments.')->group(function () {
        Route::get('/', 'index')->name('index');
        Route::get('/view', 'view')->name('view');
        Route::post('/upload', 'upload')->name('upload');
        Route::post('/process', 'process')->name('process');
        Route::post('/reminders/start', 'startReminders')->name('reminders.start');
        Route::post('/reminders/pause', 'pauseReminders')->name('reminders.pause');
        Route::post('/reminders/resume', 'resumeReminders')->name('reminders.resume');
        Route::post('/reminders/stop', 'stopReminders')->name('reminders.stop');
        Route::get('/reminders/status', 'getReminderStatus')->name('reminders.status');
        Route::post('/update-pending-phones', 'updatePendingPhones')->name('update-pending-phones');
    });
    
    // Configuración del sistema
    Route::controller(\App\Http\Controllers\Admin\SettingsController::class)->group(function () {
        Route::get('/settings', 'index')->name('settings.index');
        Route::post('/settings/whatsapp', 'updateWhatsApp')->name('settings.whatsapp');
        Route::post('/settings/test-whatsapp', 'testWhatsAppConnection')->name('settings.test-whatsapp');
        Route::get('/settings/business-profile', 'getBusinessProfile')->name('settings.business-profile');
    });
    
    // Estadísticas
    Route::controller(StatisticsController::class)->prefix('statistics')->name('statistics.')->group(function () {
        Route::get('/', 'index')->name('index');
        Route::get('/export', 'export')->name('export');
    });
});

// Rutas para Admin y Asesores (Conversaciones y Plantillas)
Route::middleware(['auth', 'verified'])->prefix('admin')->name('admin.')->group(function () {
    // Conversaciones (WhatsApp) - Accesible para Admin y Asesores
    Route::controller(\App\Http\Controllers\ConversationController::class)->prefix('chat')->group(function () {
        Route::get('/', 'index')->name('chat.index');
        Route::get('/unread-count', 'getUnreadCount')->name('chat.unread-count');
        Route::get('/{conversation}', 'show')->name('chat.show');
        Route::post('/{conversation}/send', 'sendMessage')->name('chat.send');
        Route::post('/{conversation}/assign', 'assign')->name('chat.assign');
        Route::post('/{conversation}/status', 'updateStatus')->name('chat.status');
        Route::delete('/{conversation}/hide', 'hide')->name('chat.hide');
    });
    
    // Plantillas - Solo lectura para asesores
    Route::get('templates', [\App\Http\Controllers\Admin\TemplateController::class, 'index'])->name('templates.index');
});

// Webhook de WhatsApp (sin autenticación)
Route::controller(\App\Http\Controllers\WhatsAppWebhookController::class)->prefix('webhook')->group(function () {
    Route::get('/whatsapp', 'verify')->name('webhook.whatsapp.verify');
    Route::post('/whatsapp', 'handle')->name('webhook.whatsapp.handle');
});

// Webhook de Twilio - DESHABILITADO (solo usamos WhatsApp Business API de Meta)
// Route::controller(\App\Http\Controllers\TwilioWebhookController::class)->prefix('webhook')->group(function () {
//     Route::post('/twilio', 'handleIncoming')->name('webhook.twilio.incoming');
//     Route::post('/twilio/status', 'handleStatus')->name('webhook.twilio.status');
// });

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';