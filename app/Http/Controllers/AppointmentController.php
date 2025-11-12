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
        
        // Obtener todas las citas pendientes (sin filtrar por fecha)
        $pendingCount = Appointment::query()
            ->where('uploaded_by', auth()->id())
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
            if (Setting::get('reminder_processing', 'false') === 'true') {
                return response()->json([
                    'success' => false,
                    'message' => 'Ya hay un proceso de envío en curso'
                ], 400);
            }

            // Obtener configuración de rate limiting
            // Límites de Meta WhatsApp Business API:
            // - Máximo 1,000 conversaciones iniciadas por día
            // - Recomendado: 1 mensaje por segundo, 20 mensajes por minuto
            $maxPerDay = (int) Setting::get('reminder_max_per_day', '1000'); // Límite diario de Meta
            $messagesPerSecond = (float) Setting::get('reminder_messages_per_second', '1'); // 1 msg/seg por defecto
            $messagesPerMinute = (int) Setting::get('reminder_messages_per_minute', '20'); // 20 msg/min por defecto
            
            // Obtener TODAS las citas pendientes del usuario actual (sin filtrar por fecha)
            $appointments = Appointment::query()
                ->where('uploaded_by', auth()->id())
                ->where('reminder_sent', false)
                ->whereNotNull('citfc')
                ->whereNotNull('pactel')
                ->orderBy('citfc', 'asc') // Ordenar por fecha de cita
                ->limit($maxPerDay) // Respetar límite diario de Meta
                ->pluck('id');
            
            Log::info('Iniciando envío de recordatorios masivos', [
                'user_id' => auth()->id(),
                'total_pending_appointments' => $appointments->count(),
                'max_per_day' => $maxPerDay,
                'messages_per_second' => $messagesPerSecond,
                'messages_per_minute' => $messagesPerMinute
            ]);

            if ($appointments->isEmpty()) {
                return response()->json([
                    'success' => false,
                    'message' => 'No hay citas pendientes para enviar recordatorios.'
                ], 400);
            }

            // Marcar como procesando
            Setting::set('reminder_processing', 'true');
            Setting::set('reminder_paused', 'false');

            // Calcular delay entre mensajes respetando límites de Meta
            // Meta recomienda: 1 mensaje por segundo máximo
            // Usamos el más restrictivo entre mensajes por segundo y mensajes por minuto
            $delayBetweenMessages = max(1 / $messagesPerSecond, 60 / $messagesPerMinute); // En segundos
            
            $totalAppointments = $appointments->count();
            
            // Guardar progreso inicial
            Setting::set('reminder_progress_total', (string) $totalAppointments);
            Setting::set('reminder_progress_sent', '0');
            Setting::set('reminder_progress_failed', '0');
            
            // Para pocas citas (menos de 20), procesar de manera síncrona
            // Esto evita depender de un worker de cola cuando hay pocos mensajes
            $maxSynchronousBatch = 20;
            $processSynchronously = $totalAppointments <= $maxSynchronousBatch;
            
            if ($processSynchronously) {
                // Procesar de manera síncrona
                $sent = 0;
                $failed = 0;
                $reminderService = app(AppointmentReminderService::class);
                
                try {
                    foreach ($appointments as $appointmentId) {
                        // Verificar si está pausado antes de cada envío
                        if (Setting::get('reminder_paused', 'false') === 'true') {
                            Setting::set('reminder_processing', 'false');
                            Setting::set('reminder_paused', 'false');
                            return response()->json([
                                'success' => false,
                                'message' => 'El envío fue pausado',
                                'sent' => $sent,
                                'failed' => $failed,
                                'total' => $totalAppointments
                            ], 400);
                        }
                        
                        $appointment = Appointment::find($appointmentId);
                        if ($appointment && !$appointment->reminder_sent) {
                            try {
                                $result = $reminderService->sendReminder($appointment);
                                
                                if ($result['success']) {
                                    $sent++;
                                    Setting::set('reminder_progress_sent', (string) $sent);
                                    Log::info('Recordatorio enviado exitosamente (síncrono)', [
                                        'appointment_id' => $appointmentId,
                                        'message_id' => $result['message_id'] ?? null,
                                        'progress' => ['sent' => $sent, 'failed' => $failed, 'total' => $totalAppointments]
                                    ]);
                                } else {
                                    $failed++;
                                    Setting::set('reminder_progress_failed', (string) $failed);
                                    Log::error('Error enviando recordatorio (síncrono)', [
                                        'appointment_id' => $appointmentId,
                                        'error' => $result['error'] ?? 'Error desconocido',
                                        'progress' => ['sent' => $sent, 'failed' => $failed, 'total' => $totalAppointments]
                                    ]);
                                }
                            } catch (\Exception $e) {
                                $failed++;
                                Setting::set('reminder_progress_failed', (string) $failed);
                                Log::error('Excepción enviando recordatorio síncrono', [
                                    'appointment_id' => $appointmentId,
                                    'error' => $e->getMessage(),
                                    'progress' => ['sent' => $sent, 'failed' => $failed, 'total' => $totalAppointments]
                                ]);
                            }
                        }
                        
                        // Delay entre mensajes para respetar rate limiting (excepto en el último)
                        if ($delayBetweenMessages > 0) {
                            $appointmentIds = $appointments->toArray();
                            $isLast = $appointmentId === end($appointmentIds);
                            if (!$isLast) {
                                usleep($delayBetweenMessages * 1000000); // Convertir segundos a microsegundos
                            }
                        }
                    }
                } finally {
                    // Limpiar estado
                    Setting::set('reminder_processing', 'false');
                    Setting::set('reminder_paused', 'false');
                    Setting::remove('reminder_batch_id');
                }
                
                Log::info('Recordatorios enviados síncronamente', [
                    'sent' => $sent,
                    'failed' => $failed,
                    'total' => $totalAppointments
                ]);
                
                $message = "Se enviaron {$sent} recordatorios exitosamente";
                if ($failed > 0) {
                    $message .= " ({$failed} fallidos)";
                }
                
                return response()->json([
                    'success' => true,
                    'message' => $message,
                    'total' => $totalAppointments,
                    'sent' => $sent,
                    'failed' => $failed
                ]);
            }
            
            // Para muchos mensajes, usar batch con queue
            // Crear jobs con delays escalonados para respetar rate limiting
            $jobs = [];
            $delay = 0; // Delay inicial en segundos
            
            foreach ($appointments as $appointmentId) {
                $jobs[] = (new SendAppointmentReminderJob($appointmentId))
                    ->delay(now()->addSeconds($delay));
                
                // Incrementar delay para el siguiente mensaje
                // Esto asegura que respetamos el límite de 1 mensaje por segundo
                $delay += $delayBetweenMessages;
            }

            // Despachar todos los jobs
            $batch = Bus::batch($jobs)
                ->name('Envío de Recordatorios Masivos - ' . now()->format('Y-m-d H:i'))
                ->allowFailures()
                ->then(function (\Illuminate\Bus\Batch $batch) {
                    // Cuando todos los jobs terminan
                    Setting::set('reminder_processing', 'false');
                    Setting::remove('reminder_batch_id');
                    
                    // Obtener progreso final
                    $progressSent = (int) Setting::get('reminder_progress_sent', '0');
                    $progressFailed = (int) Setting::get('reminder_progress_failed', '0');
                    
                    Log::info('Batch de recordatorios completado', [
                        'total_jobs' => $batch->totalJobs,
                        'processed_jobs' => $batch->processedJobs(),
                        'failed_jobs' => $batch->failedJobs,
                        'sent' => $progressSent,
                        'failed' => $progressFailed
                    ]);
                })
                ->catch(function (\Illuminate\Bus\Batch $batch, \Throwable $e) {
                    // Si hay un error crítico
                    Setting::set('reminder_processing', 'false');
                    Setting::remove('reminder_batch_id');
                    Log::error('Error crítico en batch de recordatorios', [
                        'error' => $e->getMessage()
                    ]);
                })
                ->finally(function (\Illuminate\Bus\Batch $batch) {
                    // Siempre se ejecuta al final
                    Setting::set('reminder_processing', 'false');
                    Setting::remove('reminder_batch_id');
                })
                ->dispatch();
            
            // Guardar el ID del batch para poder cancelarlo después
            Setting::set('reminder_batch_id', $batch->id);

            Log::info('Iniciado envío de recordatorios masivos', [
                'total_appointments' => $appointments->count(),
                'messages_per_second' => $messagesPerSecond,
                'messages_per_minute' => $messagesPerMinute,
                'delay_between_messages' => $delayBetweenMessages,
                'estimated_time_minutes' => ceil(($appointments->count() * $delayBetweenMessages) / 60),
                'user_id' => auth()->id()
            ]);

            return response()->json([
                'success' => true,
                'message' => "Se inició el envío de {$appointments->count()} recordatorios",
                'total' => $appointments->count(),
                'estimated_time_minutes' => ceil(($appointments->count() * $delayBetweenMessages) / 60)
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
     * Obtener estado del proceso de recordatorios con progreso en tiempo real
     */
    public function getReminderStatus()
    {
        $paused = Setting::get('reminder_paused', 'false') === 'true';
        $processing = Setting::get('reminder_processing', 'false') === 'true';
        
        // Obtener progreso guardado
        $progressSent = (int) Setting::get('reminder_progress_sent', '0');
        $progressFailed = (int) Setting::get('reminder_progress_failed', '0');
        $progressTotal = (int) Setting::get('reminder_progress_total', '0');
        
        // Verificar si realmente hay un proceso corriendo
        // Usar siempre el progreso guardado en Settings ya que los jobs lo actualizan en tiempo real
        if ($processing) {
            $batchId = Setting::get('reminder_batch_id');
            if ($batchId) {
                try {
                    $batch = \Illuminate\Support\Facades\Bus::findBatch($batchId);
                    if (!$batch || $batch->finished() || $batch->cancelled()) {
                        // El batch terminó pero el estado quedó como "processing", limpiarlo
                        Setting::set('reminder_processing', 'false');
                        Setting::remove('reminder_batch_id');
                        Setting::remove('reminder_progress_sent');
                        Setting::remove('reminder_progress_failed');
                        Setting::remove('reminder_progress_total');
                        $processing = false;
                        $progressSent = 0;
                        $progressFailed = 0;
                        $progressTotal = 0;
                        Log::info('Estado de procesamiento limpiado - batch terminado', [
                            'batch_id' => $batchId
                        ]);
                    } else {
                        // Batch activo: usar progreso guardado en Settings (actualizado por los jobs)
                        // El progreso guardado es más preciso porque se actualiza después de cada envío
                        $progressTotal = max($progressTotal, $batch->totalJobs); // Usar el máximo entre ambos
                    }
                } catch (\Exception $e) {
                    // Si no se puede encontrar el batch, usar progreso guardado
                    // El progreso guardado sigue siendo válido mientras los jobs se ejecutan
                    Log::info('Batch no encontrado, usando progreso guardado', [
                        'batch_id' => $batchId,
                        'error' => $e->getMessage()
                    ]);
                }
            }
            // Si no hay batchId pero está procesando, usar progreso guardado (puede ser proceso síncrono)
        } else {
            // No está procesando, limpiar progreso solo si terminó completamente
            if ($progressTotal > 0 && $progressSent + $progressFailed >= $progressTotal) {
                Setting::remove('reminder_progress_sent');
                Setting::remove('reminder_progress_failed');
                Setting::remove('reminder_progress_total');
                $progressSent = 0;
                $progressFailed = 0;
                $progressTotal = 0;
            }
        }
        
        // Obtener todas las citas pendientes (sin filtrar por fecha)
        $pendingCount = Appointment::query()
            ->where('uploaded_by', auth()->id())
            ->where('reminder_sent', false)
            ->whereNotNull('citfc')
            ->whereNotNull('pactel')
            ->count();

        // Si se solicita como JSON (API)
        if (request()->wantsJson()) {
            return response()->json([
                'paused' => $paused,
                'processing' => $processing,
                'pending_count' => $pendingCount,
                'progress' => [
                    'sent' => $progressSent,
                    'failed' => $progressFailed,
                    'total' => $progressTotal,
                    'pending' => max(0, $progressTotal - $progressSent - $progressFailed),
                    'percentage' => $progressTotal > 0 ? round(($progressSent + $progressFailed) / $progressTotal * 100) : 0
                ]
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
