<?php

use App\Http\Controllers\Admin\StatisticsController;
use App\Http\Controllers\Admin\TemplateController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Admin\WelcomeFlowController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return redirect()->route('login');
});

// Lightweight endpoint to refresh XSRF-TOKEN cookie (no body, no Inertia overhead)
Route::get('/csrf-refresh', fn () => response()->noContent());

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
    Route::post('users/{user}/toggle-bulk-send', [UserController::class, 'toggleBulkSend'])->name('users.toggle-bulk-send');
    
    // Plantillas para envíos masivos
    Route::resource('templates', TemplateController::class);
    Route::post('templates/{template}/toggle', [TemplateController::class, 'toggleStatus'])->name('templates.toggle');
    Route::get('templates/{template}/send-form', [TemplateController::class, 'sendForm'])->name('templates.send-form');
    Route::post('templates/{template}/send', [TemplateController::class, 'sendMassive'])->name('templates.send');
    
    // Flujos de bienvenida (menú automático)
    Route::post('welcome-flows', [WelcomeFlowController::class, 'store'])->name('welcome-flows.store');
    Route::put('welcome-flows/{welcomeFlow}', [WelcomeFlowController::class, 'update'])->name('welcome-flows.update');
    Route::delete('welcome-flows/{welcomeFlow}', [WelcomeFlowController::class, 'destroy'])->name('welcome-flows.destroy');
    Route::post('welcome-flows/{welcomeFlow}/toggle', [WelcomeFlowController::class, 'toggle'])->name('welcome-flows.toggle');
    
    // Gestión de Citas
    Route::controller(\App\Http\Controllers\AppointmentController::class)->prefix('appointments')->name('appointments.')->group(function () {
        Route::get('/', 'index')->name('index');
        Route::get('/view', 'view')->name('view');
        Route::get('/export', 'export')->name('export');
        Route::post('/upload', 'upload')->name('upload');
        Route::post('/process', 'process')->name('process');
        Route::post('/reminders/start', 'startReminders')->name('reminders.start');
        Route::post('/reminders/start-day-before', 'startRemindersDayBefore')->name('reminders.start-day-before');
        Route::post('/reminders/pause', 'pauseReminders')->name('reminders.pause');
        Route::post('/reminders/resume', 'resumeReminders')->name('reminders.resume');
        Route::post('/reminders/stop', 'stopReminders')->name('reminders.stop');
        Route::get('/reminders/status', 'getReminderStatus')->name('reminders.status');
        Route::post('/update-pending-phones', 'updatePendingPhones')->name('update-pending-phones');
    });
    
    // Gestión de Citas de Oncología
    Route::controller(\App\Http\Controllers\OncologyAppointmentController::class)->prefix('oncology-appointments')->name('oncology-appointments.')->group(function () {
        Route::get('/', 'index')->name('index');
        Route::get('/view', 'view')->name('view');
        Route::get('/export', 'export')->name('export');
        Route::post('/upload', 'upload')->name('upload');
        Route::post('/process', 'process')->name('process');
        Route::post('/reminders/start', 'startReminders')->name('reminders.start');
        Route::post('/reminders/start-day-before', 'startRemindersDayBefore')->name('reminders.start-day-before');
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
        Route::post('/settings/on-duty-advisors', 'updateOnDutyAdvisors')->name('settings.on-duty-advisors');
        Route::post('/settings/groq', 'updateGroq')->name('settings.groq');
    });
    
    // Estadísticas
    Route::controller(StatisticsController::class)->prefix('statistics')->name('statistics.')->group(function () {
        Route::get('/', 'index')->name('index');
        Route::get('/export', 'export')->name('export');
        Route::get('/advisor/{user}', 'advisorDetail')->name('advisor-detail');
    });
});

