<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;

class UserController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        // Chats abiertos de cada uno: la ventana de eliminar dice cuántos quedarían sin asignar.
        // Una sola consulta agrupada por el índice de assigned_to (~4 ms con 82.000 conversaciones).
        $abiertos = \App\Models\Conversation::query()
            ->whereNotNull('assigned_to')
            ->whereIn('status', \App\Services\InactiveConversationReleaser::OPEN_STATUSES)
            ->selectRaw('assigned_to, COUNT(*) as total')
            ->groupBy('assigned_to')
            ->pluck('total', 'assigned_to');

        // Plantillas no globales de cada uno: User::booted() las borra al eliminar la cuenta (también las que
        // asignó a otros asesores), y la ventana de eliminar lo avisa con su número.
        $plantillas = \App\Models\Template::query()
            ->where('is_global', false)
            ->whereNotNull('created_by')
            ->selectRaw('created_by, COUNT(*) as total')
            ->groupBy('created_by')
            ->pluck('total', 'created_by');

        $users = User::orderBy('created_at', 'desc')->get()->map(function ($user) use ($abiertos, $plantillas) {
            return [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'can_bulk_send' => (bool) $user->can_bulk_send,
                'is_on_duty' => (bool) $user->is_on_duty,
                'created_at' => $user->created_at,
                'is_online' => $user->isOnline(),
                'online_status' => $user->getOnlineStatus(),
                'last_activity_at' => $user->last_activity_at?->toISOString(),
                'chats_abiertos' => (int) ($abiertos[$user->id] ?? 0),
                'plantillas_propias' => (int) ($plantillas[$user->id] ?? 0),
            ];
        });

        return Inertia::render('admin/users/index', [
            'users' => $users,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => ['required', 'confirmed', Password::defaults()],
            'role' => 'required|in:admin,advisor',
        ]);

        User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'],
            'email_verified_at' => now(),
        ]);

        return redirect()->route('admin.users.index')
            ->with('success', 'Usuario creado exitosamente.');
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, User $user)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,' . $user->id,
            'role' => 'required|in:admin,advisor',
            'password' => ['nullable', 'confirmed', Password::defaults()],
        ]);

        // El propio rol no se cambia desde aquí: quien se quitara el rol de administrador perdería el
        // acceso a esta pantalla en el mismo guardado. Lo cambia otro administrador.
        if ($user->is($request->user())) {
            $validated['role'] = $user->role;
        }

        $data = [
            'name' => $validated['name'],
            'email' => $validated['email'],
            'role' => $validated['role'],
        ];
        // Los administradores ven todo y no van en equipos (Configuración → Equipos).
        if ($validated['role'] === 'admin') {
            $data['equipo_id'] = null;
        }

        if (!empty($validated['password'])) {
            $data['password'] = Hash::make($validated['password']);
        }

        $user->update($data);

        // Si cambió su propia contraseña, la sesión debe quedarse con el hash nuevo: AuthenticateSession guarda
        // el del usuario autenticado (otra instancia, con el hash viejo) al terminar la petición, y en la
        // siguiente cerraba la sesión. Settings/PasswordController no lo sufre porque cambia $request->user().
        if (isset($data['password']) && $user->is($request->user())) {
            $request->user()->forceFill(['password' => $user->password]);
        }

        return redirect()->route('admin.users.index')
            ->with('success', 'Usuario actualizado exitosamente.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(User $user)
    {
        // No permitir que el usuario se elimine a sí mismo
        if ($user->id === auth()->id()) {
            return redirect()->back()
                ->with('error', 'No puedes eliminar tu propia cuenta.');
        }

        $user->delete();

        return redirect()->back()
            ->with('success', 'Usuario eliminado exitosamente.');
    }

    /**
     * Toggle permiso de envío masivo para un usuario
     */
    public function toggleBulkSend(User $user)
    {
        $user->update(['can_bulk_send' => !$user->can_bulk_send]);

        return back()->with('success',
            $user->can_bulk_send
                ? "{$user->name} ahora tiene acceso a Envío masivo."
                : "Se removió el acceso a Envío masivo de {$user->name}."
        );
    }
}
