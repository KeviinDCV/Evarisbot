<?php

use Illuminate\Support\Facades\Broadcast;

// Chat interno: cada usuario escucha solo su propio canal.
Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Avisos de conversaciones (App\Support\TiempoReal): solo personal con sesión. Llevan ids, no datos de pacientes, y
// la pantalla pide los datos por las rutas de siempre, que aplican los permisos de cada asesor.
Broadcast::channel('conversaciones', function ($user) {
    return $user->isAdmin() || $user->isAdvisor();
});
