<?php

namespace App\Http\Controllers;

use App\Models\Tag;
use App\Models\Conversation;
use Illuminate\Http\Request;

class TagController extends Controller
{
    /**
     * Listar todas las etiquetas
     */
    public function index()
    {
        return response()->json(
            Tag::withCount('conversations')->orderBy('name')->get()
        );
    }

    /**
     * Crear una etiqueta nueva
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'  => 'required|string|max:50|unique:tags,name',
            'color' => 'nullable|string|max:7',
        ]);

        $tag = Tag::create([
            'name'  => trim($validated['name']),
            'color' => $validated['color'] ?? '#6366f1',
        ]);

        return response()->json($tag, 201);
    }

    /**
     * Actualizar una etiqueta
     */
    public function update(Request $request, Tag $tag)
    {
        $validated = $request->validate([
            'name'  => 'required|string|max:50|unique:tags,name,' . $tag->id,
            'color' => 'nullable|string|max:7',
        ]);

        $tag->update([
            'name'  => trim($validated['name']),
            'color' => $validated['color'] ?? $tag->color,
        ]);

        return response()->json($tag);
    }

    /**
     * Eliminar una etiqueta
     */
    public function destroy(Tag $tag)
    {
        $tag->delete();
        return response()->json(['message' => 'Etiqueta eliminada']);
    }

    /**
     * Asignar una etiqueta a una conversación
     */
    public function attach(Request $request, Conversation $conversation)
    {
        $validated = $request->validate([
            'tag_id' => 'required|exists:tags,id',
        ]);

        $conversation->tags()->syncWithoutDetaching([$validated['tag_id']]);

        return response()->json(
            $conversation->tags()->get()
        );
    }

    /**
     * Quitar una etiqueta de una conversación
     */
    public function detach(Conversation $conversation, Tag $tag)
    {
        $conversation->tags()->detach($tag->id);

        return response()->json(
            $conversation->tags()->get()
        );
    }

    /**
     * Obtener etiquetas de una conversación
     */
    public function conversationTags(Conversation $conversation)
    {
        return response()->json(
            $conversation->tags()->get()
        );
    }
}
