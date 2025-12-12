<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use App\Models\Appointment;
use App\Models\Setting;
use App\Jobs\SendAppointmentReminderJob;
use App\Services\AppointmentReminderService;
use App\Exports\AppointmentsExport;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Bus;

class AppointmentController extends Controller
{
    /**
     * Mostrar la página de gestión de citas
     */
    public function index()
    {
        // Verificar y limpiar el estado de procesamiento si es necesario
        $reminderProcessing = Setting::get('reminder_processing', 'false') === 'true';
        if ($reminderProcessing) {
            $batchId = Setting::get('reminder_batch_id');
            if ($batchId) {
                try {
                    $batch = Bus::findBatch($batchId);
                    if (!$batch || $batch->finished() || $batch->cancelled()) {
                        Setting::set('reminder_processing', 'false');
                        Setting::set('reminder_paused', 'false'); // Limpiar estado pausado también
                        Setting::remove('reminder_batch_id');
                        $reminderProcessing = false;
                    }
                } catch (\Exception $e) {
                    Setting::set('reminder_processing', 'false');
                    Setting::set('reminder_paused', 'false'); // Limpiar estado pausado también
                    Setting::remove('reminder_batch_id');
                    $reminderProcessing = false;
                }
            } else {
                // No hay batch ID pero está marcado como processing, limpiar
                Setting::set('reminder_processing', 'false');
                Setting::set('reminder_paused', 'false'); // Limpiar estado pausado también
                $reminderProcessing = false;
            }
        } else {
            // Si no hay proceso activo, asegurar que el estado pausado también esté limpio
            Setting::set('reminder_paused', 'false');
            // Limpiar progreso guardado si no hay proceso activo
            Setting::remove('reminder_progress_sent');
            Setting::remove('reminder_progress_failed');
            Setting::remove('reminder_progress_total');
        }
        
        // Cargar las últimas 50 citas del usuario actual (más recientes primero)
        $appointments = Appointment::where('uploaded_by', auth()->id())
            ->orderBy('id', 'desc')
            ->limit(50)
            ->get()
            ->map(fn($apt) => [
                'id' => $apt->id,
                'citead' => $apt->citead,
                'nom_paciente' => $apt->nom_paciente,
                'pactel' => $apt->pactel,
                'citdoc' => $apt->citdoc,
                'citfc' => $apt->citfc?->format('Y-m-d'),
                'cithor' => $apt->cithor?->format('H:i'),
                'mednom' => $apt->mednom,
                'espnom' => $apt->espnom,
                'citcon' => $apt->citcon,
                'citobsobs' => $apt->citobsobs,
                'reminder_sent' => $apt->reminder_sent,
                'reminder_sent_at' => $apt->reminder_sent_at?->format('Y-m-d H:i'),
                'reminder_status' => $apt->reminder_status,
            ]);
        
        $totalAppointments = Appointment::where('uploaded_by', auth()->id())->count();
        
        // Obtener solo las citas pendientes de pasado mañana (2 días desde hoy)
        $daysInAdvance = (int) Setting::get('reminder_days_in_advance', '2');
        $targetDate = now()->addDays($daysInAdvance)->startOfDay();
        $targetDateString = $targetDate->format('Y-m-d');
        
        $pendingCount = Appointment::query()
            ->where('uploaded_by', auth()->id())
            ->whereDate('citfc', '=', $targetDateString)
            ->where('reminder_sent', false)
            ->whereNull('reminder_error') // Excluir las que ya fallaron permanentemente
            ->whereNotNull('citfc')
            ->whereNotNull('pactel')
            ->count();
        
        // Obtener citas pendientes para MAÑANA (1 día desde hoy) - para el botón "Enviar Día Antes"
        $tomorrowDate = now()->addDays(1)->startOfDay();
        $tomorrowDateString = $tomorrowDate->format('Y-m-d');
        
        $pendingTomorrowCount = Appointment::query()
            ->where('uploaded_by', auth()->id())
            ->whereDate('citfc', '=', $tomorrowDateString)
            ->where('reminder_sent', false)
            ->whereNull('reminder_error') // Excluir las que ya fallaron permanentemente
            ->whereNotNull('citfc')
            ->whereNotNull('pactel')
            ->count();
        
        $remindersStats = [
            'sent' => Appointment::where('uploaded_by', auth()->id())->where('reminder_sent', true)->count(),
            'pending' => $pendingCount,
            'pending_tomorrow' => $pendingTomorrowCount,
            'failed' => Appointment::where('uploaded_by', auth()->id())->where('reminder_status', 'failed')->count(),
        ];
        
        // Estado de recordatorios
        $reminderPaused = Setting::get('reminder_paused', 'false') === 'true';
        
        return Inertia::render('admin/appointments/index', [
            'appointments' => $appointments,
            'totalAppointments' => $totalAppointments,
            'remindersStats' => $remindersStats,
            'uploadedFile' => session('uploaded_file'),
            'reminderPaused' => $reminderPaused,
            'reminderProcessing' => $reminderProcessing,
        ]);
    }

