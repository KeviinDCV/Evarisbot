<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Templates\SendTemplateRequest;
use App\Http\Requests\Templates\StoreTemplateRequest;
use App\Http\Requests\Templates\UpdateTemplateRequest;
use App\Models\Template;
use App\Services\TemplateSendService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class TemplateController extends Controller
{
    public function __construct(
        private TemplateSendService $templateSendService
    ) {}

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
        return Inertia::render('admin/templates/create');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreTemplateRequest $request)
    {
        $template = Template::create([
            ...$request->validated(),
            'created_by' => auth()->id(),
        ]);

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
        return Inertia::render('admin/templates/edit', [
            'template' => [
                'id' => $template->id,
                'name' => $template->name,
                'subject' => $template->subject,
                'content' => $template->content,
                'is_active' => $template->is_active,
                'message_type' => $template->message_type,
                'media_url' => $template->media_url,
                'media_filename' => $template->media_filename,
            ],
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateTemplateRequest $request, Template $template)
    {
        $template->update([
            ...$request->validated(),
            'updated_by' => auth()->id(),
        ]);

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
