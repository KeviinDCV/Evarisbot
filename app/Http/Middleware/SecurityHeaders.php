<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Añade cabeceras de seguridad de defensa en profundidad a las respuestas web.
 *
 * Deliberadamente NO incluye:
 *  - Strict-Transport-Security (HSTS): la app también se sirve por HTTP en la LAN;
 *    forzar HTTPS rompería ese acceso.
 *  - Content-Security-Policy: app.blade.php usa un <script> de tema inline (evita el
 *    flash de tema) que requeriría nonce/hash; se deja para un endurecimiento posterior.
 *
 * X-Frame-Options usa DENY: la app no se embebe a sí misma en ningún lado (verificado: cero
 * iframe/embed/object/frame en resources/js y resources/views). Si algún día se añade una
 * previsualización embebida del mismo origen, habrá que bajarlo a SAMEORIGIN.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'same-origin');

        return $response;
    }
}
