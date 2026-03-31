<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckBulkSendAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user->isAdmin() && !$user->can_bulk_send) {
            abort(403, 'No tienes permiso para acceder a Envío masivo.');
        }

        return $next($request);
    }
}
