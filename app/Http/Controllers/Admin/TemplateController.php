<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Templates\SendTemplateRequest;
use App\Http\Requests\Templates\StoreTemplateRequest;
use App\Http\Requests\Templates\UpdateTemplateRequest;
use App\Models\Template;
use App\Models\User;
use App\Services\TemplateSendService;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Inertia\Inertia;

class TemplateController extends Controller
{
    public function __construct(
        private TemplateSendService $templateSendService
    ) {}

    /**
     * Procesa un archivo de imagen, convirtiendo WebP a PNG si es necesario.
     * WhatsApp Cloud API no soporta WebP, solo PNG y JPEG.
     */
    private function processImageFile(UploadedFile $file): array
    {
        $extension = strtolower($file->getClientOriginalExtension());
        $mimeType = $file->getMimeType();
        $originalName = $file->getClientOriginalName();
        
        // Si es WebP, convertir a PNG
        if ($extension === 'webp' || $mimeType === 'image/webp') {
            \Log::info('Convirtiendo imagen WebP a PNG', ['original' => $originalName]);
            
            // Crear imagen desde WebP
            $image = @imagecreatefromwebp($file->getRealPath());
            
            if ($image === false) {
                \Log::error('Error al leer imagen WebP', ['file' => $originalName]);
                throw new \Exception('No se pudo procesar la imagen WebP: ' . $originalName);
            }
            
            // Preservar transparencia
            imagesavealpha($image, true);
            
            // Generar nombre único para el archivo PNG
            $newFilename = pathinfo($originalName, PATHINFO_FILENAME) . '_' . time() . '.png';
            $tempPath = sys_get_temp_dir() . '/' . $newFilename;
            
            // Guardar como PNG
            $success = imagepng($image, $tempPath, 9); // 9 = máxima compresión
            imagedestroy($image);
            
            if (!$success) {
                \Log::error('Error al guardar imagen PNG', ['file' => $newFilename]);
                throw new \Exception('No se pudo convertir la imagen a PNG: ' . $originalName);
            }
            
            // Mover al storage
            $storagePath = 'templates/' . $newFilename;
            \Storage::disk('public')->put($storagePath, file_get_contents($tempPath));
            unlink($tempPath);
            
            \Log::info('Imagen WebP convertida exitosamente a PNG', [
                'original' => $originalName,
                'converted' => $newFilename
            ]);
            
            return [
                'url' => '/storage/' . $storagePath,
                'filename' => $newFilename,
                'type' => 'image',
            ];
        }
        
        // Para otros formatos, guardar normalmente
        $path = $file->store('templates', 'public');
        
        // Detectar tipo de archivo
        $type = 'document';
        if (in_array($extension, ['jpg', 'jpeg', 'png', 'gif'])) {
            $type = 'image';
        } elseif (in_array($extension, ['mp4', 'mov', 'avi', '3gp'])) {
            $type = 'video';
        }
        
        return [
            'url' => '/storage/' . $path,
            'filename' => $originalName,
            'type' => $type,
        ];
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Template::with(['creator', 'updater'])
            ->orderBy('created_at', 'desc');

        // Filtrar por estado activo/inactivo
        if ($request->has('status') && $request->status !== 'all') {
            $isActive = $request->status === 'active';
            $query->where('is_active', $isActive);
        }

        // Filtrar por tipo de mensaje
        if ($request->has('type') && $request->type !== 'all') {
            $query->where('message_type', $request->type);
        }

        // Búsqueda por nombre
        if ($request->has('search') && !empty($request->search)) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        $templates = $query->get()->map(function ($template) {
            return [
                'id' => $template->id,
                'name' => $template->name,
                'subject' => $template->subject,
                'content' => $template->content,
                'is_active' => $template->is_active,
                'message_type' => $template->message_type,
                'media_url' => $template->media_url,
                'media_filename' => $template->media_filename,
                'media_files' => $template->getMediaFilesArray(),
                'created_by' => $template->creator->name ?? 'N/A',
                'updated_by' => $template->updater->name ?? null,
                'created_at' => $template->created_at->format('Y-m-d H:i'),
                'updated_at' => $template->updated_at->format('Y-m-d H:i'),
                'usage_stats' => $template->getUsageStats(),
            ];
        });

        return Inertia::render('admin/templates/index', [
            'templates' => $templates,
            'filters' => [
                'status' => $request->status ?? 'all',
                'type' => $request->type ?? 'all',
                'search' => $request->search ?? '',
            ],
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        $users = User::select('id', 'name', 'role')->get();

        return Inertia::render('admin/templates/create', [
            'users' => $users,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreTemplateRequest $request)
    {
        $data = [
            'name' => $request->input('name'),
            'content' => $request->input('content'),
            'is_active' => $request->boolean('is_active', true),
            'is_global' => $request->boolean('is_global', true),
            'message_type' => 'text',
            'created_by' => auth()->id(),
            'updated_by' => auth()->id(),
        ];

        $mediaFiles = [];

        // Procesar múltiples archivos multimedia
        if ($request->hasFile('media_files')) {
            $files = $request->file('media_files');
            // Asegurar que sea un array
            if (!is_array($files)) {
                $files = [$files];
            }

            foreach ($files as $file) {
                try {
                    $mediaFiles[] = $this->processImageFile($file);
                } catch (\Exception $e) {
                    \Log::error('Error procesando archivo', [
                        'file' => $file->getClientOriginalName(),
                        'error' => $e->getMessage()
                    ]);
                    return back()->withErrors(['media_files' => $e->getMessage()]);
                }
            }
        }

        // Compatibilidad con el campo antiguo media_file (singular)
        if ($request->hasFile('media_file')) {
            $file = $request->file('media_file');
            try {
                $mediaFiles[] = $this->processImageFile($file);
            } catch (\Exception $e) {
                \Log::error('Error procesando archivo', [
                    'file' => $file->getClientOriginalName(),
                    'error' => $e->getMessage()
                ]);
                return back()->withErrors(['media_file' => $e->getMessage()]);
            }
        }

        if (!empty($mediaFiles)) {
            $data['media_files'] = $mediaFiles;
            // Para compatibilidad, guardar el primer archivo en los campos antiguos
            $data['media_url'] = $mediaFiles[0]['url'];
            $data['media_filename'] = $mediaFiles[0]['filename'];
            $data['message_type'] = $mediaFiles[0]['type'];
        }

        $template = Template::create($data);

        // Si no es global, asignar a los usuarios seleccionados
        if (!$request->boolean('is_global', true) && $request->has('assigned_users')) {
            $template->assignedUsers()->attach($request->input('assigned_users'));
        }

        return redirect()->route('admin.templates.index')
            ->with('success', 'Plantilla creada exitosamente.');
    }

    /**
     * Display the specified resource.
     */
    public function show(Template $template)
    {
        $template->load(['creator', 'updater', 'sends.sender']);

        return Inertia::render('admin/templates/show', [
            'template' => [
                'id' => $template->id,
                'name' => $template->name,
                'subject' => $template->subject,
                'content' => $template->content,
                'is_active' => $template->is_active,
                'message_type' => $template->message_type,
                'media_url' => $template->media_url,
                'media_filename' => $template->media_filename,
                'created_by' => $template->creator->name,
                'updated_by' => $template->updater->name ?? null,
                'created_at' => $template->created_at->format('Y-m-d H:i'),
                'updated_at' => $template->updated_at->format('Y-m-d H:i'),
                'usage_stats' => $template->getUsageStats(),
                'sends' => $template->sends->map(fn($send) => [
                    'id' => $send->id,
                    'sent_by' => $send->sender->name,
                    'total_recipients' => $send->total_recipients,
                    'successful_sends' => $send->successful_sends,
                    'failed_sends' => $send->failed_sends,
                    'status' => $send->status,
                    'sent_to_all' => $send->sent_to_all,
                    'created_at' => $send->created_at->format('Y-m-d H:i'),
                ]),
            ],
        ]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Template $template)
    {
        $users = User::select('id', 'name', 'role')->get();
        $assignedUsers = $template->assignedUsers()->pluck('user_id')->toArray();
        
        return Inertia::render('admin/templates/edit', [
            'template' => [
                'id' => $template->id,
                'name' => $template->name,
                'subject' => $template->subject,
                'content' => $template->content,
                'is_active' => $template->is_active,
                'is_global' => $template->is_global,
                'message_type' => $template->message_type,
                'media_url' => $template->media_url,
                'media_filename' => $template->media_filename,
                'media_files' => $template->getMediaFilesArray(),
                'assigned_users' => $assignedUsers,
            ],
            'users' => $users,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateTemplateRequest $request, Template $template)
    {
        $data = [
            'name' => $request->input('name'),
            'content' => $request->input('content'),
            'is_active' => $request->boolean('is_active'),
            'is_global' => $request->boolean('is_global'),
            'updated_by' => auth()->id(),
        ];

        // Obtener archivos existentes que se mantienen
        $existingFiles = $request->input('existing_media_files', []);
        $mediaFiles = is_array($existingFiles) ? $existingFiles : [];

        // Si se solicita eliminar todos los archivos multimedia
        if ($request->boolean('remove_media')) {
            // Eliminar archivos anteriores del storage
            $oldMediaFiles = $template->getMediaFilesArray();
            foreach ($oldMediaFiles as $oldFile) {
                if (!empty($oldFile['url'])) {
                    $oldPath = str_replace('/storage/', '', $oldFile['url']);
                    \Storage::disk('public')->delete($oldPath);
                }
            }
            $mediaFiles = [];
            $data['media_url'] = null;
            $data['media_filename'] = null;
            $data['message_type'] = 'text';
        }

        // Procesar nuevos archivos multimedia (múltiples)
        if ($request->hasFile('media_files')) {
            $files = $request->file('media_files');
            if (!is_array($files)) {
                $files = [$files];
            }

            foreach ($files as $file) {
                try {
                    $mediaFiles[] = $this->processImageFile($file);
                } catch (\Exception $e) {
                    \Log::error('Error procesando archivo en update', [
                        'file' => $file->getClientOriginalName(),
                        'error' => $e->getMessage()
                    ]);
                    return back()->withErrors(['media_files' => $e->getMessage()]);
                }
            }
        }

        // Compatibilidad con campo antiguo media_file (singular)
        if ($request->hasFile('media_file')) {
            $file = $request->file('media_file');
            try {
                $mediaFiles[] = $this->processImageFile($file);
            } catch (\Exception $e) {
                \Log::error('Error procesando archivo en update', [
                    'file' => $file->getClientOriginalName(),
                    'error' => $e->getMessage()
                ]);
                return back()->withErrors(['media_file' => $e->getMessage()]);
            }
        }

        // Actualizar campos de media
        if (!empty($mediaFiles)) {
            $data['media_files'] = $mediaFiles;
            // Para compatibilidad, guardar el primer archivo en los campos antiguos
            $data['media_url'] = $mediaFiles[0]['url'];
            $data['media_filename'] = $mediaFiles[0]['filename'];
            $data['message_type'] = $mediaFiles[0]['type'];
        } else {
            $data['media_files'] = null;
            $data['media_url'] = null;
            $data['media_filename'] = null;
            $data['message_type'] = 'text';
        }

        $template->update($data);

        // Sincronizar asignaciones de usuarios
        if ($request->boolean('is_global')) {
            // Si es global, eliminar todas las asignaciones
            $template->assignedUsers()->detach();
        } else {
            // Si no es global, sincronizar con los usuarios seleccionados
            $assignedUsers = $request->input('assigned_users', []);
            $template->assignedUsers()->sync($assignedUsers);
        }

        return redirect()->route('admin.templates.index')
            ->with('success', 'Plantilla actualizada exitosamente.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Template $template)
    {
        $template->delete();

        return redirect()->route('admin.templates.index')
            ->with('success', 'Plantilla eliminada exitosamente.');
    }

    /**
     * Toggle template active status.
     */
    public function toggleStatus(Template $template)
    {
        $template->toggleStatus();

        $message = $template->is_active 
            ? 'Plantilla activada exitosamente.' 
            : 'Plantilla desactivada exitosamente.';

        return back()->with('success', $message);
    }

    /**
     * Show send massive form.
     */
    public function sendForm(Template $template)
    {
        if (!$template->canBeUsed()) {
            return back()->with('error', 'La plantilla no está activa o no tiene contenido.');
        }

        $recipients = $this->templateSendService->getAvailableRecipients();

        return Inertia::render('admin/templates/send', [
            'template' => [
                'id' => $template->id,
                'name' => $template->name,
                'subject' => $template->subject,
                'content' => $template->content,
                'message_type' => $template->message_type,
            ],
            'recipients' => $recipients,
        ]);
    }

    /**
     * Send massive messages.
     */
    public function sendMassive(SendTemplateRequest $request, Template $template)
    {
        try {
            $templateSend = $this->templateSendService->initiateSend(
                $template,
                $request->input('recipient_ids', []),
                $request->boolean('send_to_all')
            );

            return redirect()->route('admin.templates.show', $template)
                ->with('success', 'Envío masivo iniciado. Se está procesando en segundo plano.');

        } catch (\Exception $e) {
            return back()->with('error', $e->getMessage());
        }
    }
}
