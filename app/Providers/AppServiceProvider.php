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
        // Liberación automática de conversaciones sin respuesta del asesor: se revisa al
        // terminar cada petición web (como mucho una vez por minuto), porque en este servidor
        // no corre el programador de Laravel. Solo en peticiones web: en consola (tinker,
        // comandos, el worker de la cola) no debe dispararse sola.
        if (! $this->app->runningInConsole()) {
            $this->app->terminating(static function () {
                \App\Services\InactiveConversationReleaser::runIfDue();
            });
        }
    }
}
