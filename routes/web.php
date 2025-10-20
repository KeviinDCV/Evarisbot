<?php

use App\Http\Controllers\Admin\UserController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return redirect()->route('login');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        // Redirigir según el rol del usuario
        if (auth()->user()->isAdmin()) {
            return redirect()->route('admin.users.index');
        }
        
        // Para asesores, mostrar el dashboard normal (más adelante será el chat)
        return Inertia::render('dashboard');
    })->name('dashboard');
});

// Rutas del Administrador
Route::middleware(['auth', 'verified', 'role:admin'])->prefix('admin')->name('admin.')->group(function () {
    // Redirigir /admin a /admin/users
    Route::get('/', function () {
        return redirect()->route('admin.users.index');
    });
    
    Route::resource('users', UserController::class);
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';