    /**
     * Mostrar página dedicada con todas las citas y filtros
     */
    public function view(Request $request)
    {
        $query = Appointment::where('uploaded_by', auth()->id());
        
        // Aplicar filtro por estado de recordatorio
        $filter = $request->get('filter', 'all');
        if ($filter !== 'all') {
            if ($filter === 'pending') {
                $query->where('reminder_sent', false);
            } elseif ($filter === 'confirmed') {
                $query->where('reminder_status', 'confirmed');
            } elseif ($filter === 'cancelled') {
                $query->where('reminder_status', 'cancelled');
            }
        }
        
        // Filtro por fecha de cita
        $dateFrom = $request->get('date_from');
        $dateTo = $request->get('date_to');
        
        if ($dateFrom) {
            $query->whereDate('citfc', '>=', $dateFrom);
        }
        
        if ($dateTo) {
            $query->whereDate('citfc', '<=', $dateTo);
        }
        
        // Búsqueda
        $search = $request->get('search');
        if ($search) {
            $query->where(function($q) use ($search) {
                $q->where('nom_paciente', 'LIKE', "%{$search}%")
                  ->orWhere('citide', 'LIKE', "%{$search}%")
                  ->orWhere('pactel', 'LIKE', "%{$search}%")
                  ->orWhere('mednom', 'LIKE', "%{$search}%")
                  ->orWhere('espnom', 'LIKE', "%{$search}%");
            });
        }
        
        // Paginación
        $perPage = 20;
        $appointments = $query->orderBy('created_at', 'desc')
            ->paginate($perPage)
            ->through(fn($apt) => [
                'id' => $apt->id,
                'citead' => $apt->citead,
                'nom_paciente' => $apt->nom_paciente,
                'citide' => $apt->citide,
                'pactel' => $apt->pactel,
                'citdoc' => $apt->citdoc,
                'citfc' => $apt->citfc?->format('Y-m-d'),
                'cithor' => $apt->cithor?->format('H:i'),
                'mednom' => $apt->mednom,
                'espnom' => $apt->espnom,
                'citcon' => $apt->citcon,
                'citobsobs' => $apt->citobsobs,
                'reminder_sent' => $apt->reminder_sent,
                'reminder_sent_at' => $apt->reminder_sent_at?->format('Y-m-d H:i'),
                'reminder_status' => $apt->reminder_status,
            ]);
        
        // Estadísticas por filtro
        $stats = [
            'all' => Appointment::where('uploaded_by', auth()->id())->count(),
            'pending' => Appointment::where('uploaded_by', auth()->id())->where('reminder_sent', false)->count(),
            'confirmed' => Appointment::where('uploaded_by', auth()->id())->where('reminder_status', 'confirmed')->count(),
            'cancelled' => Appointment::where('uploaded_by', auth()->id())->where('reminder_status', 'cancelled')->count(),
        ];
        
        return Inertia::render('admin/appointments/view', [
            'appointments' => $appointments,
            'filter' => $filter,
            'search' => $search,
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'stats' => $stats,
        ]);
    }

    /**
     * Exportar citas a Excel con filtros aplicados
     */
    public function export(Request $request)
    {
        $query = Appointment::where('uploaded_by', auth()->id());
        
        // Aplicar filtro por estado de recordatorio
        $filter = $request->get('filter', 'all');
        if ($filter !== 'all') {
            if ($filter === 'pending') {
                $query->where('reminder_sent', false);
            } elseif ($filter === 'confirmed') {
                $query->where('reminder_status', 'confirmed');
            } elseif ($filter === 'cancelled') {
                $query->where('reminder_status', 'cancelled');
            }
        }
        
        // Filtro por fecha de cita
        $dateFrom = $request->get('date_from');
        $dateTo = $request->get('date_to');
        
        if ($dateFrom) {
            $query->whereDate('citfc', '>=', $dateFrom);
        }
        
        if ($dateTo) {
            $query->whereDate('citfc', '<=', $dateTo);
        }
        
        // Búsqueda
        $search = $request->get('search');
        if ($search) {
            $query->where(function($q) use ($search) {
                $q->where('nom_paciente', 'LIKE', "%{$search}%")
                  ->orWhere('citide', 'LIKE', "%{$search}%")
                  ->orWhere('pactel', 'LIKE', "%{$search}%")
                  ->orWhere('mednom', 'LIKE', "%{$search}%")
                  ->orWhere('espnom', 'LIKE', "%{$search}%");
            });
        }
        
        // Ordenar por fecha de creación
        $query->orderBy('created_at', 'desc');
        
        // Generar nombre del archivo
        $fileName = 'citas_' . now()->format('Y-m-d_His') . '.xlsx';
        
        // Exportar
        return Excel::download(new AppointmentsExport($query), $fileName);
    }

