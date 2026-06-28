<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\SendBulkMessageJob;
use App\Models\BulkSend;
use App\Models\BulkSendRecipient;
use App\Models\Conversation;
use App\Models\WhatsappTemplate;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
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
                        // Reconciliar contadores desde recipients reales
                        $actualSent = $activeSend->recipients()->where('status', 'sent')->count();
                        $actualFailed = $activeSend->recipients()->where('status', 'failed')->count();

                        $activeSend->update([
                            'status' => $batch->cancelled() ? 'cancelled' : 'completed',
                            'sent_count' => $actualSent,
                            'failed_count' => $actualFailed,
                        ]);
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
                'category' => $t->category ?? 'UTILITY',
                'header_format' => $t->header_format,
                'header_media_url' => $t->header_media_url,
            ]);

        $allTemplates = WhatsappTemplate::orderByRaw("FIELD(status, 'PENDING', 'REJECTED', 'APPROVED', '') DESC")
            ->orderBy('name')
            ->get()
            ->map(fn($t) => [
                'id' => $t->id,
                'name' => $t->name,
                'meta_template_name' => $t->meta_template_name,
                'preview_text' => $t->preview_text,
                'language' => $t->language,
                'category' => $t->category ?? 'UTILITY',
                'status' => $t->status ?? 'APPROVED',
                'header_text' => $t->header_text,
                'footer_text' => $t->footer_text,
                'is_active' => $t->is_active,
                'created_at' => $t->created_at?->format('Y-m-d H:i'),
            ]);

        return Inertia::render('admin/bulk-sends/index', [
            'bulkSends' => $bulkSends,
            'activeProgress' => $activeProgress,
            'whatsappTemplates' => $whatsappTemplates,
            'allTemplates' => $allTemplates,
        ]);
    }

    /**
     * Buscar envíos masivos (incluye búsqueda en destinatarios)
     */
    public function search(Request $request)
    {
        $q = trim($request->input('q', ''));

        if ($q === '') {
            return response()->json([]);
        }

        // Buscar en destinatarios que coincidan
        $matchingRecipients = BulkSendRecipient::where('phone_number', 'like', "%{$q}%")
            ->orWhere('contact_name', 'like', "%{$q}%")
            ->orWhere('params', 'like', "%{$q}%")
            ->orWhere('error', 'like', "%{$q}%")
            ->limit(200)
            ->get()
            ->groupBy('bulk_send_id');

        // Buscar bulk sends que coincidan por metadata
        $metaMatchIds = BulkSend::where('name', 'like', "%{$q}%")
            ->orWhere('template_name', 'like', "%{$q}%")
            ->orWhere('status', 'like', "%{$q}%")
            ->orWhereHas('creator', fn($cq) => $cq->where('name', 'like', "%{$q}%"))
            ->pluck('id');

        $allIds = $matchingRecipients->keys()->merge($metaMatchIds)->unique();

        $bulkSends = BulkSend::with('creator')
            ->whereIn('id', $allIds)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(
            $bulkSends->map(function ($bs) use ($matchingRecipients) {
                $matched = $matchingRecipients->get($bs->id);
                return [
                    'id' => $bs->id,
                    'name' => $bs->name,
                    'template_name' => $bs->template_name,
                    'status' => $bs->status,
                    'total_recipients' => $bs->total_recipients,
                    'sent_count' => $bs->sent_count,
                    'failed_count' => $bs->failed_count,
                    'created_by_name' => $bs->creator?->name ?? 'Sistema',
                    'created_at' => $bs->created_at->format('Y-m-d H:i'),
                    'matching_recipients' => $matched ? $matched->map(fn($r) => [
                        'id' => $r->id,
                        'phone_number' => $r->phone_number,
                        'contact_name' => $r->contact_name,
                        'status' => $r->status,
                        'error' => $r->error,
                        'sent_at' => $r->sent_at?->format('Y-m-d H:i:s'),
                        'params' => $r->params,
                    ])->values()->toArray() : null,
                ];
            })
        );
    }

    /**
     * Mostrar detalle de un envío masivo con sus destinatarios
     */
    public function show(BulkSend $bulkSend)
    {
        $bulkSend->load('creator');

        // Reconciliar contadores si el envío ya está completado
        if ($bulkSend->status === 'completed') {
            $actualSent = $bulkSend->recipients()->where('status', 'sent')->count();
            $actualFailed = $bulkSend->recipients()->where('status', 'failed')->count();

            if ($actualSent !== $bulkSend->sent_count || $actualFailed !== $bulkSend->failed_count) {
                $bulkSend->update([
                    'sent_count' => $actualSent,
                    'failed_count' => $actualFailed,
                ]);
            }
        }

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
            } elseif ($extension === 'xlsx') {
                // XLSX: lector en streaming propio (ver readXlsxStreaming). Lee fila por
                // fila con XMLReader y se detiene al terminar los datos reales, ignorando
                // las filas fantasma que inflan el archivo (un .xlsx puede declarar más de
                // un millón de filas vacías → PhpSpreadsheet revienta la memoria/tarda
                // minutos). Esto es órdenes de magnitud más rápido y usa poca memoria,
                // produciendo EXACTAMENTE la misma salida de fechas/horas que antes.
                $rows = $this->readXlsxStreaming($filePath);
            } else {
                // XLS (formato binario antiguo, máx. 65.536 filas): PhpSpreadsheet con formato.
                $reader = IOFactory::createReader('Xls');
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

            // Desambiguar nombres de columna duplicados (ej: "fecha cita", "fecha cita (2)")
            $colNameCounts = [];
            foreach ($extraCols as $colIdx => $colName) {
                if (!isset($colNameCounts[$colName])) {
                    $colNameCounts[$colName] = 0;
                }
                $colNameCounts[$colName]++;
                if ($colNameCounts[$colName] > 1) {
                    $extraCols[$colIdx] = $colName . ' (' . $colNameCounts[$colName] . ')';
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
     * Lee un archivo .xlsx en streaming con XMLReader, fila por fila, deteniéndose en
     * cuanto terminan los datos reales (tras N filas vacías seguidas).
     *
     * Por qué: un .xlsx exportado puede declarar más de 1.000.000 de filas (rango usado
     * inflado con celdas fantasma). PhpSpreadsheet carga TODO en memoria (estilos
     * incluidos) → minutos de espera y consumo de memoria de varios GB. Aquí leemos solo
     * lo necesario: cadenas compartidas + formatos (ambos pequeños) y luego la hoja en
     * streaming sobre el wrapper zip:// (nunca se materializan los 186 MB de XML).
     *
     * Devuelve un array de filas (la primera fila es el encabezado). Las columnas de
     * fecha/hora se convierten a texto con EXACTAMENTE la misma lógica que antes, por lo
     * que la salida es idéntica a la de PhpSpreadsheet pero muchísimo más rápida.
     */
    private function readXlsxStreaming(string $path): array
    {
        $emptyRowLimit = 100; // nº de filas vacías seguidas que marcan el fin de los datos
        $zip = new \ZipArchive();
        if ($zip->open($path) !== true) {
            throw new \Exception('No se pudo abrir el archivo Excel.');
        }

        // 1) Tabla de cadenas compartidas (sharedStrings). Suele ser pequeña.
        $shared = [];
        $ssXml = $zip->getFromName('xl/sharedStrings.xml');
        if ($ssXml !== false && $ssXml !== '') {
            $sr = new \XMLReader();
            $sr->XML($ssXml);
            while ($sr->read()) {
                if ($sr->nodeType === \XMLReader::ELEMENT && $sr->localName === 'si') break;
            }
            while ($sr->nodeType === \XMLReader::ELEMENT && $sr->localName === 'si') {
                $node = $sr->readOuterXml();
                $txt = '';
                if (preg_match_all('/<t[^>]*>(.*?)<\/t>/s', $node, $mm)) {
                    foreach ($mm[1] as $piece) {
                        $txt .= html_entity_decode($piece, ENT_QUOTES | ENT_XML1, 'UTF-8');
                    }
                }
                $shared[] = $txt;
                $sr->next('si');
            }
            $sr->close();
        }

        // 2) Estilos → qué índice de estilo es un formato de fecha/hora.
        $styleIsDate = [];
        $stylesXml = $zip->getFromName('xl/styles.xml');
        if ($stylesXml !== false && $stylesXml !== '') {
            $sx = @simplexml_load_string($stylesXml);
            if ($sx !== false) {
                $numFmtMap = [];
                if (isset($sx->numFmts)) {
                    foreach ($sx->numFmts->numFmt as $nf) {
                        $numFmtMap[(int) $nf['numFmtId']] = (string) $nf['formatCode'];
                    }
                }
                if (isset($sx->cellXfs)) {
                    $idx = 0;
                    foreach ($sx->cellXfs->xf as $xf) {
                        $numFmtId = (int) $xf['numFmtId'];
                        $code = $numFmtMap[$numFmtId]
                            ?? \PhpOffice\PhpSpreadsheet\Style\NumberFormat::builtInFormatCode($numFmtId);
                        $styleIsDate[$idx] = ($code !== null && $code !== ''
                            && \PhpOffice\PhpSpreadsheet\Shared\Date::isDateTimeFormatCode((string) $code));
                        $idx++;
                    }
                }
            }
        }

        // 3) Localizar la primera hoja (casi siempre sheet1.xml).
        $sheetPath = 'xl/worksheets/sheet1.xml';
        if ($zip->locateName($sheetPath) === false) {
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $name = $zip->getNameIndex($i);
                if ($name !== false && preg_match('#^xl/worksheets/sheet[^/]+\.xml$#i', $name)) {
                    $sheetPath = $name;
                    break;
                }
            }
        }
        $zip->close();

        // 4) Hoja en streaming con XMLReader sobre zip:// (no se carga el XML completo).
        $timeColumnAliases = ['cithor', 'hora', 'hour', 'time', 'horario'];
        $headerNames = [];
        $maxCol = 0;
        $rows = [];
        $emptyRun = 0;
        $rowIndex = 0;

        $xr = new \XMLReader();
        if (!@$xr->open('zip://' . $path . '#' . $sheetPath)) {
            throw new \Exception('No se pudo leer la hoja del archivo Excel.');
        }
        // Avanzar hasta la primera <row>.
        while ($xr->read()) {
            if ($xr->nodeType === \XMLReader::ELEMENT && $xr->localName === 'row') break;
        }

        while ($xr->nodeType === \XMLReader::ELEMENT && $xr->localName === 'row') {
            $rowIndex++;
            $rowXml = $xr->readOuterXml();

            // Parsear las celdas (<c>) de la fila.
            $cells = [];
            $rowMaxCol = 0;
            if (preg_match_all('/<c\s+([^>]*?)(?:\/>|>(.*?)<\/c>)/s', $rowXml, $cm, PREG_SET_ORDER)) {
                foreach ($cm as $c) {
                    $attrs = $c[1];
                    $inner = $c[2] ?? '';
                    if (!preg_match('/r="([A-Z]+)\d+"/', $attrs, $rm)) continue;
                    $colIdx = $this->colLettersToIndex($rm[1]);
                    $t = preg_match('/t="([^"]+)"/', $attrs, $tm) ? $tm[1] : 'n';
                    $s = preg_match('/\ss="(\d+)"/', $attrs, $sm) ? (int) $sm[1] : 0;

                    if ($t === 'inlineStr') {
                        $val = preg_match('/<t[^>]*>(.*?)<\/t>/s', $inner, $vm)
                            ? html_entity_decode($vm[1], ENT_QUOTES | ENT_XML1, 'UTF-8') : '';
                    } else {
                        $raw = preg_match('/<v[^>]*>(.*?)<\/v>/s', $inner, $vm) ? $vm[1] : '';
                        if ($t === 's') {
                            $val = $shared[(int) $raw] ?? '';
                        } elseif ($t === 'str') {
                            $val = html_entity_decode($raw, ENT_QUOTES | ENT_XML1, 'UTF-8');
                        } else {
                            $val = $raw;
                        }
                    }
                    $cells[$colIdx] = ['t' => $t, 's' => $s, 'val' => $val];
                    if ($colIdx > $rowMaxCol) $rowMaxCol = $colIdx;
                }
            }

            // Fila 1 = encabezados: define columnas y detecta columnas de hora.
            if ($rowIndex === 1) {
                $maxCol = $rowMaxCol;
                for ($col = 1; $col <= $maxCol; $col++) {
                    $headerNames[$col] = strtolower(trim((string) ($cells[$col]['val'] ?? '')));
                }
                $rowData = [];
                for ($col = 1; $col <= $maxCol; $col++) {
                    $rowData[] = (string) ($cells[$col]['val'] ?? '');
                }
                $rows[] = $rowData;
                $xr->next('row');
                continue;
            }

            // Filas de datos.
            $rowData = [];
            $nonEmpty = false;
            for ($col = 1; $col <= $maxCol; $col++) {
                $cell = $cells[$col] ?? null;
                if ($cell === null) { $rowData[] = ''; continue; }
                $val = $cell['val'];
                $isText = in_array($cell['t'], ['s', 'str', 'inlineStr'], true);

                // Numérico con formato de fecha/hora → convertir (misma lógica de antes).
                if (!$isText && is_numeric($val) && (float) $val > 0 && ($styleIsDate[$cell['s']] ?? false)) {
                    try {
                        $dateObj = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject((float) $val);
                        $isTimeColumn = in_array($headerNames[$col] ?? '', $timeColumnAliases, true);
                        if ($isTimeColumn) {
                            $rowData[] = $dateObj->format('g:i A');
                        } elseif (fmod((float) $val, 1) > 0 && (float) $val < 1) {
                            $rowData[] = $dateObj->format('g:i A');
                        } elseif (fmod((float) $val, 1) > 0) {
                            $rowData[] = $dateObj->format('d/m/Y g:i A');
                        } else {
                            $rowData[] = $dateObj->format('d/m/Y');
                        }
                        $nonEmpty = true;
                        continue;
                    } catch (\Throwable $e) {
                        // Si falla la conversión, cae al valor de texto de abajo.
                    }
                }

                // Normalizar numéricos como (string)(float): "3001234567.0" -> "3001234567".
                $sval = ($cell['t'] === 'n' && is_numeric($val)) ? (string) (float) $val : (string) $val;
                $rowData[] = $sval;
                if (trim($sval) !== '') $nonEmpty = true;
            }

            if ($nonEmpty) {
                $rows[] = $rowData;
                $emptyRun = 0;
            } else {
                // Fila vacía: contar. Tras N seguidas, los datos terminaron → cortar.
                $emptyRun++;
                if ($emptyRun >= $emptyRowLimit) break;
            }
            $xr->next('row');
        }
        $xr->close();

        return $rows;
    }

    /** Convierte letras de columna de Excel (A, B, ..., AA, AB) a índice 1-based. */
    private function colLettersToIndex(string $letters): int
    {
        $n = 0;
        $len = strlen($letters);
        for ($i = 0; $i < $len; $i++) {
            $n = $n * 26 + (ord($letters[$i]) - 64);
        }
        return $n;
    }

    /**
     * Iniciar envío masivo
     */
    public function start(Request $request)
    {
        $request->validate([
            'template_name' => 'required|string|max:255',
            'template_params' => 'nullable|array',
            'column_mapping' => 'nullable|array',
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
                'column_mapping' => $request->input('column_mapping'),
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
                    if ($bs) {
                        // Reconciliar contadores desde los recipients reales
                        $actualSent = $bs->recipients()->where('status', 'sent')->count();
                        $actualFailed = $bs->recipients()->where('status', 'failed')->count();

                        $bs->update([
                            'status' => 'completed',
                            'sent_count' => $actualSent,
                            'failed_count' => $actualFailed,
                        ]);
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
                    // Reconciliar contadores desde recipients reales antes de marcar como completado
                    $actualSent = $activeSend->recipients()->where('status', 'sent')->count();
                    $actualFailed = $activeSend->recipients()->where('status', 'failed')->count();

                    $activeSend->update([
                        'status' => $batch->cancelled() ? 'cancelled' : 'completed',
                        'sent_count' => $actualSent,
                        'failed_count' => $actualFailed,
                    ]);

                    return response()->json([
                        'processing' => false,
                        'completed' => true,
                        'sent' => $actualSent,
                        'failed' => $actualFailed,
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

    /**
     * Crear plantilla y enviarla a Meta para revisión
     */
    public function createTemplate(Request $request)
    {
        $request->validate([
            'name' => ['required', 'string', 'max:512', 'regex:/^[a-z][a-z0-9_]*$/'],
            'category' => 'required|in:MARKETING,UTILITY,AUTHENTICATION',
            'language' => 'required|string|max:10',
            'header_format' => 'nullable|in:TEXT,IMAGE,VIDEO,DOCUMENT',
            'header_text' => 'nullable|string|max:60',
            'header_media_url' => 'nullable|url|max:2048',
            'body_text' => 'required|string|max:1024',
            'footer_text' => 'nullable|string|max:60',
            'display_name' => 'required|string|max:255',
        ], [
            'name.regex' => 'El nombre debe empezar con letra minúscula y solo contener letras minúsculas, números y guiones bajos.',
            'body_text.required' => 'El cuerpo del mensaje es obligatorio.',
            'header_media_url.url' => 'La URL del medio debe ser una URL válida.',
        ]);

        $businessAccountId = Setting::get('whatsapp_business_account_id');
        $token = Setting::get('whatsapp_token');

        if (!$businessAccountId || !$token) {
            return response()->json([
                'success' => false,
                'message' => 'WhatsApp API no está configurada. Configure Business Account ID y Token en Configuración.',
            ], 400);
        }

        // Check if template name already exists locally
        if (WhatsappTemplate::where('meta_template_name', $request->input('name'))->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Ya existe una plantilla con ese nombre técnico.',
            ], 422);
        }

        $components = [];

        $headerFormat = $request->input('header_format');
        if ($headerFormat === 'TEXT' && $request->filled('header_text')) {
            $components[] = [
                'type' => 'HEADER',
                'format' => 'TEXT',
                'text' => $request->input('header_text'),
            ];
        } elseif (in_array($headerFormat, ['IMAGE', 'VIDEO', 'DOCUMENT']) && $request->filled('header_media_url')) {
            $components[] = [
                'type' => 'HEADER',
                'format' => $headerFormat,
                'example' => [
                    'header_handle' => [$request->input('header_media_url')],
                ],
            ];
        }

        // Build body component with example params if needed
        $bodyText = $request->input('body_text');
        $bodyComponent = [
            'type' => 'BODY',
            'text' => $bodyText,
        ];

        // If body has parameters like {{1}}, {{2}}, add example values
        preg_match_all('/\{\{(\d+)\}\}/', $bodyText, $matches);
        if (!empty($matches[1])) {
            $exampleValues = array_map(fn($i) => "ejemplo{$i}", $matches[1]);
            $bodyComponent['example'] = [
                'body_text' => [$exampleValues],
            ];
        }
        $components[] = $bodyComponent;

        if ($request->filled('footer_text')) {
            $components[] = [
                'type' => 'FOOTER',
                'text' => $request->input('footer_text'),
            ];
        }

        try {
            $response = Http::withToken($token)
                ->timeout(30)
                ->connectTimeout(10)
                ->retry(2, 1000, fn ($e) => $e instanceof \Illuminate\Http\Client\ConnectionException, throw: false)
                ->post("https://graph.facebook.com/v21.0/{$businessAccountId}/message_templates", [
                    'name' => $request->input('name'),
                    'category' => $request->input('category'),
                    'language' => $request->input('language'),
                    'components' => $components,
                ]);

            if ($response->successful()) {
                $data = $response->json();

                $defaultParams = !empty($matches[1])
                    ? array_fill(0, count($matches[1]), '')
                    : null;

                WhatsappTemplate::create([
                    'name' => $request->input('display_name'),
                    'meta_template_name' => $request->input('name'),
                    'preview_text' => $bodyText,
                    'language' => $request->input('language'),
                    'category' => $request->input('category'),
                    'status' => $data['status'] ?? 'PENDING',
                    'meta_template_id' => $data['id'] ?? null,
                    'header_text' => $headerFormat === 'TEXT' ? $request->input('header_text') : null,
                    'header_format' => $headerFormat,
                    'header_media_url' => in_array($headerFormat, ['IMAGE', 'VIDEO', 'DOCUMENT']) ? $request->input('header_media_url') : null,
                    'footer_text' => $request->input('footer_text'),
                    'default_params' => $defaultParams,
                    'is_active' => false,
                ]);

                Log::info('Plantilla de WhatsApp enviada a revisión', [
                    'name' => $request->input('name'),
                    'category' => $request->input('category'),
                    'meta_id' => $data['id'] ?? null,
                    'status' => $data['status'] ?? 'PENDING',
                ]);

                return response()->json([
                    'success' => true,
                    'message' => 'Plantilla enviada a revisión en Meta exitosamente.',
                ]);
            }

            $errorData = $response->json();
            $errorMsg = $errorData['error']['message'] ?? 'Error desconocido';
            $errorUserMsg = $errorData['error']['error_user_msg'] ?? '';

            Log::error('Error creando plantilla en Meta', [
                'status' => $response->status(),
                'error' => $errorData,
            ]);

            return response()->json([
                'success' => false,
                'message' => "Error de Meta: {$errorMsg}" . ($errorUserMsg ? " — {$errorUserMsg}" : ''),
            ], 400);
        } catch (\Exception $e) {
            Log::error('Excepción al crear plantilla de WhatsApp', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al enviar plantilla: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Sincronizar estados de plantillas desde Meta
     */
    public function syncTemplates()
    {
        $businessAccountId = Setting::get('whatsapp_business_account_id');
        $token = Setting::get('whatsapp_token');

        if (!$businessAccountId || !$token) {
            return response()->json([
                'success' => false,
                'message' => 'WhatsApp API no está configurada.',
            ], 400);
        }

        try {
            $allMetaTemplates = [];
            $url = "https://graph.facebook.com/v21.0/{$businessAccountId}/message_templates?limit=100";

            // Paginate through all templates
            while ($url) {
                $response = Http::withToken($token)
                    ->timeout(30)
                    ->connectTimeout(10)
                    ->retry(3, 1500, fn ($e) => $e instanceof \Illuminate\Http\Client\ConnectionException, throw: false)
                    ->get($url);

                if (!$response->successful()) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Error al obtener plantillas de Meta: ' . ($response->json()['error']['message'] ?? 'Error desconocido'),
                    ], 400);
                }

                $data = $response->json();
                $allMetaTemplates = array_merge($allMetaTemplates, $data['data'] ?? []);
                $url = $data['paging']['next'] ?? null;
            }

            $updated = 0;
            $created = 0;

            foreach ($allMetaTemplates as $mt) {
                // Extraer info de componentes
                $components = $mt['components'] ?? [];
                $bodyText = null;
                $headerFormat = null;
                $headerText = null;
                $headerMediaUrl = null;
                $footerText = null;

                foreach ($components as $component) {
                    $type = $component['type'] ?? '';
                    if ($type === 'BODY') {
                        $bodyText = $component['text'] ?? null;
                    } elseif ($type === 'HEADER') {
                        $headerFormat = $component['format'] ?? null;
                        if ($headerFormat === 'TEXT') {
                            $headerText = $component['text'] ?? null;
                        }
                        // Para media headers, buscar el example handle
                        if (in_array($headerFormat, ['DOCUMENT', 'IMAGE', 'VIDEO'])) {
                            $headerMediaUrl = $component['example']['header_handle'][0] ?? null;
                        }
                    } elseif ($type === 'FOOTER') {
                        $footerText = $component['text'] ?? null;
                    }
                }

                $local = WhatsappTemplate::where('meta_template_name', $mt['name'])
                    ->where('language', $mt['language'])
                    ->first();

                if ($local) {
                    $updateData = [
                        'status' => $mt['status'],
                        'category' => $mt['category'] ?? $local->category,
                        'meta_template_id' => $mt['id'],
                        'is_active' => $mt['status'] === 'APPROVED',
                    ];

                    if ($headerFormat) {
                        $updateData['header_format'] = $headerFormat;
                    }
                    if ($headerText) {
                        $updateData['header_text'] = $headerText;
                    }
                    if ($headerMediaUrl) {
                        $updateData['header_media_url'] = $headerMediaUrl;
                    }
                    if ($footerText !== null) {
                        $updateData['footer_text'] = $footerText;
                    }
                    // Actualizar preview_text con el body de Meta (contiene los {{N}})
                    if ($bodyText) {
                        $updateData['preview_text'] = $bodyText;
                    }

                    $local->update($updateData);
                    $updated++;
                } else {
                    // Crear registro local para plantillas que solo existen en Meta
                    $defaultParams = null;
                    if ($bodyText) {
                        preg_match_all('/\{\{(\d+)\}\}/', $bodyText, $matches);
                        if (!empty($matches[1])) {
                            $defaultParams = array_fill(0, count($matches[1]), '');
                        }
                    }

                    WhatsappTemplate::create([
                        'name' => ucfirst(str_replace('_', ' ', $mt['name'])),
                        'meta_template_name' => $mt['name'],
                        'preview_text' => $bodyText,
                        'language' => $mt['language'],
                        'category' => $mt['category'] ?? 'UTILITY',
                        'status' => $mt['status'],
                        'meta_template_id' => $mt['id'],
                        'header_format' => $headerFormat,
                        'header_text' => $headerText,
                        'header_media_url' => $headerMediaUrl,
                        'footer_text' => $footerText,
                        'default_params' => $defaultParams,
                        'is_active' => $mt['status'] === 'APPROVED',
                    ]);
                    $created++;
                }
            }

            Log::info('Sincronización de plantillas completada', [
                'meta_count' => count($allMetaTemplates),
                'updated' => $updated,
                'created' => $created,
            ]);

            $msg = "Sincronización completada. {$updated} actualizada(s)";
            if ($created > 0) {
                $msg .= ", {$created} nueva(s) importada(s)";
            }
            $msg .= " de " . count($allMetaTemplates) . " en Meta.";

            return response()->json([
                'success' => true,
                'message' => $msg,
            ]);
        } catch (\Exception $e) {
            Log::error('Error sincronizando plantillas', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al sincronizar: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Eliminar plantilla de Meta y localmente
     */
    public function deleteTemplate(WhatsappTemplate $template)
    {
        $businessAccountId = Setting::get('whatsapp_business_account_id');
        $token = Setting::get('whatsapp_token');

        if ($businessAccountId && $token && $template->meta_template_name) {
            try {
                Http::withToken($token)
                    ->timeout(20)
                    ->connectTimeout(10)
                    ->retry(2, 1000, fn ($e) => $e instanceof \Illuminate\Http\Client\ConnectionException, throw: false)
                    ->delete("https://graph.facebook.com/v21.0/{$businessAccountId}/message_templates", [
                        'name' => $template->meta_template_name,
                    ]);
            } catch (\Exception $e) {
                Log::warning('Error eliminando plantilla de Meta (se eliminará localmente)', [
                    'error' => $e->getMessage(),
                    'template' => $template->meta_template_name,
                ]);
            }
        }

        $template->delete();

        return response()->json([
            'success' => true,
            'message' => 'Plantilla eliminada.',
        ]);
    }
}
