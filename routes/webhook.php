<?php

use App\Http\Controllers\WhatsAppWebhookController;
use App\Http\Middleware\VerifyMetaSignature;
use Illuminate\Support\Facades\Route;

// Webhook de WhatsApp (sin autenticación). Va fuera del grupo 'web' a propósito: Meta no maneja
// sesiones ni cookies, y dentro de 'web' cada aviso creaba una sesión nueva en la base.
Route::controller(WhatsAppWebhookController::class)->prefix('webhook')->group(function () {
    Route::get('/whatsapp', 'verify')->name('webhook.whatsapp.verify');
    Route::post('/whatsapp', 'handle')->middleware(VerifyMetaSignature::class)->name('webhook.whatsapp.handle');
});
