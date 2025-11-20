<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class CleanupLogs extends Command
{
    protected $signature = 'cleanup:logs 
                            {--days=7 : Mantener logs de los últimos N días}
                            {--dry-run : Ver qué se eliminaría sin hacerlo}';

    protected $description = 'Limpia archivos de log antiguos para liberar espacio';

    public function handle(): int
    {
        $days = (int) $this->option('days');
        $dryRun = $this->option('dry-run');
        $logsPath = storage_path('logs');

        $this->info("🧹 Limpiando logs antiguos (> {$days} días)...");
        
        if ($dryRun) {
            $this->warn('⚠️  Modo DRY-RUN: No se eliminará nada');
        }

        $this->newLine();

        try {
            $files = File::files($logsPath);
            $cutoffDate = now()->subDays($days);
            
            $totalSize = 0;
            $deletedCount = 0;

            foreach ($files as $file) {
                $fileTime = File::lastModified($file);
                
                if ($fileTime < $cutoffDate->timestamp) {
                    $size = File::size($file);
                    $totalSize += $size;
                    
                    $this->line("📄 {$file->getFilename()} (" . $this->formatBytes($size) . ")");
                    
                    if (!$dryRun) {
                        File::delete($file);
                        $deletedCount++;
                    }
                }
            }

            $this->newLine();
            
            if ($deletedCount > 0 || $dryRun) {
                $action = $dryRun ? 'Se eliminarían' : 'Eliminados';
                $this->info("✅ {$action} {$deletedCount} archivos de log ({$this->formatBytes($totalSize)})");
            } else {
                $this->info('✅ No hay logs antiguos para eliminar');
            }

            return Command::SUCCESS;
        } catch (\Exception $e) {
            $this->error('❌ Error: ' . $e->getMessage());
            return Command::FAILURE;
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