// Rutas para Admin y Asesores (Conversaciones y Plantillas)
Route::middleware(['auth', 'verified'])->prefix('admin')->name('admin.')->group(function () {
    // Envío Masivo - Accesible para Admin y asesores con permiso
    Route::controller(\App\Http\Controllers\Admin\BulkSendController::class)->prefix('bulk-sends')->name('bulk-sends.')->middleware('bulk-send')->group(function () {
        Route::get('/', 'index')->name('index');
        Route::get('/search', 'search')->name('search');
        Route::post('/upload', 'upload')->name('upload');
        Route::post('/start', 'start')->name('start');
        Route::get('/status', 'status')->name('status');
        Route::post('/templates/create', 'createTemplate')->name('templates.create');
        Route::post('/templates/sync', 'syncTemplates')->name('templates.sync');
        Route::delete('/templates/{template}', 'deleteTemplate')->name('templates.delete');
        Route::get('/{bulkSend}', 'show')->name('show');
        Route::post('/{bulkSend}/cancel', 'cancel')->name('cancel');
    });

    // Chat Interno - Accesible para todos los usuarios
    Route::controller(\App\Http\Controllers\Admin\InternalChatController::class)->prefix('internal-chat')->name('internal-chat.')->group(function () {
        Route::get('/', 'index')->name('index');          Route::get('/list', 'chatList')->name('list');        Route::get('/unread-count', 'unreadCount')->name('unread-count');
        Route::post('/create', 'create')->name('create');
        Route::get('/{chat}/messages', 'messages')->name('messages');
        Route::post('/{chat}/send', 'send')->name('send');
        Route::post('/{chat}/read', 'markRead')->name('read');
        Route::get('/{chat}/poll', 'poll')->name('poll');
        Route::put('/{chat}/rename', 'rename')->name('rename');          Route::get('/{chat}/read-receipts', 'readReceipts')->name('read-receipts');        Route::delete('/{chat}', 'destroy')->name('destroy');
        Route::post('/{chat}/participants', 'addParticipants')->name('participants.add');
        Route::delete('/{chat}/participants/{user}', 'removeParticipant')->name('participants.remove');
    });

    // Conversaciones (WhatsApp) - Accesible para Admin y Asesores
    Route::controller(\App\Http\Controllers\ConversationController::class)->prefix('chat')->group(function () {
        Route::get('/', 'index')->name('chat.index');
        Route::get('/unread-count', 'getUnreadCount')->name('chat.unread-count');
        Route::get('/poll-list', 'pollList')->name('chat.poll-list');
        Route::post('/create', 'store')->name('chat.store'); // Crear nueva conversación
        // Operaciones masivas
        Route::post('/bulk-assign', 'bulkAssign')->name('chat.bulk-assign');
        Route::post('/bulk-status', 'bulkUpdateStatus')->name('chat.bulk-status');
        
        Route::get('/{conversation}', 'show')->name('chat.show');
        Route::get('/{conversation}/poll-messages', 'pollMessages')->name('chat.poll-messages');
        Route::post('/{conversation}/send', 'sendMessage')->name('chat.send');
        Route::post('/{conversation}/send-template', 'sendWhatsappTemplate')->name('chat.send-template');
        Route::post('/{conversation}/assign', 'assign')->name('chat.assign');
        Route::post('/{conversation}/status', 'updateStatus')->name('chat.status');
        Route::delete('/{conversation}/hide', 'hide')->name('chat.hide');
        Route::post('/{conversation}/pin', 'togglePin')->name('chat.pin');
        Route::post('/{conversation}/notes', 'updateNotes')->name('chat.notes');
        Route::post('/{conversation}/specialty', 'updateSpecialty')->name('chat.specialty');
        Route::get('/{conversation}/activities', 'activities')->name('chat.activities');
        Route::post('/{conversation}/typing', 'typing')->name('chat.typing');
        Route::post('/{conversation}/viewing', 'viewing')->name('chat.viewing');
        Route::get('/{conversation}/export-pdf', 'exportPdf')->name('chat.export-pdf');
    });

    // Etiquetas de conversaciones
    Route::controller(\App\Http\Controllers\TagController::class)->prefix('tags')->name('tags.')->group(function () {
        Route::get('/', 'index')->name('index');
        Route::post('/', 'store')->name('store');
        Route::put('/{tag}', 'update')->name('update');
        Route::delete('/{tag}', 'destroy')->name('destroy');
        Route::get('/conversation/{conversation}', 'conversationTags')->name('conversation');
        Route::post('/conversation/{conversation}/attach', 'attach')->name('attach');
        Route::delete('/conversation/{conversation}/detach/{tag}', 'detach')->name('detach');
    });
    
    // Plantillas - Solo lectura para asesores
    Route::get('templates', [\App\Http\Controllers\Admin\TemplateController::class, 'index'])->name('templates.index');
});

// Webhook de WhatsApp (sin autenticación)
Route::controller(\App\Http\Controllers\WhatsAppWebhookController::class)->prefix('webhook')->group(function () {
    Route::get('/whatsapp', 'verify')->name('webhook.whatsapp.verify');
    Route::post('/whatsapp', 'handle')->name('webhook.whatsapp.handle');
});

// Descarga segura de archivos de media (requiere autenticación)
Route::get('/media/download', function (\Illuminate\Http\Request $request) {
    $path = $request->query('path');
    $name = $request->query('name');

    if (!$path) {
        abort(404);
    }

    // Sanitizar: solo permitir archivos dentro de whatsapp_media/
    $path = ltrim($path, '/');
    // Si viene como /storage/whatsapp_media/..., quitar el prefijo /storage/
    $path = preg_replace('#^storage/#', '', $path);

    if (!str_starts_with($path, 'whatsapp_media/') || str_contains($path, '..')) {
        abort(403);
    }

    if (!\Storage::disk('public')->exists($path)) {
        abort(404);
    }

    $fullPath = \Storage::disk('public')->path($path);
    $mimeType = mime_content_type($fullPath) ?: 'application/octet-stream';

    // Usar el nombre original si se proporcionó, si no usar el nombre del archivo
    $downloadName = $name ?: basename($path);

    return response()->file($fullPath, [
        'Content-Type' => $mimeType,
        'Content-Disposition' => 'attachment; filename="' . $downloadName . '"',
    ]);
})->middleware(['auth', 'verified'])->name('media.download');

// Webhook de Twilio - DESHABILITADO (solo usamos WhatsApp Business API de Meta)
// Route::controller(\App\Http\Controllers\TwilioWebhookController::class)->prefix('webhook')->group(function () {
//     Route::post('/twilio', 'handleIncoming')->name('webhook.twilio.incoming');
//     Route::post('/twilio/status', 'handleStatus')->name('webhook.twilio.status');
// });

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';