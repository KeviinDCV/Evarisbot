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
        if (Auth::check()) {
            $userId = Auth::id();
            
            // Leer directamente de la BD para evitar problemas de cache de sesión
            $lastActivity = DB::table('users')
                ->where('id', $userId)
                ->value('last_activity_at');
            
            $shouldUpdate = false;
            
            if (!$lastActivity) {
                $shouldUpdate = true;
            } else {
                $lastActivityTime = \Carbon\Carbon::parse($lastActivity);
                $shouldUpdate = now()->diffInSeconds($lastActivityTime) > 60;
            }
            
            // Solo actualizar si han pasado más de 60 segundos desde la última actualización
            if ($shouldUpdate) {
                DB::table('users')
                    ->where('id', $userId)
                    ->update(['last_activity_at' => now()]);
            }
        }

        return $next($request);
    }
}
