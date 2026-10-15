<?php

use App\Http\Middleware\CheckBulkSendAccess;
use App\Http\Middleware\CheckRole;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\UpdateLastActivity;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
        // El webhook de WhatsApp va sin el grupo 'web' (sin sesión, cookies ni CSRF).
        then: function () {
            \Illuminate\Support\Facades\Route::group([], base_path('routes/webhook.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Solo el proxy local es de confianza: Tailscale (Funnel y :8443) entra por 127.0.0.1.
        // Con '*' cualquier equipo de la red inventaba su IP con X-Forwarded-For y se saltaba
        // el límite de intentos de inicio de sesión.
        $middleware->trustProxies(at: ['127.0.0.1', '::1']);

        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        // Con "php artisan down" la entrada de WhatsApp sigue recibiendo: si no, Meta recibe 503,
        // reintenta durante horas y los mensajes de los pacientes llegan con atraso.
        $middleware->preventRequestsDuringMaintenance(except: ['webhook/whatsapp']);

        // Excluir webhook de WhatsApp y endpoints de chat de la protección CSRF.
        // Todos protegidos por el middleware 'auth'. Los heartbeats de presencia
        // (viewing/typing) corren en setInterval y fallaban con 419 cuando el token
        // del <meta> quedaba stale tras rotar la sesión — no mutan estado sensible.
        $middleware->validateCsrfTokens(except: [
            'webhook/*',
            'admin/chat/*/send',
            'admin/chat/*/viewing',
            'admin/chat/*/typing',
            // Marcar-como-leído del chat interno: corre en polling frecuente y daba 419
            // cuando el token quedaba stale. No muta estado sensible (solo lee/marca leído).
            'admin/internal-chat/*/read',
        ]);

        $middleware->web(append: [
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
            UpdateLastActivity::class,
            SecurityHeaders::class,
            // Al cambiar la contraseña se cierran las demás sesiones y los "Recordarme" de ese usuario.
            \Illuminate\Session\Middleware\AuthenticateSession::class,
        ]);

        // Registrar middleware de roles
        $middleware->alias([
            'role' => CheckRole::class,
            'bulk-send' => CheckBulkSendAccess::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
