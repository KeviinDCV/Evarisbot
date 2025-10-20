<?php

use App\Http\Controllers\Admin\UserController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return redirect()->route('login');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        // Redirigir según el rol del usuario
        if (auth()->user()->isAdmin()) {
            return redirect()->route('admin.users.index');
        }
        
        // Para asesores, mostrar el dashboard normal (más adelante será el chat)
        return Inertia::render('dashboard');
    })->name('dashboard');
});

// Rutas del Administrador
Route::middleware(['auth', 'verified', 'role:admin'])->prefix('admin')->name('admin.')->group(function () {
    // Redirigir /admin a /admin/users
    Route::get('/', function () {
        return redirect()->route('admin.users.index');
    });
    
    Route::resource('users', UserController::class);
    
    // Configuración del sistema
    Route::controller(\App\Http\Controllers\Admin\SettingsController::class)->group(function () {
        Route::get('/settings', 'index')->name('settings.index');
        Route::post('/settings/whatsapp', 'updateWhatsApp')->name('settings.whatsapp');
        Route::post('/settings/business', 'updateBusiness')->name('settings.business');
        Route::post('/settings/test-whatsapp', 'testWhatsAppConnection')->name('settings.test-whatsapp');
    });
    
    // Conversaciones (WhatsApp)
    Route::controller(\App\Http\Controllers\ConversationController::class)->prefix('chat')->group(function () {
        Route::get('/', 'index')->name('chat.index');
        Route::get('/{conversation}', 'show')->name('chat.show');
        Route::post('/{conversation}/send', 'sendMessage')->name('chat.send');
        Route::post('/{conversation}/assign', 'assign')->name('chat.assign');
        Route::post('/{conversation}/status', 'updateStatus')->name('chat.status');
    });
});

// Webhook de WhatsApp (sin autenticación)
Route::controller(\App\Http\Controllers\WhatsAppWebhookController::class)->prefix('webhook')->group(function () {
    Route::get('/whatsapp', 'verify')->name('webhook.whatsapp.verify');
    Route::post('/whatsapp', 'handle')->name('webhook.whatsapp.handle');
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';