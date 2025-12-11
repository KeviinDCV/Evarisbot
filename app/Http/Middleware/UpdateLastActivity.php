<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class UpdateLastActivity
{
    /**
     * Handle an incoming request.
     * Actualiza la última actividad del usuario cada 60 segundos máximo
     * para no sobrecargar la base de datos.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        
        // Ejecutar después del request para asegurar que la sesión esté lista
        if (Auth::check()) {
            $userId = Auth::id();
            
            // Usar cache en memoria para throttling (evitar múltiples queries por request)
            $cacheKey = 'user_last_activity_' . $userId;
            $lastUpdate = cache()->get($cacheKey);
            
            // Solo actualizar cada 60 segundos
            if (!$lastUpdate || now()->diffInSeconds($lastUpdate) > 60) {
                DB::table('users')
                    ->where('id', $userId)
                    ->update(['last_activity_at' => now()]);
                
                // Guardar en cache por 60 segundos
                cache()->put($cacheKey, now(), 120);
            }
        }

        return $response;
    }
}
