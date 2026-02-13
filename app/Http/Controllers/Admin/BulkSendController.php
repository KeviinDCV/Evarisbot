<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\SendBulkMessageJob;
use App\Models\BulkSend;
use App\Models\BulkSendRecipient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use PhpOffice\PhpSpreadsheet\IOFactory;

class BulkSendController extends Controller
{
    /**
     * Mostrar página de envíos masivos
     */
    public function index()
    {
        $bulkSends = BulkSend::with('creator')
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get()
            ->map(fn($bs) => [
                'id' => $bs->id,
                'name' => $bs->name,
                'template_name' => $bs->template_name,
                'status' => $bs->status,
                'total_recipients' => $bs->total_recipients,
                'sent_count' => $bs->sent_count,
                'failed_count' => $bs->failed_count,
                'created_by_name' => $bs->creator?->name ?? 'Sistema',
                'created_at' => $bs->created_at->format('Y-m-d H:i'),
            ]);

        // Verificar si hay un envío en proceso
        $activeSend = BulkSend::where('status', 'processing')->first();
        $activeProgress = null;

        if ($activeSend) {
            $activeProgress = [
                'id' => $activeSend->id,
                'name' => $activeSend->name,
                'template_name' => $activeSend->template_name,
                'total' => $activeSend->total_recipients,
                'sent' => $activeSend->sent_count,
                'failed' => $activeSend->failed_count,
                'pending' => max(0, $activeSend->total_recipients - $activeSend->sent_count - $activeSend->failed_count),
                'percentage' => $activeSend->total_recipients > 0
                    ? round(($activeSend->sent_count + $activeSend->failed_count) / $activeSend->total_recipients * 100)
                    : 0,
            ];

            // Verificar si el batch realmente terminó
            if ($activeSend->batch_id) {
                try {
                    $batch = Bus::findBatch($activeSend->batch_id);
                    if ($batch && ($batch->finished() || $batch->cancelled())) {
                        $activeSend->update(['status' => $batch->cancelled() ? 'cancelled' : 'completed']);
                        $activeProgress = null;
                    }
                } catch (\Exception $e) {
                    Log::warning('Error verificando batch de envío masivo', ['error' => $e->getMessage()]);
                }
            }
        }

        return Inertia::render('admin/bulk-sends/index', [
            'bulkSends' => $bulkSends,
            'activeProgress' => $activeProgress,
        ]);
    }

