<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Inertia\Inertia;
use Inertia\Response;

class PasswordResetLinkController extends Controller
{
    /**
     * Show the password reset link request page.
     */
    public function create(Request $request): Response
    {
        // Recuperación de contraseña por correo desactivada: no hay correo configurado (MAIL_MAILER=log),
        // así que el enlace se escribía en el log del servidor, y el formulario servía para averiguar qué
        // correos tienen cuenta. Las contraseñas las restablece un administrador desde Usuarios.
        abort(404);

        return Inertia::render('auth/forgot-password', [
            'status' => $request->session()->get('status'),
        ]);
    }

    /**
     * Handle an incoming password reset link request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        // Recuperación de contraseña por correo desactivada: no hay correo configurado (MAIL_MAILER=log),
        // así que el enlace se escribía en el log del servidor, y el formulario servía para averiguar qué
        // correos tienen cuenta. Las contraseñas las restablece un administrador desde Usuarios.
        abort(404);

        $request->validate([
            'email' => 'required|email',
        ]);

        Password::sendResetLink(
            $request->only('email')
        );

        return back()->with('status', __('A reset link will be sent if the account exists.'));
    }
}
