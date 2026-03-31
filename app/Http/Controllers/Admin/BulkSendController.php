<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\SendBulkMessageJob;
use App\Models\BulkSend;
use App\Models\BulkSendRecipient;
use App\Models\Conversation;
use App\Models\WhatsappTemplate;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
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

        $whatsappTemplates = WhatsappTemplate::active()
            ->orderBy('name')
            ->get()
            ->map(fn($t) => [
                'id' => $t->id,
                'name' => $t->name,
                'meta_template_name' => $t->meta_template_name,
                'preview_text' => $t->preview_text,
                'language' => $t->language,
                'default_params' => $t->default_params,
            ]);

        return Inertia::render('admin/bulk-sends/index', [
            'bulkSends' => $bulkSends,
            'activeProgress' => $activeProgress,
            'whatsappTemplates' => $whatsappTemplates,
        ]);
    }

    /**
     * Mostrar detalle de un envío masivo con sus destinatarios
     */
    public function show(BulkSend $bulkSend)
    {
        $bulkSend->load('creator');

        // Obtener preview_text del template
        $template = WhatsappTemplate::where('meta_template_name', $bulkSend->template_name)->first();

        $recipients = $bulkSend->recipients()
            ->orderByRaw("FIELD(status, 'failed', 'pending', 'sent')")
            ->orderBy('contact_name')
            ->get();

        // Buscar nombres de contactos en conversaciones para los que no tienen nombre
        $phonesWithoutName = $recipients->filter(fn($r) => empty($r->contact_name))->pluck('phone_number')->toArray();
        $contactNames = [];
        if (!empty($phonesWithoutName)) {
            $contactNames = Conversation::whereIn('phone_number', $phonesWithoutName)
                ->whereNotNull('contact_name')
                ->where('contact_name', '!=', '')
                ->pluck('contact_name', 'phone_number')
                ->toArray();
        }

        $recipients = $recipients->map(fn($r) => [
                'id' => $r->id,
                'phone_number' => $r->phone_number,
                'contact_name' => $r->contact_name ?: ($contactNames[$r->phone_number] ?? null),
                'params' => $r->params,
                'status' => $r->status,
                'error' => $r->error,
                'sent_at' => $r->sent_at?->format('Y-m-d H:i:s'),
            ]);

        return Inertia::render('admin/bulk-sends/show', [
            'bulkSend' => [
                'id' => $bulkSend->id,
                'name' => $bulkSend->name,
                'template_name' => $bulkSend->template_name,
                'template_preview' => $template?->preview_text,
                'status' => $bulkSend->status,
                'total_recipients' => $bulkSend->total_recipients,
                'sent_count' => $bulkSend->sent_count,
                'failed_count' => $bulkSend->failed_count,
                'created_by_name' => $bulkSend->creator?->name ?? 'Sistema',
                'created_at' => $bulkSend->created_at->format('Y-m-d H:i'),
            ],
            'recipients' => $recipients,
        ]);
    }

    /**
     * Subir archivo Excel con números de teléfono
     */
    public function upload(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls,csv',
        ], [
            'file.mimes' => 'El archivo debe ser de tipo: xlsx, xls o csv.',
            'file.required' => 'Debe seleccionar un archivo.',
        ]);

        try {
            set_time_limit(600);
            ini_set('memory_limit', '-1');

            $file = $request->file('file');
            $filePath = $file->getRealPath();
            $extension = strtolower($file->getClientOriginalExtension());

            Log::info('Inicio de carga de archivo para envío masivo', [
                'filename' => $file->getClientOriginalName(),
                'size_mb' => round($file->getSize() / 1024 / 1024, 2),
                'extension' => $extension,
            ]);

            $rows = [];

            if ($extension === 'csv') {
                // CSV: leer directamente con fgetcsv (ultra rápido, sin memoria)
                $handle = fopen($filePath, 'r');
                if ($handle === false) {
                    throw new \Exception('No se pudo abrir el archivo CSV');
                }
                while (($row = fgetcsv($handle, 0, ',', '"')) !== false) {
                    $rows[] = $row;
                }
                fclose($handle);
            } else {
                // Excel: leer con formato para que fechas/horas se conviertan correctamente
                $readerType = $extension === 'xls' ? 'Xls' : 'Xlsx';
                $reader = IOFactory::createReader($readerType);
                // NO usar setReadDataOnly(true) — destruye el formato de fechas/horas
                $spreadsheet = $reader->load($filePath);
                $worksheet = $spreadsheet->getActiveSheet();
                $highestRow = $worksheet->getHighestRow();
                $highestCol = $worksheet->getHighestColumn();
                $highestColIndex = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::columnIndexFromString($highestCol);

                // Leer encabezados primero para detectar columnas de hora
                $headerNames = [];
                for ($col = 1; $col <= $highestColIndex; $col++) {
                    $headerNames[$col] = strtolower(trim((string) ($worksheet->getCellByColumnAndRow($col, 1)->getValue() ?? '')));
                }
                // Nombres de columna que indican "solo hora"
                $timeColumnAliases = ['cithor', 'hora', 'hour', 'time', 'horario'];

                for ($row = 1; $row <= $highestRow; $row++) {
                    $rowData = [];
                    for ($col = 1; $col <= $highestColIndex; $col++) {
                        $cell = $worksheet->getCellByColumnAndRow($col, $row);
                        $value = $cell->getValue();

                        // Si es numérico y tiene formato de fecha/hora, convertir
                        if ($row > 1 && is_numeric($value) && $value > 0) {
                            $format = $cell->getStyle()->getNumberFormat()->getFormatCode();
                            if (\PhpOffice\PhpSpreadsheet\Shared\Date::isDateTimeFormatCode($format)) {
                                try {
                                    $dateObj = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject($value);
                                    $isTimeColumn = in_array($headerNames[$col] ?? '', $timeColumnAliases);

                                    if ($isTimeColumn) {
                                        // Columna de hora: siempre extraer solo la hora
                                        $rowData[] = $dateObj->format('g:i A');
                                    } elseif (fmod((float)$value, 1) > 0 && (float)$value < 1) {
                                        // Solo hora (valor < 1)
                                        $rowData[] = $dateObj->format('g:i A');
                                    } elseif (fmod((float)$value, 1) > 0) {
                                        // Fecha + hora
                                        $rowData[] = $dateObj->format('d/m/Y g:i A');
                                    } else {
                                        // Solo fecha
                                        $rowData[] = $dateObj->format('d/m/Y');
                                    }
                                    continue;
                                } catch (\Exception $e) {
                                    // Si falla la conversión, usar valor tal cual
                                }
                            }
                        }

                        $rowData[] = (string) ($value ?? '');
                    }
                    $rows[] = $rowData;
                }

                $spreadsheet->disconnectWorksheets();
                unset($spreadsheet, $reader, $worksheet);
            }

            if (count($rows) < 2) {
                return response()->json([
                    'success' => false,
                    'message' => 'El archivo está vacío o solo tiene encabezados.',
                ], 422);
            }

            // Detectar encabezados
            $rawHeaders = array_map('trim', $rows[0] ?? []);
            $headers = array_map('strtolower', $rawHeaders);
            $phoneCol = null;
            $nameCol = null;
            $extraCols = [];

            $phoneAliases = ['telefono', 'teléfono', 'phone', 'celular', 'cel', 'numero', 'número', 'pactel', 'phone_number'];
            $nameAliases = ['nombre', 'name', 'contacto', 'paciente', 'nom_paciente', 'contact_name', 'nom_pac', 'nombrepaciente', 'nombre_paciente', 'nombrepac', 'cliente', 'destinatario', 'usuario'];

            foreach ($headers as $i => $header) {
                $header = strtolower(trim($header));
                if (in_array($header, $phoneAliases)) {
                    $phoneCol = $i;
                } elseif (in_array($header, $nameAliases)) {
                    $nameCol = $i;
                } else if (!empty(trim($rawHeaders[$i] ?? ''))) {
                    $extraCols[$i] = strtolower(trim($rawHeaders[$i]));
                }
            }

            if ($phoneCol === null) {
                $phoneCol = 0;
                $nameCol = count($headers) > 1 ? 1 : null;
                $extraCols = [];
            }

            // Si encontramos teléfono pero no nombre, buscar por coincidencia parcial en columnas extra
            if ($phoneCol !== null && $nameCol === null && !empty($extraCols)) {
                $nameSubstrings = ['nombre', 'name', 'nom_', 'paciente', 'contacto', 'cliente'];
                foreach ($extraCols as $colIdx => $colName) {
                    foreach ($nameSubstrings as $sub) {
                        if (str_contains($colName, $sub)) {
                            $nameCol = $colIdx;
                            unset($extraCols[$colIdx]);
                            break 2;
                        }
                    }
                }
            }

            $seen = [];
            $unique = [];
            for ($i = 1; $i < count($rows); $i++) {
                $phone = trim((string) ($rows[$i][$phoneCol] ?? ''));
                $name = $nameCol !== null ? trim((string) ($rows[$i][$nameCol] ?? '')) : '';

                if (empty($phone)) continue;

                $cleanPhone = preg_replace('/[^0-9+]/', '', $phone);
                $digits = preg_replace('/[^0-9]/', '', $cleanPhone);
                if (strlen($digits) < 10) continue;

                if (isset($seen[$digits])) continue;
                $seen[$digits] = true;

                $recipient = [
                    'phone' => $cleanPhone,
                    'name' => $name,
                ];

                if (!empty($extraCols)) {
                    $params = [];
                    foreach ($extraCols as $colIdx => $colName) {
                        $params[$colName] = trim((string) ($rows[$i][$colIdx] ?? ''));
                    }
                    $recipient['params'] = $params;
                }

                $unique[] = $recipient;
            }

            unset($rows, $seen);

            return response()->json([
                'success' => true,
                'recipients' => $unique,
                'total' => count($unique),
                'filename' => $file->getClientOriginalName(),
                'extra_columns' => array_values($extraCols),
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
            'recipients.*.params' => 'nullable|array',
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
            set_time_limit(600);
            ini_set('memory_limit', '-1');

            $recipients = $request->input('recipients');

            // Buscar el idioma real del template
            $templateLang = 'es_CO'; // fallback
            $template = WhatsappTemplate::where('meta_template_name', $request->input('template_name'))->first();
            if ($template && $template->language) {
                $templateLang = $template->language;
            }

            // Reconectar para asegurar conexión fresca
            DB::reconnect();

            // Crear el registro de envío masivo
            $bulkSend = BulkSend::create([
                'name' => $request->input('name') ?: 'Envío ' . now()->format('Y-m-d H:i'),
                'template_name' => $request->input('template_name'),
                'template_params' => $request->input('template_params'),
                'template_language' => $templateLang,
                'status' => 'processing',
                'total_recipients' => count($recipients),
                'sent_count' => 0,
                'failed_count' => 0,
                'created_by' => auth()->id(),
            ]);

            // Insertar destinatarios en lotes de 200 para no sobrecargar MySQL
            $chunks = array_chunk($recipients, 200);
            foreach ($chunks as $chunk) {
                $rows = [];
                foreach ($chunk as $r) {
                    $rows[] = [
                        'bulk_send_id' => $bulkSend->id,
                        'phone_number' => $r['phone'],
                        'contact_name' => $r['name'] ?? null,
                        'params' => isset($r['params']) ? json_encode($r['params']) : null,
                        'status' => 'pending',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                }
                DB::reconnect();
                BulkSendRecipient::insert($rows);
            }

            // Obtener los IDs insertados
            DB::reconnect();
            $recipientIds = BulkSendRecipient::where('bulk_send_id', $bulkSend->id)
                ->pluck('id')
                ->toArray();

            // Crear el batch VACÍO primero (transacción pequeña)
            DB::reconnect();
            $batch = Bus::batch([])
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

            // Agregar jobs al batch en chunks pequeños (100 a la vez)
            $idChunks = array_chunk($recipientIds, 100);
            foreach ($idChunks as $idChunk) {
                DB::reconnect();
                $jobs = array_map(
                    fn($recipientId) => new SendBulkMessageJob($recipientId, $bulkSend->id),
                    $idChunk
                );
                $batch->add($jobs);
            }

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
