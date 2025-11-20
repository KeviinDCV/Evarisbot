<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class RestartServices extends Command
{
    protected $signature = 'services:restart 
                            {--force : Forzar reinicio sin confirmación}';

    protected $description = 'Reinicia servicios que consumen mucha memoria (Reverb, Queue Worker)';

    public function handle(): int
    {
        $this->info('🔄 REINICIO DE SERVICIOS');
        $this->newLine();

        if (!$this->option('force') && !$this->confirm('¿Reiniciar servicios ahora?', true)) {
            $this->info('Reinicio cancelado');
            return Command::SUCCESS;
        }

        // 1. Detener Reverb (Node.js)
        $this->info('1️⃣  Deteniendo Reverb (Node.js)...');
        $this->stopNodeProcesses();
        sleep(2);

        // 2. Limpiar caché
        $this->info('2️⃣  Limpiando caché...');
        $this->call('cache:clear');
        $this->call('config:clear');

        // 3. Liberar memoria de PHP
        $this->info('3️⃣  Liberando memoria...');
        if (function_exists('gc_collect_cycles')) {
            gc_collect_cycles();
            $this->line('   ✅ Garbage collector ejecutado');
        }

        $this->newLine();
        $this->info('✅ Servicios detenidos');
        $this->warn('⚠️  Necesitas reiniciar manualmente:');
        $this->line('   - Reverb: php artisan reverb:start');
        $this->line('   - Worker: start-queue-worker.bat');
        $this->newLine();
        $this->info('O ejecutar: restart-services.bat');

        Log::info('Servicios reiniciados manualmente');

        return Command::SUCCESS;
    }

    private function stopNodeProcesses(): void
    {
        if (PHP_OS_FAMILY === 'Windows') {
            // Windows
            exec('taskkill /IM node.exe /F 2>nul', $output, $return);
            if ($return === 0) {
                $this->line('   ✅ Procesos Node.js detenidos');
            } else {
                $this->line('   ℹ️  No hay procesos Node.js corriendo');
            }
        } else {
            // Linux/Unix
            exec('pkill -f "node.*reverb" 2>/dev/null', $output, $return);
            if ($return === 0) {
                $this->line('   ✅ Reverb detenido');
            } else {
                $this->line('   ℹ️  Reverb no está corriendo');
            }
        }
    }
}
