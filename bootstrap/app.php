<?php

use App\Http\Middleware\CheckBulkSendAccess;
use App\Http\Middleware\CheckRole;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
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
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Confiar en proxies (cPanel/CloudFlare) para detectar HTTPS correctamente
        $middleware->trustProxies(at: '*');

        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        // Excluir webhook de WhatsApp y envío de mensajes de chat de la protección CSRF
        // El envío de mensajes ya está protegido por middleware 'auth'
        $middleware->validateCsrfTokens(except: [
            'webhook/*',
            'admin/chat/*/send',
        ]);

        $middleware->web(append: [
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
            UpdateLastActivity::class,
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
