<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;

class ProcessReminderQueue extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'reminders:process-queue {--limit=50 : Número máximo de jobs a procesar}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Procesa la cola de recordatorios (para usar con cron en cPanel)';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $limit = (int) $this->option('limit');
        
        $this->info("Procesando hasta {$limit} jobs de la cola de recordatorios...");
        
        // Ejecutar queue:work con límite
        Artisan::call('queue:work', [
            '--once' => false,
            '--stop-when-empty' => true,
            '--max-jobs' => $limit,
            '--timeout' => 300,
        ]);
        
        $output = Artisan::output();
        $this->info($output);
        
        return Command::SUCCESS;
    }
}

