<?php

namespace App\Http\Controllers;

use App\Models\Template;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Plantillas personales: cada usuario crea las suyas y sólo él las ve.
 *
 * Por qué un controlador aparte y no Admin\TemplateController:
 * sus FormRequest exigen isAdmin() en authorize(), así que un asesor recibe 403 antes
 * de entrar al método. Relajar esa regla abriría también el CRUD del catálogo
 * institucional, que es justo lo que no debe pasar.
 *
 * Cómo se consigue que sean privadas, sin migración:
 * se reutiliza el mecanismo que ya existía sin usar — is_global = false más una fila en
 * el pivote template_user apuntando al autor. El desplegable del "/" ya consulta con
 * Template::active()->availableForUser(auth()->id()), que devuelve "las globales más las
 * asignadas a mí", así que la plantilla aparece sólo en el chat de su dueño sin tocar
 * esa consulta ni el catálogo compartido.
 *
 * Devuelve JSON a propósito, no respuestas Inertia: se invoca desde el chat, que es una
 * página con mucho estado en memoria, y un re-render completo al guardar arriesgaría el
 * scroll, la conversación abierta y los mensajes en vuelo.
 */
class PersonalTemplateController extends Controller
{
    /** Longitud máxima del nombre: se teclea tras la "/", conviene que sea corto. */
    private const MAX_NOMBRE = 60;

    /** Tope del cuerpo, holgado respecto a lo que admite un mensaje de WhatsApp. */
    private const MAX_CONTENIDO = 4096;

    public function store(Request $request): JsonResponse
    {
        $datos = $this->validar($request);

        $template = Template::create([
            'name' => $datos['name'],
            'content' => $datos['content'],
            'message_type' => 'text',
            'is_global' => false,
            // La columna es default(false) en la migración y el interruptor de activar
            // es admin-only. Sin forzarlo aquí, el asesor crearía su plantilla y no la
            // vería aparecer nunca en el "/", porque ese menú sólo trae las activas.
            'is_active' => true,
            'usage_count' => 0,
            'created_by' => auth()->id(),
            'updated_by' => auth()->id(),
        ]);

        // Sin esta fila availableForUser no la devuelve: is_global es false, así que la
        // única vía por la que el scope la encuentra es el pivote.
        $template->assignedUsers()->attach(auth()->id());

        return response()->json(['template' => $this->paraElChat($template)], 201);
    }

    public function update(Request $request, Template $template): JsonResponse
    {
        $this->soloSiEsMia($template);

        $datos = $this->validar($request, $template);

        $template->update([
            'name' => $datos['name'],
            'content' => $datos['content'],
            'updated_by' => auth()->id(),
        ]);

        return response()->json(['template' => $this->paraElChat($template->fresh())]);
    }

    public function destroy(Template $template): JsonResponse
    {
        $this->soloSiEsMia($template);

        // El pivote se limpia solo por la FK con onDelete cascade.
        $template->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * Devuelve las plantillas personales del usuario actual.
     * Sirve para refrescar el "/" sin recargar la página del chat.
     */
    public function index(): JsonResponse
    {
        $mias = Template::where('is_global', false)
            ->where('created_by', auth()->id())
            ->orderBy('name')
            ->get()
            ->map(fn ($t) => $this->paraElChat($t))
            ->values();

        return response()->json(['templates' => $mias]);
    }

    /**
     * Nadie toca lo de otro, ni el catálogo institucional.
     *
     * Se comprueba en el servidor porque el proyecto no tiene Policies ni Gates: la
     * autorización fina se hace a mano en los controladores, y esconder el botón en la
     * interfaz no protege de una petición hecha a mano.
     */
    private function soloSiEsMia(Template $template): void
    {
        if ($template->is_global) {
            abort(403, 'Las plantillas institucionales no se editan desde aquí.');
        }

        if ((int) $template->created_by !== (int) auth()->id()) {
            abort(403, 'Esa plantilla no es tuya.');
        }
    }

    private function validar(Request $request, ?Template $template = null): array
    {
        return $request->validate([
            'name' => [
                'required', 'string', 'max:'.self::MAX_NOMBRE,
                // El desplegable del "/" filtra sólo por nombre, así que dos plantillas
                // propias que se llamen igual serían indistinguibles al escribirlas.
                Rule::unique('templates', 'name')
                    ->where(fn ($q) => $q->where('created_by', auth()->id())->where('is_global', false))
                    ->ignore($template?->id),
            ],
            'content' => ['required', 'string', 'max:'.self::MAX_CONTENIDO],
        ], [
            'name.required' => 'Ponle un nombre corto para poder llamarla con "/".',
            'name.max' => 'El nombre no puede pasar de '.self::MAX_NOMBRE.' caracteres.',
            'name.unique' => 'Ya tienes una plantilla con ese nombre.',
            'content.required' => 'El texto de la plantilla no puede estar vacío.',
            'content.max' => 'El texto no puede pasar de '.number_format(self::MAX_CONTENIDO).' caracteres.',
        ]);
    }

    /** Misma forma que las plantillas que ya recibe el chat, más la marca de "mía". */
    private function paraElChat(Template $template): array
    {
        return [
            'id' => $template->id,
            'name' => $template->name,
            'content' => $template->content,
            'message_type' => $template->message_type,
            'media_url' => $template->media_url,
            'media_filename' => $template->media_filename,
            'media_files' => $template->getMediaFilesArray(),
            'is_personal' => true,
        ];
    }
}
