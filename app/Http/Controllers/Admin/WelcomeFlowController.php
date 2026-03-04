<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\WelcomeFlow;
use Illuminate\Http\Request;

class WelcomeFlowController extends Controller
{
    /**
     * Crear o actualizar un flujo de bienvenida
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'message' => 'required|string',
            'buttons' => 'nullable|array|max:3', // WhatsApp permite máx 3 botones
            'buttons.*.id' => 'required|string|max:256',
            'buttons.*.title' => 'required|string|max:20', // WhatsApp límite 20 chars
            'responses' => 'nullable|array',
            'responses.*' => 'nullable|string',
            'is_active' => 'boolean',
            'trigger_type' => 'in:first_contact,every_new_conversation,always',
        ]);

        $validated['created_by'] = auth()->id();
        $validated['updated_by'] = auth()->id();

        // Si se activa, desactivar los demás
        if ($validated['is_active'] ?? false) {
            WelcomeFlow::where('is_active', true)->update(['is_active' => false]);
        }

        $flow = WelcomeFlow::create($validated);

        return back()->with('success', 'Flujo de bienvenida creado correctamente.');
    }

    /**
     * Actualizar un flujo de bienvenida existente
     */
    public function update(Request $request, WelcomeFlow $welcomeFlow)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'message' => 'required|string',
            'buttons' => 'nullable|array|max:3',
            'buttons.*.id' => 'required|string|max:256',
            'buttons.*.title' => 'required|string|max:20',
            'responses' => 'nullable|array',
            'responses.*' => 'nullable|string',
            'is_active' => 'boolean',
            'trigger_type' => 'in:first_contact,every_new_conversation,always',
        ]);

        $validated['updated_by'] = auth()->id();

        // Si se activa, desactivar los demás
        if ($validated['is_active'] ?? false) {
            WelcomeFlow::where('is_active', true)
                ->where('id', '!=', $welcomeFlow->id)
                ->update(['is_active' => false]);
        }

        $welcomeFlow->update($validated);

        return back()->with('success', 'Flujo de bienvenida actualizado correctamente.');
    }

    /**
     * Eliminar un flujo de bienvenida
     */
    public function destroy(WelcomeFlow $welcomeFlow)
    {
        $welcomeFlow->delete();
        return back()->with('success', 'Flujo de bienvenida eliminado.');
    }

    /**
     * Toggle activar/desactivar
     */
    public function toggle(WelcomeFlow $welcomeFlow)
    {
        $newState = !$welcomeFlow->is_active;

        // Si se activa, desactivar los demás
        if ($newState) {
            WelcomeFlow::where('is_active', true)
                ->where('id', '!=', $welcomeFlow->id)
                ->update(['is_active' => false]);
        }

        $welcomeFlow->update([
            'is_active' => $newState,
            'updated_by' => auth()->id(),
        ]);

        return back()->with('success', $newState ? 'Flujo activado.' : 'Flujo desactivado.');
    }
}