    /**
     * Subir archivo Excel con números de teléfono
     */
    public function upload(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls,csv|max:10240', // Max 10MB
        ]);

        try {
            $file = $request->file('file');
            $spreadsheet = IOFactory::load($file->getRealPath());
            $worksheet = $spreadsheet->getActiveSheet();
            $rows = $worksheet->toArray();

            // Detectar encabezados
            $headers = array_map('strtolower', array_map('trim', $rows[0] ?? []));
            $phoneCol = null;
            $nameCol = null;

            foreach ($headers as $i => $header) {
                $header = strtolower(trim($header));
                if (in_array($header, ['telefono', 'teléfono', 'phone', 'celular', 'cel', 'numero', 'número', 'pactel', 'phone_number'])) {
                    $phoneCol = $i;
                }
                if (in_array($header, ['nombre', 'name', 'contacto', 'paciente', 'nom_paciente', 'contact_name'])) {
                    $nameCol = $i;
                }
            }

            // Si no detectó columnas, asumir primera columna es teléfono
            if ($phoneCol === null) {
                $phoneCol = 0;
                $nameCol = count($headers) > 1 ? 1 : null;
            }

            $recipients = [];
            for ($i = 1; $i < count($rows); $i++) {
                $phone = trim($rows[$i][$phoneCol] ?? '');
                $name = $nameCol !== null ? trim($rows[$i][$nameCol] ?? '') : '';

                if (!empty($phone)) {
                    // Limpiar número
                    $cleanPhone = preg_replace('/[^0-9+]/', '', $phone);
                    if (strlen(preg_replace('/[^0-9]/', '', $cleanPhone)) >= 10) {
                        $recipients[] = [
                            'phone' => $cleanPhone,
                            'name' => $name,
                        ];
                    }
                }
            }

            // Eliminar duplicados por teléfono
            $unique = [];
            $seen = [];
            foreach ($recipients as $r) {
                $normalized = preg_replace('/[^0-9]/', '', $r['phone']);
                if (!isset($seen[$normalized])) {
                    $seen[$normalized] = true;
                    $unique[] = $r;
                }
            }

            return response()->json([
                'success' => true,
                'recipients' => $unique,
                'total' => count($unique),
                'filename' => $file->getClientOriginalName(),
            ]);
        } catch (\Exception $e) {
            Log::error('Error procesando archivo Excel para envío masivo', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al procesar el archivo: ' . $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Iniciar envío masivo
     */
    public function start(Request $request)
    {
        $request->validate([
            'template_name' => 'required|string|max:255',
            'template_params' => 'nullable|array',
            'name' => 'nullable|string|max:255',
            'recipients' => 'required|array|min:1',
            'recipients.*.phone' => 'required|string',
            'recipients.*.name' => 'nullable|string',
        ]);

        // Verificar que no haya un envío en proceso
        $activeCount = BulkSend::where('status', 'processing')->count();
        if ($activeCount > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Ya hay un envío masivo en proceso. Espere a que termine.',
            ], 400);
        }

        try {
            $recipients = $request->input('recipients');

            // Crear el registro de envío masivo
            $bulkSend = BulkSend::create([
                'name' => $request->input('name') ?: 'Envío ' . now()->format('Y-m-d H:i'),
                'template_name' => $request->input('template_name'),
                'template_params' => $request->input('template_params'),
                'status' => 'processing',
                'total_recipients' => count($recipients),
                'sent_count' => 0,
                'failed_count' => 0,
                'created_by' => auth()->id(),
            ]);

            // Crear registros de destinatarios
            $recipientRecords = [];
            foreach ($recipients as $r) {
                $recipientRecords[] = BulkSendRecipient::create([
                    'bulk_send_id' => $bulkSend->id,
                    'phone_number' => $r['phone'],
                    'contact_name' => $r['name'] ?? null,
                    'status' => 'pending',
                ]);
            }

            // Crear jobs para el batch
            $jobs = collect($recipientRecords)->map(function ($recipient) use ($bulkSend) {
                return new SendBulkMessageJob($recipient->id, $bulkSend->id);
            })->toArray();

            // Dispatch batch
            $batch = Bus::batch($jobs)
                ->name('Envío masivo: ' . ($bulkSend->name ?? $bulkSend->template_name))
                ->allowFailures()
                ->finally(function ($batch) use ($bulkSend) {
                    $bs = BulkSend::find($bulkSend->id);
                    if ($bs && $bs->status === 'processing') {
                        $bs->update(['status' => 'completed']);
                    }
                    Log::info('Batch de envío masivo completado', [
                        'bulk_send_id' => $bulkSend->id,
                        'batch_id' => $batch->id,
                    ]);
                })
                ->dispatch();

            $bulkSend->update(['batch_id' => $batch->id]);

            Log::info('Envío masivo iniciado', [
                'bulk_send_id' => $bulkSend->id,
                'batch_id' => $batch->id,
                'total_recipients' => count($recipients),
                'template' => $bulkSend->template_name,
            ]);

            return response()->json([
                'success' => true,
                'message' => "Envío masivo iniciado. Se enviarán " . count($recipients) . " mensajes en segundo plano.",
                'bulk_send_id' => $bulkSend->id,
                'total' => count($recipients),
            ]);
        } catch (\Exception $e) {
            Log::error('Error iniciando envío masivo', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al iniciar el envío: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Obtener estado del envío masivo activo
     */
    public function status()
    {
        $activeSend = BulkSend::where('status', 'processing')->first();

        if (!$activeSend) {
            return response()->json([
                'processing' => false,
            ]);
        }

        // Verificar si el batch terminó
        if ($activeSend->batch_id) {
            try {
                $batch = Bus::findBatch($activeSend->batch_id);
                if ($batch && ($batch->finished() || $batch->cancelled())) {
                    $activeSend->update(['status' => $batch->cancelled() ? 'cancelled' : 'completed']);
                    return response()->json([
                        'processing' => false,
                        'completed' => true,
                        'sent' => $activeSend->sent_count,
                        'failed' => $activeSend->failed_count,
                        'total' => $activeSend->total_recipients,
                    ]);
                }
            } catch (\Exception $e) {
                // Continue with local data
            }
        }

        return response()->json([
            'processing' => true,
            'id' => $activeSend->id,
            'name' => $activeSend->name,
            'template_name' => $activeSend->template_name,
            'total' => $activeSend->total_recipients,
            'sent' => $activeSend->sent_count,
            'failed' => $activeSend->failed_count,
            'pending' => max(0, $activeSend->total_recipients - $activeSend->sent_count - $activeSend->failed_count),
            'percentage' => $activeSend->total_recipients > 0
                ? round(($activeSend->sent_count + $activeSend->failed_count) / $activeSend->total_recipients * 100)
                : 0,
        ]);
    }

    /**
     * Cancelar envío masivo
     */
    public function cancel(BulkSend $bulkSend)
    {
        if ($bulkSend->status !== 'processing') {
            return response()->json([
                'success' => false,
                'message' => 'Este envío no está en proceso.',
            ], 400);
        }

        try {
            if ($bulkSend->batch_id) {
                $batch = Bus::findBatch($bulkSend->batch_id);
                if ($batch) {
                    $batch->cancel();
                }
            }

            $bulkSend->update(['status' => 'cancelled']);

            // Marcar destinatarios pendientes como cancelados
            BulkSendRecipient::where('bulk_send_id', $bulkSend->id)
                ->where('status', 'pending')
                ->update(['status' => 'failed', 'error' => 'Envío cancelado por el usuario']);

            return response()->json([
                'success' => true,
                'message' => 'Envío masivo cancelado.',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al cancelar: ' . $e->getMessage(),
            ], 500);
        }
    }
}
