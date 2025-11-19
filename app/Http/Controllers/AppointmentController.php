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
        
        // Cargar solo las primeras 50 citas del usuario actual
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
        
        // Obtener solo las citas pendientes de pasado mañana (2 días desde hoy)
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
        
        $remindersStats = [
            'sent' => Appointment::where('uploaded_by', auth()->id())->where('reminder_sent', true)->count(),
            'pending' => $pendingCount,
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
     * Subir archivo Excel con citas
     */
    public function upload(Request $request)
    {
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
            $totalRows = $this->processAndSaveExcel($fullPath);

            Log::info('Archivo de citas subido y procesado', [
                'filename' => $fileName,
                'path' => $path,
                'size' => $file->getSize(),
                'total_rows' => $totalRows,
                'user_id' => auth()->id(),
            ]);

            return redirect()->route('admin.appointments.index')->with([
                'success' => "Archivo subido exitosamente. Se procesaron {$totalRows} citas.",
                'uploaded_file' => [
                    'name' => $originalName,
                    'path' => $path,
                    'size' => $file->getSize(),
                    'uploaded_at' => now()->toDateTimeString(),
                    'total_rows' => $totalRows,
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
     */
    private function processAndSaveExcel(string $filePath): int
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
                    
                    foreach ($columnIndexes as $column => $index) {
                        $value = $row[$index] ?? null;
                        
                        // Debug: Log del valor de citfc
                        if ($column === 'citfci') {
                            Log::info('CITFC DEBUG', [
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
                                // Intentar parsear fecha en formato texto
                                try {
                                    $date = \DateTime::createFromFormat('d/m/Y', $value);
                                    if ($date) {
                                        $value = $date->format('Y-m-d');
                                    }
                                } catch (\Exception $e) {
                                    $value = null;
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
                        
                        // Procesar hora - Excel usa números decimales para tiempo
                        if ($column === 'cithor' && is_numeric($value)) {
                            try {
                                // Excel guarda tiempo como fracción del día
                                $datetime = Date::excelToDateTimeObject($value);
                                $value = $datetime->format('H:i:s');
                            } catch (\Exception $e) {
                                $value = null;
                            }
                        }
                        
                        // Mapear citfci a citfc para la BD
                        if ($column === 'citfci') {
                            $appointment['citfc'] = $value;
                        } else {
                            $appointment[$column] = $value;
                        }
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
            
            return $totalProcessed;
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

            // Obtener configuración
            // Por defecto 2 días: si hoy es 12/11, busca citas para 14/11 (pasado mañana)
            $daysInAdvance = (int) Setting::get('reminder_days_in_advance', '2');
            
            // Límites de Meta WhatsApp Business API:
            // - Máximo 1,000 conversaciones iniciadas por día (24 horas)
            // - Rate limiting: 1 mensaje por segundo máximo, 20 mensajes por minuto máximo
            $maxPerDay = (int) Setting::get('reminder_max_per_day', '1000'); // Límite diario de Meta
            $messagesPerSecond = (float) Setting::get('reminder_messages_per_second', '1'); // 1 msg/seg por defecto
            $messagesPerMinute = (int) Setting::get('reminder_messages_per_minute', '20'); // 20 msg/min por defecto
            
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
                'max_per_day' => $maxPerDay,
                'messages_per_second' => $messagesPerSecond,
                'messages_per_minute' => $messagesPerMinute
            ]);

            if ($appointments->isEmpty()) {
                return response()->json([
                    'success' => false,
                    'message' => "No hay citas pendientes para enviar recordatorios para la fecha {$targetDateString} (pasado mañana)."
                ], 400);
            }

            // Marcar como procesando
            Setting::set('reminder_processing', 'true');
            Setting::set('reminder_paused', 'false');

            // Calcular delay entre mensajes respetando límites de Meta
            // Meta: máximo 1 mensaje por segundo, 20 mensajes por minuto
            // Usamos el más restrictivo: 1 mensaje por segundo = delay de 1 segundo mínimo
            $delayBetweenMessages = max(1.0, 60.0 / $messagesPerMinute); // Mínimo 1 segundo entre mensajes
            
            $totalAppointments = $appointments->count();
            
            // Guardar progreso inicial
            Setting::set('reminder_progress_total', (string) $totalAppointments);
            Setting::set('reminder_progress_sent', '0');
            Setting::set('reminder_progress_failed', '0');
            
            // Obtener configuración de lotes
            $batchSize = (int) Setting::get('reminder_batch_size', '10');
            $batchPauseSeconds = (int) Setting::get('reminder_batch_pause_seconds', '5');
            $maxPerDay = (int) Setting::get('reminder_max_per_day', '1000');
            
            // Validar límite diario de Meta (1000 conversaciones por día en Tier 1)
            // Este es el único límite real - no hay límite artificial en el sistema
            if ($totalAppointments > $maxPerDay) {
                Log::warning('Advertencia: El volumen excede el límite diario de Meta', [
                    'total' => $totalAppointments,
                    'max_per_day' => $maxPerDay,
                    'message' => 'El sistema enviará todos los mensajes, pero Meta puede bloquear después de ' . $maxPerDay
                ]);
            }
            
            // PROCESAMIENTO ILIMITADO: El sistema puede manejar miles de mensajes
            // Gracias a fastcgi_finish_request() y ignore_user_abort(), el servidor
            // no se cuelga y continúa procesando en background sin importar el volumen
            
            // Calcular timeout dinámico basado en volumen
            // Fórmula: (mensajes × 3 segundos promedio) + 20% de margen
            $estimatedSeconds = (int) ($totalAppointments * 3.5);
            $timeout = max(1800, $estimatedSeconds); // Mínimo 30 minutos
            set_time_limit($timeout);
            
            // Permitir que el proceso continúe aunque el cliente se desconecte
            ignore_user_abort(true);
            
            // Enviar respuesta inmediata al frontend ANTES de procesar
            // Esto previene que la conexión HTTP se cierre durante el envío largo
            response()->json([
                'success' => true,
                'message' => 'Proceso de envío iniciado',
                'total' => $totalAppointments,
                'processing' => true
            ])->send();
            
            // Liberar la conexión HTTP para que el navegador no espere
            if (function_exists('fastcgi_finish_request')) {
                fastcgi_finish_request();
            }
            
            // Continuar procesamiento en background
            $sent = 0;
            $failed = 0;
            $reminderService = app(AppointmentReminderService::class);
            
            try {
                    $currentBatchCount = 0;
                    $appointmentsArray = $appointments->toArray();
                    $currentBatchNumber = 1;
                    $totalBatches = ceil(count($appointmentsArray) / $batchSize);
                    
                    foreach ($appointments as $index => $appointmentId) {
                        // Verificar si está pausado antes de cada envío
                        if (Setting::get('reminder_paused', 'false') === 'true') {
                            Setting::set('reminder_processing', 'false');
                            Setting::set('reminder_paused', 'false');
                            Log::info('Envío pausado por usuario', [
                                'sent' => $sent,
                                'failed' => $failed,
                                'total' => $totalAppointments
                            ]);
                            return; // Ya enviamos respuesta arriba con ->send()
                        }
                        
                        $appointment = Appointment::find($appointmentId);
                        if ($appointment && !$appointment->reminder_sent) {
                            try {
                                $result = $reminderService->sendReminder($appointment);
                                
                                if ($result['success']) {
                                    $sent++;
                                    // Actualizar progreso ANTES del delay para que el frontend lo capture
                                    DB::table('settings')->updateOrInsert(
                                        ['key' => 'reminder_progress_sent'],
                                        ['value' => (string) $sent, 'updated_at' => now()]
                                    );
                                    Cache::forget('setting.reminder_progress_sent');
                                    
                                    Log::info('Recordatorio enviado exitosamente (síncrono)', [
                                        'appointment_id' => $appointmentId,
                                        'message_id' => $result['message_id'] ?? null,
                                        'batch' => $currentBatchNumber,
                                        'progress' => ['sent' => $sent, 'failed' => $failed, 'total' => $totalAppointments]
                                    ]);
                                } else {
                                    $failed++;
                                    // Actualizar progreso ANTES del delay
                                    DB::table('settings')->updateOrInsert(
                                        ['key' => 'reminder_progress_failed'],
                                        ['value' => (string) $failed, 'updated_at' => now()]
                                    );
                                    Cache::forget('setting.reminder_progress_failed');
                                    
                                    Log::error('Error enviando recordatorio (síncrono)', [
                                        'appointment_id' => $appointmentId,
                                        'error' => $result['error'] ?? 'Error desconocido',
                                        'batch' => $currentBatchNumber,
                                        'progress' => ['sent' => $sent, 'failed' => $failed, 'total' => $totalAppointments]
                                    ]);
                                }
                            } catch (\Exception $e) {
                                $failed++;
                                // Actualizar directamente en BD y limpiar caché inmediatamente
                                DB::table('settings')->updateOrInsert(
                                    ['key' => 'reminder_progress_failed'],
                                    ['value' => (string) $failed, 'updated_at' => now()]
                                );
                                Cache::forget('setting.reminder_progress_failed');
                                Log::error('Excepción enviando recordatorio síncrono', [
                                    'appointment_id' => $appointmentId,
                                    'error' => $e->getMessage(),
                                    'batch' => $currentBatchNumber,
                                    'progress' => ['sent' => $sent, 'failed' => $failed, 'total' => $totalAppointments]
                                ]);
                            }
                        }
                        
                        $currentBatchCount++;
                        $isLastInBatch = ($currentBatchCount >= $batchSize);
                        $isLast = ($index === count($appointmentsArray) - 1);
                        
                        // Delay entre mensajes para respetar rate limiting de Meta
                        if ($delayBetweenMessages > 0 && !$isLast) {
                            $seconds = (int) $delayBetweenMessages;
                            $microseconds = (int) (($delayBetweenMessages - $seconds) * 1000000);
                            
                            if ($seconds > 0) {
                                sleep($seconds);
                            }
                            if ($microseconds > 0) {
                                usleep($microseconds);
                            }
                        }
                        
                        // Pausa entre lotes
                        if ($isLastInBatch && !$isLast) {
                            Log::info('Lote completado, pausando...', [
                                'batch' => $currentBatchNumber,
                                'total_batches' => $totalBatches,
                                'sent' => $sent,
                                'failed' => $failed,
                                'pause_seconds' => $batchPauseSeconds
                            ]);
                            
                            sleep($batchPauseSeconds);
                            $currentBatchCount = 0;
                            $currentBatchNumber++;
                            
                            Log::info('Continuando con siguiente lote...', [
                                'batch' => $currentBatchNumber,
                                'remaining' => ($totalAppointments - $sent - $failed)
                            ]);
                        }
                    }
                } finally {
                    // Limpiar estado y progreso
                    Setting::set('reminder_processing', 'false');
                    Setting::set('reminder_paused', 'false');
                    Setting::remove('reminder_batch_id');
                    Setting::remove('reminder_progress_sent');
                    Setting::remove('reminder_progress_failed');
                    Setting::remove('reminder_progress_total');
                }
            
            Log::info('Recordatorios enviados en background', [
                'sent' => $sent,
                'failed' => $failed,
                'total' => $totalAppointments
            ]);
            
            // No retornar respuesta porque ya se envió arriba con ->send()
            // Simplemente terminar el método
            return;
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
                        // Batch activo: usar progreso guardado en Settings
                        $progressTotal = max($progressTotal, $batch->totalJobs);
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
