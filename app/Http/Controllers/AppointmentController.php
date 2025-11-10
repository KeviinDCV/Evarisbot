<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use App\Models\Appointment;
use Illuminate\Support\Facades\DB;

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
            ]);
        
        $totalAppointments = Appointment::where('uploaded_by', auth()->id())->count();
        
        return Inertia::render('admin/appointments/index', [
            'appointments' => $appointments,
            'totalAppointments' => $totalAppointments,
            'uploadedFile' => session('uploaded_file'),
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
}
