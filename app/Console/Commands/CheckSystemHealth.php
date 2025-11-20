<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class CheckSystemHealth extends Command
{
    protected $signature = 'system:health';
    protected $description = 'Verifica el estado del sistema y uso de recursos';

    public function handle(): int
    {
        $this->info('🏥 VERIFICACIÓN DE SALUD DEL SISTEMA');
        $this->newLine();

        // 1. Base de Datos
        $this->info('📊 BASE DE DATOS');
        $this->checkDatabase();
        $this->newLine();

        // 2. Logs
        $this->info('📄 LOGS');
        $this->checkLogs();
        $this->newLine();

        // 3. Configuración de Optimización
        $this->info('⚙️  CONFIGURACIÓN DE OPTIMIZACIÓN');
        $this->checkOptimizationConfig();
        $this->newLine();

        // 4. Queue Workers
        $this->info('🔄 QUEUE WORKERS');
        $this->checkQueueWorkers();
        $this->newLine();

        // 5. Recomendaciones
        $this->info('💡 RECOMENDACIONES');
        $this->showRecommendations();

        return Command::SUCCESS;
    }

    private function checkDatabase(): void
    {
        try {
            // Tamaño de tablas principales
            $tables = [
                'messages' => 'Mensajes',
                'conversations' => 'Conversaciones',
                'jobs' => 'Jobs en Cola',
                'failed_jobs' => 'Jobs Fallidos',
                'sessions' => 'Sesiones',
            ];

            $data = [];
            foreach ($tables as $table => $label) {
                $count = DB::table($table)->count();
                $data[] = [$label, number_format($count)];
            }

            $this->table(['Tabla', 'Registros'], $data);

            // Jobs antiguos
            $oldJobs = DB::table('jobs')
                ->where('created_at', '<', now()->subDays(30)->timestamp)
                ->count();

            if ($oldJobs > 0) {
                $this->warn("⚠️  Hay {$oldJobs} jobs antiguos (>30 días) que pueden limpiarse");
            }

            // Failed jobs
            $failedJobs = DB::table('failed_jobs')->count();
            if ($failedJobs > 100) {
                $this->warn("⚠️  Hay {$failedJobs} jobs fallidos que pueden limpiarse");
            }

        } catch (\Exception $e) {
            $this->error('Error al verificar base de datos: ' . $e->getMessage());
        }
    }

    private function checkLogs(): void
    {
        $logsPath = storage_path('logs');
        
        if (!File::exists($logsPath)) {
            $this->error('Directorio de logs no existe');
            return;
        }

        $files = File::files($logsPath);
        $totalSize = 0;
        $oldLogs = [];

        foreach ($files as $file) {
            $size = File::size($file);
            $totalSize += $size;
            
            $fileTime = File::lastModified($file);
            if ($fileTime < now()->subDays(7)->timestamp) {
                $oldLogs[] = [
                    $file->getFilename(),
                    $this->formatBytes($size),
                    date('Y-m-d', $fileTime),
                ];
            }
        }

        $this->line("📊 Tamaño total: {$this->formatBytes($totalSize)}");
        $this->line("📁 Archivos: " . count($files));

        if (count($oldLogs) > 0) {
            $this->newLine();
            $this->warn("⚠️  Logs antiguos (>7 días): " . count($oldLogs));
            $this->table(['Archivo', 'Tamaño', 'Fecha'], array_slice($oldLogs, 0, 5));
            
            if (count($oldLogs) > 5) {
                $this->line("... y " . (count($oldLogs) - 5) . " más");
            }
        }

        if ($totalSize > 50 * 1024 * 1024) { // 50 MB
            $this->warn("⚠️  Los logs ocupan más de 50MB. Considera ejecutar: php artisan cleanup:logs");
        }
    }

    private function checkOptimizationConfig(): void
    {
        $enabled = config('optimization.enabled', false);
        $cleanupData = config('optimization.cleanup_data.enabled', false);
        $cleanupLogs = config('optimization.cleanup_logs.enabled', false);

        $data = [
            ['Optimización General', $enabled ? '✅ Activada' : '❌ Desactivada'],
            ['Limpieza de Datos', $cleanupData ? '✅ Activada' : '❌ Desactivada'],
            ['Limpieza de Logs', $cleanupLogs ? '✅ Activada' : '❌ Desactivada'],
            ['Nivel de Logs', config('logging.channels.daily.level', 'N/A')],
            ['Días de Logs', config('logging.channels.daily.days', 'N/A')],
        ];

        $this->table(['Configuración', 'Estado'], $data);

        if (!$enabled) {
            $this->info('💡 Para activar optimización: agregar OPTIMIZATION_ENABLED=true en .env');
        }
    }

    private function checkQueueWorkers(): void
    {
        $pendingJobs = DB::table('jobs')->count();
        $failedJobs = DB::table('failed_jobs')->count();

        $data = [
            ['Jobs Pendientes', number_format($pendingJobs)],
            ['Jobs Fallidos', number_format($failedJobs)],
        ];

        $this->table(['Métrica', 'Valor'], $data);

        if ($pendingJobs > 500) {
            $this->warn("⚠️  Hay muchos jobs pendientes. Verifica que el worker esté corriendo.");
        }
    }

    private function showRecommendations(): void
    {
        $recommendations = [];

        // Verificar logs
        $logsSize = 0;
        $logsPath = storage_path('logs');
        if (File::exists($logsPath)) {
            foreach (File::files($logsPath) as $file) {
                $logsSize += File::size($file);
            }
        }

        if ($logsSize > 50 * 1024 * 1024) {
            $recommendations[] = "Ejecutar: php artisan cleanup:logs --dry-run";
        }

        // Verificar jobs antiguos
        $oldJobs = DB::table('jobs')
            ->where('created_at', '<', now()->subDays(30)->timestamp)
            ->count();

        if ($oldJobs > 100) {
            $recommendations[] = "Ejecutar: php artisan cleanup:old-data --dry-run";
        }

        // Verificar configuración
        if (!config('optimization.enabled', false)) {
            $recommendations[] = "Revisar: INSTALACION_SEGURA.md para activar optimizaciones";
        }

        if (empty($recommendations)) {
            $this->info('✅ El sistema está en buen estado');
        } else {
            foreach ($recommendations as $i => $rec) {
                $this->line(($i + 1) . ". {$rec}");
            }
        }
    }

    private function formatBytes(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        $bytes /= (1 << (10 * $pow));

        return round($bytes, 2) . ' ' . $units[$pow];
    }
}
