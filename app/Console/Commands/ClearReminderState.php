<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Setting;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class ClearReminderState extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'reminders:clear-state {--force : No pedir confirmación}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Limpiar estado del sistema de recordatorios si está atascado';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('🔍 Verificando estado del sistema de recordatorios...');
        
        // Mostrar estado actual
        $processing = Setting::get('reminder_processing', 'false');
        $paused = Setting::get('reminder_paused', 'false');
        $batchId = Setting::get('reminder_batch_id');
        $progressSent = Setting::get('reminder_progress_sent', '0');
        $progressFailed = Setting::get('reminder_progress_failed', '0');
        $progressTotal = Setting::get('reminder_progress_total', '0');
        
        $this->table(
            ['Configuración', 'Valor'],
            [
                ['reminder_processing', $processing],
                ['reminder_paused', $paused],
                ['reminder_batch_id', $batchId ?: '(ninguno)'],
                ['reminder_progress_sent', $progressSent],
                ['reminder_progress_failed', $progressFailed],
                ['reminder_progress_total', $progressTotal],
            ]
        );
        
        if ($processing === 'false' && !$batchId) {
            $this->info('✅ El sistema está limpio, no hay procesos activos.');
            return Command::SUCCESS;
        }
        
        // Pedir confirmación si no se usa --force
        if (!$this->option('force')) {
            if (!$this->confirm('¿Deseas limpiar el estado del sistema de recordatorios?', true)) {
                $this->info('❌ Operación cancelada.');
                return Command::SUCCESS;
            }
        }
        
        $this->info('🧹 Limpiando estado...');
        
        // Limpiar todo
        Setting::set('reminder_processing', 'false');
        Setting::set('reminder_paused', 'false');
        Setting::remove('reminder_batch_id');
        Setting::remove('reminder_progress_sent');
        Setting::remove('reminder_progress_failed');
        Setting::remove('reminder_progress_total');
        
        // Limpiar caché
        Cache::forget('setting.reminder_processing');
        Cache::forget('setting.reminder_paused');
        Cache::forget('setting.reminder_batch_id');
        Cache::forget('setting.reminder_progress_sent');
        Cache::forget('setting.reminder_progress_failed');
        Cache::forget('setting.reminder_progress_total');
        
        Log::info('Estado de recordatorios limpiado manualmente', [
            'command' => 'reminders:clear-state',
            'user' => 'CLI',
        ]);
        
        $this->info('✅ Estado limpiado correctamente.');
        $this->info('💡 Ahora puedes iniciar un nuevo proceso de envío.');
        
        return Command::SUCCESS;
    }
}