    /**
     * Subir archivo Excel con citas
     */
    public function upload(Request $request)
    {
        Log::info('=== INICIO SUBIDA DE ARCHIVO ===', [
            'user_id' => auth()->id(),
            'has_file' => $request->hasFile('file'),
            'all_files' => $request->allFiles(),
        ]);
        
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls,csv|max:10240', // Max 10MB
        ]);

        try {
            $file = $request->file('file');
            $originalName = $file->getClientOriginalName();
            $fileName = time() . '_' . $originalName;

            // Guardar archivo en storage/app/appointments
            $path = $file->storeAs('appointments', $fileName);
            $fullPath = Storage::path($path);

            // Procesar y guardar en BD
            $result = $this->processAndSaveExcel($fullPath);

            Log::info('Archivo de citas subido y procesado', [
                'filename' => $fileName,
                'path' => $path,
                'size' => $file->getSize(),
                'total_processed' => $result['processed'],
                'total_duplicates' => $result['duplicates'],
                'user_id' => auth()->id(),
            ]);

            // Construir mensaje de éxito con información de duplicados
            $successMessage = "Archivo subido exitosamente. Se procesaron {$result['processed']} citas.";
            if ($result['duplicates'] > 0) {
                $successMessage .= " Se omitieron {$result['duplicates']} citas porque ya estaban registradas.";
            }

            return redirect()->route('admin.appointments.index')->with([
                'success' => $successMessage,
                'uploaded_file' => [
                    'name' => $originalName,
                    'path' => $path,
                    'size' => $file->getSize(),
                    'uploaded_at' => now()->toDateTimeString(),
                    'total_rows' => $result['processed'],
                    'duplicates' => $result['duplicates'],
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Error al subir archivo de citas', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_id' => auth()->id(),
            ]);

            return redirect()->back()->withErrors([
                'file' => 'Error al subir el archivo: ' . $e->getMessage(),
            ]);
        }
    }

    /**
     * Procesar archivo Excel y guardar en BD
     * @return array{processed: int, duplicates: int}
     */
    private function processAndSaveExcel(string $filePath): array
    {
        try {
            // Aumentar límite de memoria a 2GB
            ini_set('memory_limit', '2048M');
            set_time_limit(600); // 10 minutos
            
            // Configurar PhpSpreadsheet para usar menos memoria
            $reader = IOFactory::createReaderForFile($filePath);
            $reader->setReadDataOnly(true);
            
            $spreadsheet = $reader->load($filePath);
            $worksheet = $spreadsheet->getActiveSheet();
            
            // Obtener el rango de datos para no cargar todo en memoria
            $highestRow = $worksheet->getHighestRow();
            $highestColumn = $worksheet->getHighestColumn();
            
            Log::info('Procesando Excel', [
                'total_rows' => $highestRow,
                'columns' => $highestColumn,
            ]);
            
            // Leer solo la primera fila (encabezados)
            $headers = $worksheet->rangeToArray('A1:' . $highestColumn . '1', null, true, false, false)[0];

            if (empty($headers)) {
                throw new \Exception('El archivo está vacío');
            }
            
            // Validar que contenga las columnas esperadas
            $expectedColumns = [
                'citead', 'cianom', 'citmed', 'mednom', 'citesp', 'espnom',
                'citfci', 'cithor', 'citdoc', 'nom_paciente', 'pactel', 'pacnac',
                'pachis', 'cittid', 'citide', 'citres', 'cittip', 'nom_cotizante',
                'citcon', 'connom', 'citurg', 'citobsobs', 'duracion', 'ageperdes_g', 'dia'
            ];

            // Log de headers encontrados
            Log::info('HEADERS DEL EXCEL', [
                'headers_originales' => $headers,
                'headers_procesados' => array_map('trim', array_map('strtolower', $headers))
            ]);
            
            // Mapear índices de columnas
            $columnIndexes = [];
            foreach ($expectedColumns as $column) {
                $index = array_search(trim(strtolower($column)), array_map('trim', array_map('strtolower', $headers)));
                if ($index !== false) {
                    $columnIndexes[$column] = $index;
                }
            }
            
            Log::info('COLUMNAS MAPEADAS', ['columns' => $columnIndexes]);

            // Procesar e insertar en BD por lotes
            $chunkSize = 100;
            $totalRows = $highestRow;
            $totalProcessed = 0;
            $totalDuplicates = 0;
            $batchData = [];
            
            for ($startRow = 2; $startRow <= $totalRows; $startRow += $chunkSize) {
                $endRow = min($startRow + $chunkSize - 1, $totalRows);
                
                // Leer chunk
                $chunk = $worksheet->rangeToArray(
                    'A' . $startRow . ':' . $highestColumn . $endRow,
                    null,
                    true,
                    false,
                    false
                );
                
                foreach ($chunk as $row) {
                    if (empty(array_filter($row))) {
                        continue;
                    }

                    $appointment = ['uploaded_by' => auth()->id()];
                    $rowDebug = [];
                    
                    foreach ($columnIndexes as $column => $index) {
                        $value = $row[$index] ?? null;
                        $rowDebug[$column] = $value;
                        
                        // Debug solo para la primera fila de datos
                        if ($totalProcessed === 0 && $totalDuplicates === 0 && $column === 'citfci') {
                            Log::info('PRIMERA FILA - CITFC DEBUG', [
                                'raw_value' => $value,
                                'is_numeric' => is_numeric($value),
                                'is_string' => is_string($value),
                                'is_empty' => empty($value),
                                'type' => gettype($value)
                            ]);
                        }
                        
                        // Procesar fechas
                        if ($column === 'citfci' && !empty($value)) {
                            if (is_numeric($value)) {
                                try {
                                    $value = Date::excelToDateTimeObject($value)->format('Y-m-d');
                                } catch (\Exception $e) {
                                    $value = null;
                                }
                            } elseif (is_string($value)) {
                                // Intentar parsear fecha en diferentes formatos
                                $originalValue = trim($value);
                                $parsedDate = null;
                                
                                // Formato AAAA/MM/DD (ej: 2025/12/14)
                                $date = \DateTime::createFromFormat('Y/m/d', $originalValue);
                                if ($date && $date->format('Y/m/d') === $originalValue) {
                                    $parsedDate = $date;
                                }
                                
                                // Formato DD/MM/AAAA (ej: 14/12/2025)
                                if (!$parsedDate) {
                                    $date = \DateTime::createFromFormat('d/m/Y', $originalValue);
                                    if ($date && $date->format('d/m/Y') === $originalValue) {
                                        $parsedDate = $date;
                                    }
                                }
                                
                                // Formato AAAA-MM-DD (ej: 2025-12-14)
                                if (!$parsedDate) {
                                    $date = \DateTime::createFromFormat('Y-m-d', $originalValue);
                                    if ($date && $date->format('Y-m-d') === $originalValue) {
                                        $parsedDate = $date;
                                    }
                                }
                                
                                $value = $parsedDate ? $parsedDate->format('Y-m-d') : null;
                                
                                // Solo log para primera fila
                                if ($totalProcessed === 0 && $totalDuplicates === 0) {
                                    Log::info('CITFC PARSEADO', [
                                        'original' => $originalValue,
                                        'parsed' => $value
                                    ]);
                                }
                            }
                        }
                        
                        // Procesar fecha de nacimiento
                        if ($column === 'pacnac') {
                            // Si es 0, vacío o inválido, convertir a null
                            if (empty($value) || $value === 0 || $value === '0') {
                                $value = null;
                            } elseif (is_numeric($value)) {
                                try {
                                    $value = Date::excelToDateTimeObject($value)->format('Y-m-d');
                                } catch (\Exception $e) {
                                    $value = null;
                                }
                            } elseif (is_string($value)) {
                                try {
                                    $date = \DateTime::createFromFormat('d/m/Y', $value);
                                    if ($date) {
                                        $value = $date->format('Y-m-d');
                                    } else {
                                        $value = null;
                                    }
                                } catch (\Exception $e) {
                                    $value = null;
                                }
                            }
                        }
                        
                        // Procesar hora - Excel usa números decimales para tiempo o texto
                        if ($column === 'cithor' && !empty($value)) {
                            if (is_numeric($value)) {
                                try {
                                    // Excel guarda tiempo como fracción del día
                                    $datetime = Date::excelToDateTimeObject($value);
                                    $value = $datetime->format('H:i:s');
                                } catch (\Exception $e) {
                                    $value = null;
                                }
                            } elseif (is_string($value)) {
                                // Intentar parsear hora en formato texto (ej: 04:30 PM, 16:30)
                                $originalTimeValue = trim($value);
                                $parsedTime = null;
                                
                                // Formato 12 horas con AM/PM (ej: 04:30 PM)
                                $time = \DateTime::createFromFormat('h:i A', strtoupper($originalTimeValue));
                                if ($time) {
                                    $parsedTime = $time;
                                }
                                
                                // Formato 12 horas con am/pm minúsculas
                                if (!$parsedTime) {
                                    $time = \DateTime::createFromFormat('h:i a', strtolower($originalTimeValue));
                                    if ($time) {
                                        $parsedTime = $time;
                                    }
                                }
                                
                                // Formato 24 horas (ej: 16:30)
                                if (!$parsedTime) {
                                    $time = \DateTime::createFromFormat('H:i', $originalTimeValue);
                                    if ($time) {
                                        $parsedTime = $time;
                                    }
                                }
                                
                                // Formato 24 horas con segundos (ej: 16:30:00)
                                if (!$parsedTime) {
                                    $time = \DateTime::createFromFormat('H:i:s', $originalTimeValue);
                                    if ($time) {
                                        $parsedTime = $time;
                                    }
                                }
                                
                                $value = $parsedTime ? $parsedTime->format('H:i:s') : null;
                                
                                // Solo log para primera fila
                                if ($totalProcessed === 0 && $totalDuplicates === 0) {
                                    Log::info('CITHOR PARSEADO', [
                                        'original' => $originalTimeValue,
                                        'parsed' => $value
                                    ]);
                                }
                            }
                        }
                        
                        // Mapear citfci a citfc para la BD
                        if ($column === 'citfci') {
                            $appointment['citfc'] = $value;
                        } else {
                            $appointment[$column] = $value;
                        }
                    }
                    
                    // Verificar si la cita ya existe (duplicado)
                    $isDuplicate = $this->isAppointmentDuplicate($appointment);
                    
                    // Log de la primera fila procesada para debug
                    if ($totalProcessed === 0 && $totalDuplicates === 0) {
                        Log::info('PRIMERA FILA COMPLETA', [
                            'raw_data' => $rowDebug,
                            'processed_appointment' => $appointment,
                            'is_duplicate' => $isDuplicate
                        ]);
                    }
                    
                    if ($isDuplicate) {
                        $totalDuplicates++;
                        continue; // Omitir esta cita
                    }
                    
                    $batchData[] = $appointment;
                    $totalProcessed++;
                    
                    // Insertar cada 100 registros
                    if (count($batchData) >= 100) {
                        DB::table('appointments')->insert($batchData);
                        $batchData = [];
                        gc_collect_cycles();
                    }
                }
                
                unset($chunk);
                
                if ($startRow % 1000 == 0) {
                    Log::info('Procesando...', ['filas' => $totalProcessed]);
                }
            }
            
            // Insertar registros restantes
            if (!empty($batchData)) {
                DB::table('appointments')->insert($batchData);
            }

            // Liberar memoria
            $spreadsheet->disconnectWorksheets();
            unset($spreadsheet, $worksheet, $batchData);
            gc_collect_cycles();
            
            Log::info('Procesamiento completado', [
                'processed' => $totalProcessed,
                'duplicates' => $totalDuplicates,
            ]);
            
            return [
                'processed' => $totalProcessed,
                'duplicates' => $totalDuplicates,
            ];
        } catch (\Exception $e) {
            Log::error('Error procesando archivo Excel', [
                'error' => $e->getMessage(),
                'file' => $filePath,
                'memory_used' => memory_get_peak_usage(true) / 1024 / 1024 . ' MB',
            ]);
            
            throw $e;
        }
    }

    /**
     * Verificar si una cita ya existe en la base de datos
     * Una cita se considera duplicada SOLO si TODOS los datos son exactamente iguales
     */
    private function isAppointmentDuplicate(array $appointment): bool
    {
        // Solo comparar con las citas del usuario actual
        $uploadedBy = $appointment['uploaded_by'] ?? auth()->id();
        
        // Campos a comparar para determinar duplicado (todos deben coincidir)
        $fieldsToCompare = [
            'citead', 'cianom', 'citmed', 'mednom', 'citesp', 'espnom',
            'citfc', 'cithor', 'citdoc', 'nom_paciente', 'pactel', 'pacnac',
            'pachis', 'cittid', 'citide', 'citres', 'cittip', 'nom_cotizante',
            'citcon', 'connom', 'citurg', 'citobsobs', 'duracion', 'ageperdes_g', 'dia'
        ];
        
        $query = DB::table('appointments')
            ->where('uploaded_by', $uploadedBy);
        
        // Comparar todos los campos
        foreach ($fieldsToCompare as $field) {
            $value = $appointment[$field] ?? null;
            
            if ($value === null || $value === '') {
                $query->where(function($q) use ($field) {
                    $q->whereNull($field)->orWhere($field, '');
                });
            } else {
                $query->where($field, $value);
            }
        }
        
        return $query->exists();
    }

    /**
     * Iniciar envío de recordatorios
     * Envía TODAS las citas pendientes respetando los límites de Meta
     */
    public function startReminders(Request $request)
    {
        try {
            // Verificar si ya está procesando
            $isProcessing = Setting::get('reminder_processing', 'false') === 'true';
            
            if ($isProcessing) {
                // Verificar si realmente hay un batch activo
                $batchId = Setting::get('reminder_batch_id');
                $hasActiveBatch = false;
                
                if ($batchId) {
                    // Verificar si el batch existe en la tabla job_batches
                    $batch = DB::table('job_batches')->where('id', $batchId)->first();
                    $hasActiveBatch = $batch && 
                                     !$batch->cancelled_at && 
                                     !$batch->finished_at;
                }
                
                // Si está marcado como procesando pero no hay batch activo, limpiar estado
                if (!$hasActiveBatch) {
                    Log::warning('Estado de procesamiento inconsistente detectado, limpiando automáticamente', [
                        'reminder_processing' => $isProcessing,
                        'reminder_batch_id' => $batchId,
                        'batch_exists' => $batch ?? null,
                    ]);
                    
                    Setting::set('reminder_processing', 'false');
                    Setting::set('reminder_paused', 'false');
                    Setting::remove('reminder_batch_id');
                    Setting::remove('reminder_progress_sent');
                    Setting::remove('reminder_progress_failed');
                    Setting::remove('reminder_progress_total');
                    
                    // Continuar con el proceso normalmente
                } else {
                    // Realmente hay un proceso activo
                    return response()->json([
                        'success' => false,
                        'message' => 'Ya hay un proceso de envío en curso'
                    ], 400);
                }
            }

            // Obtener configuración de días de anticipación
            // Por defecto 2 días: si hoy es 12/11, busca citas para 14/11 (pasado mañana)
            // Si se pasa en el request, usar ese valor (para envío 1 día antes)
            $daysInAdvance = $request->has('days_in_advance') 
                ? (int) $request->input('days_in_advance')
                : (int) Setting::get('reminder_days_in_advance', '2');
            
            // Límites de Meta WhatsApp Business API:
            // - Máximo 1,000 conversaciones iniciadas por día (24 horas)
            // - Rate limiting manejado por el middleware del Job (WithoutOverlapping)
            $maxPerDay = (int) Setting::get('reminder_max_per_day', '1000'); // Límite diario de Meta
            
            // Calcular fecha objetivo: pasado mañana (2 días desde hoy)
            $targetDate = now()->addDays($daysInAdvance)->startOfDay();
            $targetDateString = $targetDate->format('Y-m-d');
            
            // Obtener SOLO las citas de pasado mañana del usuario actual
            $appointments = Appointment::query()
                ->where('uploaded_by', auth()->id())
                ->whereDate('citfc', '=', $targetDateString)
                ->where('reminder_sent', false)
                ->whereNotNull('citfc')
                ->whereNotNull('pactel')
                ->orderBy('citfc', 'asc') // Ordenar por fecha de cita
                ->limit($maxPerDay) // Respetar límite diario de Meta
                ->pluck('id');
            
            Log::info('Iniciando envío de recordatorios masivos', [
                'user_id' => auth()->id(),
                'target_date' => $targetDateString,
                'current_date' => now()->format('Y-m-d'),
                'days_in_advance' => $daysInAdvance,
                'total_pending_appointments' => $appointments->count(),
                'max_per_day' => $maxPerDay
            ]);

            if ($appointments->isEmpty()) {
                $dateLabel = $daysInAdvance === 1 ? 'mañana' : ($daysInAdvance === 2 ? 'pasado mañana' : "en {$daysInAdvance} días");
                return response()->json([
                    'success' => false,
                    'message' => "No hay citas pendientes para enviar recordatorios para la fecha {$targetDateString} ({$dateLabel})."
                ], 400);
            }

            // Marcar como procesando
            Setting::set('reminder_processing', 'true');
            Setting::set('reminder_paused', 'false');

            $totalAppointments = $appointments->count();
            
            // Guardar progreso inicial
            Setting::set('reminder_progress_total', (string) $totalAppointments);
            Setting::set('reminder_progress_sent', '0');
            Setting::set('reminder_progress_failed', '0');
            
            // Validar límite diario de Meta (1000 conversaciones por día en Tier 1)
            if ($totalAppointments > $maxPerDay) {
                Log::warning('Advertencia: El volumen excede el límite diario de Meta', [
                    'total' => $totalAppointments,
                    'max_per_day' => $maxPerDay,
                    'message' => 'El sistema enviará todos los mensajes, pero Meta puede bloquear después de ' . $maxPerDay
                ]);
            }
            
            // =====================================================
            // PROCESAMIENTO ASÍNCRONO CON COLAS DE LARAVEL
            // Los jobs se procesan en segundo plano por el queue worker
            // La página sigue funcionando normalmente
            // =====================================================
            
            // Crear array de jobs para el batch
            $jobs = $appointments->map(function ($appointmentId) {
                return new SendAppointmentReminderJob($appointmentId);
            })->toArray();
            
            // Crear batch con callbacks para tracking
            $batch = Bus::batch($jobs)
                ->name('Recordatorios de citas - ' . now()->format('Y-m-d H:i'))
                ->allowFailures() // Permitir que algunos jobs fallen sin cancelar todo
                ->finally(function ($batch) {
                    // Limpiar estado cuando termine el batch
                    Setting::set('reminder_processing', 'false');
                    Setting::set('reminder_paused', 'false');
                    Setting::remove('reminder_batch_id');
                    
                    Log::info('Batch de recordatorios completado', [
                        'batch_id' => $batch->id,
                        'total_jobs' => $batch->totalJobs,
                        'pending_jobs' => $batch->pendingJobs,
                        'failed_jobs' => $batch->failedJobs,
                    ]);
                })
                ->dispatch();
            
            // Guardar ID del batch para tracking
            Setting::set('reminder_batch_id', $batch->id);
            
            Log::info('Batch de recordatorios creado', [
                'batch_id' => $batch->id,
                'total_jobs' => $totalAppointments
            ]);
            
            return response()->json([
                'success' => true,
                'message' => "Proceso iniciado. Se enviarán {$totalAppointments} recordatorios en segundo plano.",
                'total' => $totalAppointments,
                'batch_id' => $batch->id,
                'processing' => true
            ]);
        } catch (\Exception $e) {
            Setting::set('reminder_processing', 'false');
            
            Log::error('Error al iniciar recordatorios', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al iniciar el envío: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Iniciar envío de recordatorios 1 día antes (mañana)
     * Para citas que no se enviaron a tiempo (2 días antes)
     */
    public function startRemindersDayBefore(Request $request)
    {
        // Usar el mismo método pero con 1 día de anticipación
        $request->merge(['days_in_advance' => 1]);
        return $this->startReminders($request);
    }

    /**
     * Pausar envío de recordatorios
     */
    public function pauseReminders()
    {
        try {
            Setting::set('reminder_paused', 'true');
            
            Log::info('Recordatorios pausados manualmente', [
                'user_id' => auth()->id()
            ]);

            return response()->json([
                'success' => true,
                'message' => 'El envío de recordatorios ha sido pausado'
            ]);
        } catch (\Exception $e) {
            Log::error('Error al pausar recordatorios', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al pausar: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Reanudar envío de recordatorios
     */
    public function resumeReminders()
    {
        try {
            Setting::set('reminder_paused', 'false');
            
            Log::info('Recordatorios reanudados manualmente', [
                'user_id' => auth()->id()
            ]);

            return response()->json([
                'success' => true,
                'message' => 'El envío de recordatorios ha sido reanudado'
            ]);
        } catch (\Exception $e) {
            Log::error('Error al reanudar recordatorios', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al reanudar: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Detener completamente el envío de recordatorios
     */
    public function stopReminders()
    {
        try {
            // Cancelar el batch si existe
            $batchId = Setting::get('reminder_batch_id');
            if ($batchId) {
                try {
                    $batch = Bus::findBatch($batchId);
                    if ($batch && !$batch->cancelled()) {
                        $batch->cancel();
                        Log::info('Batch de recordatorios cancelado', [
                            'batch_id' => $batchId,
                            'user_id' => auth()->id()
                        ]);
                    }
                } catch (\Exception $e) {
                    Log::warning('No se pudo cancelar el batch', [
                        'batch_id' => $batchId,
                        'error' => $e->getMessage()
                    ]);
                }
            }
            
            // Marcar como detenido
            Setting::set('reminder_paused', 'true');
            Setting::set('reminder_processing', 'false');
            Setting::remove('reminder_batch_id');
            Setting::remove('reminder_progress_sent');
            Setting::remove('reminder_progress_failed');
            Setting::remove('reminder_progress_total');
            
            Log::info('Recordatorios detenidos completamente', [
                'user_id' => auth()->id()
            ]);

            return response()->json([
                'success' => true,
                'message' => 'El envío de recordatorios ha sido detenido completamente'
            ]);
        } catch (\Exception $e) {
            Log::error('Error al detener recordatorios', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al detener: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Actualizar número de teléfono de citas pendientes (modo prueba)
     */
    public function updatePendingPhones(Request $request)
    {
        $request->validate([
            'phone_number' => 'required|string|max:20',
        ]);

        try {
            $phoneNumber = $request->input('phone_number');
            
            // Obtener configuración
            $daysInAdvance = (int) Setting::get('reminder_days_in_advance', '2');
            $targetDate = now()->addDays($daysInAdvance)->startOfDay();
            $targetDateString = $targetDate->format('Y-m-d');
            
            // Actualizar solo las citas pendientes del usuario actual para la fecha objetivo
            $updated = Appointment::query()
                ->where('uploaded_by', auth()->id())
                ->whereDate('citfc', '=', $targetDateString)
                ->where('reminder_sent', false)
                ->whereNotNull('citfc')
                ->update(['pactel' => $phoneNumber]);
            
            Log::info('Números de teléfono actualizados para pruebas', [
                'user_id' => auth()->id(),
                'phone_number' => $phoneNumber,
                'target_date' => $targetDateString,
                'updated_count' => $updated
            ]);

            return response()->json([
                'success' => true,
                'message' => "Se actualizaron {$updated} números de teléfono para la fecha {$targetDateString}",
                'updated_count' => $updated,
                'phone_number' => $phoneNumber
            ]);
        } catch (\Exception $e) {
            Log::error('Error al actualizar números de teléfono', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener estado del proceso de recordatorios con progreso en tiempo real
     * Optimizado para ser rápido y limpiar estado incorrecto
     */
    public function getReminderStatus()
    {
        // Leer directamente de BD sin caché para ser más rápido
        $paused = DB::table('settings')->where('key', 'reminder_paused')->value('value') === 'true';
        $processing = DB::table('settings')->where('key', 'reminder_processing')->value('value') === 'true';
        
        // Obtener progreso guardado sin caché para tener valores actualizados en tiempo real
        $progressSent = (int) DB::table('settings')->where('key', 'reminder_progress_sent')->value('value') ?? 0;
        $progressFailed = (int) DB::table('settings')->where('key', 'reminder_progress_failed')->value('value') ?? 0;
        $progressTotal = (int) DB::table('settings')->where('key', 'reminder_progress_total')->value('value') ?? 0;
        
        // Verificar si realmente hay un proceso corriendo
        if ($processing) {
            $batchId = DB::table('settings')->where('key', 'reminder_batch_id')->value('value');
            if ($batchId) {
                try {
                    $batch = \Illuminate\Support\Facades\Bus::findBatch($batchId);
                    if (!$batch || $batch->finished() || $batch->cancelled()) {
                        // El batch terminó pero el estado quedó como "processing", limpiarlo
                        DB::table('settings')->where('key', 'reminder_processing')->update(['value' => 'false']);
                        DB::table('settings')->where('key', 'reminder_batch_id')->delete();
                        DB::table('settings')->whereIn('key', ['reminder_progress_sent', 'reminder_progress_failed', 'reminder_progress_total'])->delete();
                        Cache::forget('setting.reminder_processing');
                        Cache::forget('setting.reminder_batch_id');
                        $processing = false;
                        $progressSent = 0;
                        $progressFailed = 0;
                        $progressTotal = 0;
                    } else {
                        // Batch activo: obtener progreso directamente del batch de Laravel (más preciso)
                        $progressTotal = $batch->totalJobs;
                        $progressSent = $batch->processedJobs() - $batch->failedJobs;
                        $progressFailed = $batch->failedJobs;
                    }
                } catch (\Exception $e) {
                    // Si no se puede encontrar el batch, limpiar estado
                    DB::table('settings')->where('key', 'reminder_processing')->update(['value' => 'false']);
                    DB::table('settings')->where('key', 'reminder_batch_id')->delete();
                    DB::table('settings')->whereIn('key', ['reminder_progress_sent', 'reminder_progress_failed', 'reminder_progress_total'])->delete();
                    Cache::forget('setting.reminder_processing');
                    Cache::forget('setting.reminder_batch_id');
                    $processing = false;
                    $progressSent = 0;
                    $progressFailed = 0;
                    $progressTotal = 0;
                }
            } else {
                // No hay batchId pero está marcado como processing (procesamiento síncrono)
                // Verificar timeout: si updated_at es mayor a 5 minutos, asumir proceso muerto
                $processingRecord = DB::table('settings')->where('key', 'reminder_processing')->first();
                $minutesSinceUpdate = $processingRecord ? now()->diffInMinutes($processingRecord->updated_at) : 999;
                
                // Limpiar si: progreso inválido, progreso completo, o timeout (>5 minutos sin actualización)
                $shouldClean = $progressTotal === 0 || 
                              ($progressTotal > 0 && $progressSent + $progressFailed >= $progressTotal) ||
                              $minutesSinceUpdate > 5;
                
                if ($shouldClean) {
                    if ($minutesSinceUpdate > 5) {
                        Log::warning('Proceso de recordatorios detectado como muerto por timeout', [
                            'minutes_since_update' => $minutesSinceUpdate,
                            'progress' => ['sent' => $progressSent, 'failed' => $progressFailed, 'total' => $progressTotal]
                        ]);
                    }
                    
                    DB::table('settings')->where('key', 'reminder_processing')->update(['value' => 'false']);
                    DB::table('settings')->where('key', 'reminder_paused')->update(['value' => 'false']);
                    DB::table('settings')->where('key', 'reminder_batch_id')->delete();
                    DB::table('settings')->whereIn('key', ['reminder_progress_sent', 'reminder_progress_failed', 'reminder_progress_total'])->delete();
                    Cache::forget('setting.reminder_processing');
                    Cache::forget('setting.reminder_paused');
                    $processing = false;
                    $progressSent = 0;
                    $progressFailed = 0;
                    $progressTotal = 0;
                }
            }
        } else {
            // No está procesando, limpiar progreso siempre si existe
            if ($progressTotal > 0) {
                DB::table('settings')->whereIn('key', ['reminder_progress_sent', 'reminder_progress_failed', 'reminder_progress_total'])->delete();
                $progressSent = 0;
                $progressFailed = 0;
                $progressTotal = 0;
            }
        }
        
        // Obtener solo las citas pendientes de pasado mañana (2 días desde hoy) - optimizado
        $daysInAdvance = (int) Setting::get('reminder_days_in_advance', '2');
        $targetDate = now()->addDays($daysInAdvance)->startOfDay();
        $targetDateString = $targetDate->format('Y-m-d');
        
        $pendingCount = Appointment::query()
            ->where('uploaded_by', auth()->id())
            ->whereDate('citfc', '=', $targetDateString)
            ->where('reminder_sent', false)
            ->whereNotNull('citfc')
            ->whereNotNull('pactel')
            ->count();

        // Si se solicita como JSON (API)
        if (request()->wantsJson()) {
            // Solo devolver progreso si realmente hay un proceso activo Y hay progreso válido
            $progressData = null;
            if ($processing && $progressTotal > 0) {
                $progressData = [
                    'sent' => $progressSent,
                    'failed' => $progressFailed,
                    'total' => $progressTotal,
                    'pending' => max(0, $progressTotal - $progressSent - $progressFailed),
                    'percentage' => $progressTotal > 0 ? round(($progressSent + $progressFailed) / $progressTotal * 100) : 0
                ];
            }
            
            return response()->json([
                'paused' => $paused,
                'processing' => $processing,
                'pending_count' => $pendingCount,
                'progress' => $progressData
            ]);
        }

        // Si se solicita como Inertia (para actualizar la página)
        // Necesitamos cargar todos los datos de la página
        $appointments = Appointment::where('uploaded_by', auth()->id())
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get()
            ->map(fn($apt) => [
                'id' => $apt->id,
                'citead' => $apt->citead,
                'nom_paciente' => $apt->nom_paciente,
                'pactel' => $apt->pactel,
                'citdoc' => $apt->citdoc,
                'citfc' => $apt->citfc?->format('Y-m-d'),
                'cithor' => $apt->cithor?->format('H:i'),
                'mednom' => $apt->mednom,
                'espnom' => $apt->espnom,
                'citcon' => $apt->citcon,
                'citobsobs' => $apt->citobsobs,
                'reminder_sent' => $apt->reminder_sent,
                'reminder_sent_at' => $apt->reminder_sent_at?->format('Y-m-d H:i'),
                'reminder_status' => $apt->reminder_status,
            ]);
        
        $totalAppointments = Appointment::where('uploaded_by', auth()->id())->count();
        
        return Inertia::render('admin/appointments/index', [
            'appointments' => $appointments,
            'totalAppointments' => $totalAppointments,
            'reminderPaused' => $paused,
            'reminderProcessing' => $processing,
            'remindersStats' => [
                'sent' => Appointment::where('uploaded_by', auth()->id())->where('reminder_sent', true)->count(),
                'pending' => $pendingCount,
                'failed' => Appointment::where('uploaded_by', auth()->id())->where('reminder_status', 'failed')->count(),
            ],
            'uploadedFile' => session('uploaded_file'),
        ]);
    }
}
