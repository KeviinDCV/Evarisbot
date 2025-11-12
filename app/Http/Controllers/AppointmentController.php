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
        $remindersStats = [
            'sent' => Appointment::where('uploaded_by', auth()->id())->where('reminder_sent', true)->count(),
            'pending' => Appointment::where('uploaded_by', auth()->id())->where('reminder_sent', false)->whereNotNull('citfc')->count(),
            'failed' => Appointment::where('uploaded_by', auth()->id())->where('reminder_status', 'failed')->count(),
        ];
        
        // Estado de recordatorios
        $reminderPaused = Setting::get('reminder_paused', 'false') === 'true';
        $reminderProcessing = Setting::get('reminder_processing', 'false') === 'true';
        
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
            } elseif ($filter === 'reschedule_requested') {
                $query->where('reminder_status', 'reschedule_requested');
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
            'reschedule_requested' => Appointment::where('uploaded_by', auth()->id())->where('reminder_status', 'reschedule_requested')->count(),
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

            // Obtener configuración
            // Por defecto 2 días: si hoy es 12/11, busca citas para 14/11 (pasado mañana)
            $daysInAdvance = (int) Setting::get('reminder_days_in_advance', '2');
            $maxPerDay = (int) Setting::get('reminder_max_per_day', '1000');
            $messagesPerMinute = (int) Setting::get('reminder_messages_per_minute', '20'); // Por defecto 20/min para respetar límites
            
            // Calcular fecha objetivo
            // Si hoy es 12/11/2025 y daysInAdvance = 2, entonces pasado mañana = 14/11/2025
            $targetDate = now()->addDays($daysInAdvance)->startOfDay();
            
            // Log para verificar el cálculo
            Log::info('Cálculo de fecha objetivo', [
                'current_date' => now()->format('Y-m-d H:i:s'),
                'current_date_only' => now()->format('Y-m-d'),
                'days_in_advance' => $daysInAdvance,
                'target_date' => $targetDate->format('Y-m-d H:i:s'),
                'target_date_only' => $targetDate->format('Y-m-d'),
            ]);
            
            // Debug: Obtener información sobre las citas disponibles
            $allPendingAppointments = Appointment::query()
                ->where('uploaded_by', auth()->id())
                ->where('reminder_sent', false)
                ->whereNotNull('citfc')
                ->whereNotNull('pactel')
                ->get();
            
            // Obtener fechas únicas de citas pendientes con conteo
            $datesWithCount = $allPendingAppointments
                ->groupBy(fn($apt) => $apt->citfc ? $apt->citfc->format('Y-m-d') : null)
                ->filter(fn($group, $date) => $date !== null)
                ->map(fn($group, $date) => [
                    'date' => $date,
                    'count' => $group->count()
                ])
                ->sortBy('date')
                ->values()
                ->toArray();
            
            $availableDates = array_column($datesWithCount, 'date');
            
            // Verificar si hay citas para la fecha objetivo exacta
            $exactDateCount = $allPendingAppointments
                ->filter(fn($apt) => $apt->citfc && $apt->citfc->format('Y-m-d') === $targetDate->format('Y-m-d'))
                ->count();
            
            // Verificar citas para mañana y pasado mañana
            $tomorrow = now()->addDay()->startOfDay();
            $dayAfterTomorrow = now()->addDays(2)->startOfDay();
            $tomorrowCount = $allPendingAppointments
                ->filter(fn($apt) => $apt->citfc && $apt->citfc->format('Y-m-d') === $tomorrow->format('Y-m-d'))
                ->count();
            $dayAfterTomorrowCount = $allPendingAppointments
                ->filter(fn($apt) => $apt->citfc && $apt->citfc->format('Y-m-d') === $dayAfterTomorrow->format('Y-m-d'))
                ->count();
            
            // Obtener citas pendientes del usuario actual para la fecha objetivo
            // Usar whereDate que es más confiable para campos de tipo date
            $targetDateString = $targetDate->format('Y-m-d');
            
            $appointments = Appointment::query()
                ->where('uploaded_by', auth()->id())
                ->whereDate('citfc', '=', $targetDateString)
                ->where('reminder_sent', false)
                ->whereNotNull('citfc')
                ->whereNotNull('pactel')
                ->limit($maxPerDay)
                ->pluck('id');
            
            // Verificar con SQL directo para debug
            $rawQuery = DB::select("
                SELECT id, citfc, nom_paciente, reminder_sent 
                FROM appointments 
                WHERE uploaded_by = ? 
                AND citfc = ? 
                AND reminder_sent = 0 
                AND citfc IS NOT NULL 
                AND pactel IS NOT NULL 
                LIMIT 5
            ", [auth()->id(), $targetDateString]);
            
            // Log para debug
            Log::info('Buscando citas para recordatorio', [
                'user_id' => auth()->id(),
                'target_date' => $targetDateString,
                'current_date' => now()->format('Y-m-d'),
                'days_in_advance' => $daysInAdvance,
                'found_count_eloquent' => $appointments->count(),
                'found_count_raw' => count($rawQuery),
                'raw_results' => $rawQuery
            ]);

            if ($appointments->isEmpty()) {
                // Información de debug útil
                $targetDateFormatted = $targetDate->format('Y-m-d');
                $currentDateFormatted = now()->format('Y-m-d');
                
                $message = "No hay citas pendientes para enviar recordatorios para la fecha {$targetDateFormatted} (en {$daysInAdvance} días desde hoy).";
                
                if (!empty($availableDates)) {
                    $message .= "\n\nFechas disponibles con citas pendientes: " . implode(', ', array_slice($availableDates, 0, 10));
                    if (count($availableDates) > 10) {
                        $message .= " y " . (count($availableDates) - 10) . " más.";
                    }
                } else {
                    $message .= "\n\nNo hay citas pendientes en ninguna fecha.";
                }
                
                Log::warning('No se encontraron citas para recordatorio', [
                    'user_id' => auth()->id(),
                    'target_date' => $targetDateFormatted,
                    'current_date' => $currentDateFormatted,
                    'days_in_advance' => $daysInAdvance,
                    'available_dates' => $availableDates,
                    'total_pending' => $allPendingAppointments->count(),
                    'exact_date_count' => $exactDateCount,
                    'tomorrow_count' => $tomorrowCount,
                    'day_after_tomorrow_count' => $dayAfterTomorrowCount,
                    'dates_with_count' => $datesWithCount
                ]);
                
                return response()->json([
                    'success' => false,
                    'message' => $message,
                    'debug' => [
                        'target_date' => $targetDateFormatted,
                        'current_date' => $currentDateFormatted,
                        'days_in_advance' => $daysInAdvance,
                        'available_dates' => $availableDates,
                        'total_pending_appointments' => $allPendingAppointments->count(),
                        'exact_date_count' => $exactDateCount,
                        'tomorrow_count' => $tomorrowCount,
                        'day_after_tomorrow_count' => $dayAfterTomorrowCount,
                        'dates_with_count' => $datesWithCount
                    ]
                ], 400);
            }

            // Marcar como procesando
            Setting::set('reminder_processing', 'true');
            Setting::set('reminder_paused', 'false');

            // Calcular delay entre mensajes (en segundos)
            $delayBetweenMessages = 60 / $messagesPerMinute; // Ej: 60/20 = 3 segundos entre mensajes
            
            // Para cPanel: procesar de manera síncrona hasta el límite diario (1000)
            // Esto evita depender del queue worker que puede no estar disponible en cPanel
            // Si hay más de 1000, se procesarán en lotes de 1000
            $totalAppointments = $appointments->count();
            $maxSynchronous = (int) Setting::get('reminder_max_per_day', '1000');
            $processSynchronously = $totalAppointments <= $maxSynchronous;
            
            if ($processSynchronously) {
                // Procesar de manera síncrona
                $sent = 0;
                $failed = 0;
                
                foreach ($appointments as $appointmentId) {
                    try {
                        // Verificar si está pausado antes de cada envío
                        if (Setting::get('reminder_paused', 'false') === 'true') {
                            Setting::set('reminder_processing', 'false');
                            return response()->json([
                                'success' => false,
                                'message' => 'El envío fue pausado'
                            ], 400);
                        }
                        
                        $appointment = Appointment::find($appointmentId);
                        if ($appointment && !$appointment->reminder_sent) {
                            $reminderService = app(AppointmentReminderService::class);
                            $result = $reminderService->sendReminder($appointment);
                            
                            if ($result['success']) {
                                $sent++;
                                Log::info('Recordatorio enviado exitosamente (síncrono)', [
                                    'appointment_id' => $appointmentId,
                                    'message_id' => $result['message_id'] ?? null
                                ]);
                            } else {
                                $failed++;
                                Log::error('Error enviando recordatorio (síncrono)', [
                                    'appointment_id' => $appointmentId,
                                    'error' => $result['error'] ?? 'Error desconocido'
                                ]);
                            }
                        } else {
                            Log::warning('Appointment no encontrado o ya enviado', [
                                'appointment_id' => $appointmentId,
                                'found' => $appointment !== null,
                                'already_sent' => $appointment?->reminder_sent ?? false
                            ]);
                        }
                        
                        // Delay entre mensajes para respetar rate limiting
                        if ($delayBetweenMessages > 0) {
                            usleep($delayBetweenMessages * 1000000); // Convertir segundos a microsegundos
                        }
                    } catch (\Exception $e) {
                        $failed++;
                        Log::error('Error enviando recordatorio síncrono', [
                            'appointment_id' => $appointmentId,
                            'error' => $e->getMessage()
                        ]);
                    }
                }
                
                Setting::set('reminder_processing', 'false');
                Setting::remove('reminder_batch_id'); // Limpiar batch ID ya que no hay batch
                
                Log::info('Recordatorios enviados síncronamente', [
                    'sent' => $sent,
                    'failed' => $failed,
                    'total' => $totalAppointments
                ]);
                
                $message = "Se enviaron {$sent} recordatorios exitosamente";
                if ($failed > 0) {
                    $message .= " ({$failed} fallidos)";
                }
                
                Log::info('Proceso síncrono completado', [
                    'sent' => $sent,
                    'failed' => $failed,
                    'total' => $totalAppointments
                ]);
                
                return response()->json([
                    'success' => true,
                    'message' => $message,
                    'total' => $totalAppointments,
                    'sent' => $sent,
                    'failed' => $failed
                ]);
            }
            
            // Para muchos jobs, usar batch con queue
            // Crear jobs con delays escalonados
            $jobs = [];
            $delay = 0;
            
            foreach ($appointments as $appointmentId) {
                $jobs[] = (new SendAppointmentReminderJob($appointmentId))
                    ->delay($delay);
                
                $delay += $delayBetweenMessages;
            }

            // Despachar todos los jobs
            $batch = Bus::batch($jobs)
                ->name('Envío de Recordatorios - ' . now()->format('Y-m-d H:i'))
                ->allowFailures()
                ->then(function (\Illuminate\Bus\Batch $batch) {
                    // Cuando todos los jobs terminan
                    Setting::set('reminder_processing', 'false');
                    Setting::remove('reminder_batch_id'); // Limpiar batch ID
                    Log::info('Batch de recordatorios completado', [
                        'total_jobs' => $batch->totalJobs,
                        'processed_jobs' => $batch->processedJobs(),
                        'failed_jobs' => $batch->failedJobs
                    ]);
                })
                ->catch(function (\Illuminate\Bus\Batch $batch, \Throwable $e) {
                    // Si hay un error crítico
                    Setting::set('reminder_processing', 'false');
                    Setting::remove('reminder_batch_id'); // Limpiar batch ID
                    Log::error('Error crítico en batch de recordatorios', [
                        'error' => $e->getMessage()
                    ]);
                })
                ->finally(function (\Illuminate\Bus\Batch $batch) {
                    // Siempre se ejecuta al final
                    Setting::set('reminder_processing', 'false');
                    Setting::remove('reminder_batch_id'); // Limpiar batch ID
                })
                ->dispatch();
            
            // Guardar el ID del batch para poder cancelarlo después
            Setting::set('reminder_batch_id', $batch->id);

            Log::info('Iniciado envío de recordatorios', [
                'total_appointments' => $appointments->count(),
                'target_date' => $targetDate->format('Y-m-d'),
                'messages_per_minute' => $messagesPerMinute,
                'delay_between_messages' => $delayBetweenMessages,
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
     * Obtener estado del proceso de recordatorios
     */
    public function getReminderStatus()
    {
        $paused = Setting::get('reminder_paused', 'false') === 'true';
        $processing = Setting::get('reminder_processing', 'false') === 'true';
        
        // Por defecto 2 días: si hoy es 12/11, busca citas para 14/11 (pasado mañana)
        $daysInAdvance = (int) Setting::get('reminder_days_in_advance', '2');
        $targetDate = now()->addDays($daysInAdvance)->startOfDay();
        
        $pendingCount = Appointment::query()
            ->where('uploaded_by', auth()->id())
            ->whereDate('citfc', $targetDate)
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
                'target_date' => $targetDate->format('Y-m-d')
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
