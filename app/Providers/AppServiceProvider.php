<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Avisos de tiempo real (Reverb) al crear o cambiar mensajes y conversaciones. Sin efecto si
        // BROADCAST_CONNECTION no es «reverb»; nunca lanza errores (ver App\Support\TiempoReal).
        \App\Support\TiempoReal::registrar();

        // Señal de vida del worker de la cola (la usa la vigilancia para no confundir un envío masivo largo con un worker
        // detenido). Solo dentro de queue:work.
        if ($this->app->runningInConsole()) {
            \App\Support\LatidoWorker::registrar();
        }

        // Contraseñas nuevas (usuarios creados o editados por un administrador y cambio desde Ajustes).
        \Illuminate\Validation\Rules\Password::defaults(
            fn () => \Illuminate\Validation\Rules\Password::min(5)->letters()->numbers()
        );

        $this->registrarAccesos();

        // También aquí (y no solo en bootstrap/app.php, que solo corre en peticiones web) para que
        // "php artisan down" guarde la excepción del webhook en su archivo de mantenimiento.
        \Illuminate\Foundation\Http\Middleware\PreventRequestsDuringMaintenance::except(['webhook/whatsapp']);

        // Teléfonos (últimos 4 dígitos) y textos de pacientes (solo su longitud) fuera de los logs.
        try {
            \Illuminate\Support\Facades\Log::driver()->pushProcessor(static function (\Monolog\LogRecord $record) {
                try {
                    return $record->with(context: \App\Support\LogRedactor::redact($record->context));
                } catch (\Throwable $e) {
                    return $record;
                }
            });
        } catch (\Throwable $e) {
            // Si el canal no admite procesadores, se registra como antes.
        }

        // Liberación automática de conversaciones sin respuesta del asesor: se revisa al
        // terminar cada petición web (como mucho una vez por minuto), porque en este servidor
        // no corre el programador de Laravel. Solo en peticiones web: en consola (tinker,
        // comandos, el worker de la cola) no debe dispararse sola.
        if (! $this->app->runningInConsole()) {
            $this->app->terminating(static function () {
                \App\Services\InactiveConversationReleaser::runIfDue();
                // Vigilancia del webhook, la cola y el disco (cada 10 minutos como mucho).
                \App\Services\WebhookWatchdog::runIfDue();
            });
        }
    }

    /**
     * Registro de inicios de sesión, intentos fallidos y bloqueos en storage/logs/accesos-*.log
     * (90 días). Antes no quedaba rastro de quién entraba ni de los intentos de adivinar contraseñas.
     */
    private function registrarAccesos(): void
    {
        $log = static fn () => \Illuminate\Support\Facades\Log::build([
            'driver' => 'daily',
            'path' => storage_path('logs/accesos.log'),
            'days' => 90,
        ]);
        $origen = static fn () => ['ip' => request()->ip(), 'navegador' => substr((string) request()->userAgent(), 0, 120)];

        \Illuminate\Support\Facades\Event::listen(\Illuminate\Auth\Events\Login::class, static function ($e) use ($log, $origen) {
            $log()->info('Inicio de sesión', ['user_id' => $e->user?->getAuthIdentifier(), 'email' => $e->user?->email, 'recordarme' => $e->remember] + $origen());
        });
        \Illuminate\Support\Facades\Event::listen(\Illuminate\Auth\Events\Failed::class, static function ($e) use ($log, $origen) {
            $log()->warning('Intento fallido', ['email' => substr((string) ($e->credentials['email'] ?? ''), 0, 120), 'user_id' => $e->user?->getAuthIdentifier()] + $origen());
        });
        \Illuminate\Support\Facades\Event::listen(\Illuminate\Auth\Events\Lockout::class, static function ($e) use ($log, $origen) {
            $log()->warning('Bloqueo por demasiados intentos', ['email' => substr((string) $e->request->input('email'), 0, 120)] + $origen());
        });
        \Illuminate\Support\Facades\Event::listen(\Illuminate\Auth\Events\Logout::class, static function ($e) use ($log, $origen) {
            $log()->info('Cierre de sesión', ['user_id' => $e->user?->getAuthIdentifier()] + $origen());
        });
    }
}
