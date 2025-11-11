<?php

namespace App\Console\Commands;

use App\Services\AppointmentReminderService;
use Illuminate\Console\Command;

class SendAppointmentReminders extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'appointments:send-reminders
                            {--dry-run : Ejecutar sin enviar mensajes reales}
                            {--limit= : Limitar número de recordatorios a enviar}
                            {--force : Forzar envío ignorando el setting reminders_enabled}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Envía recordatorios automáticos de citas por WhatsApp';

    /**
     * Execute the console command.
     */
    public function handle(AppointmentReminderService $reminderService): int
    {
        $this->info('🚀 Iniciando proceso de recordatorios de citas...');
        $this->newLine();

        // Verificar si el sistema está habilitado
        $remindersEnabled = \App\Models\Setting::get('reminders_enabled', 'false') === 'true';
        
        if (!$remindersEnabled && !$this->option('force')) {
            $this->warn('⚠️  Sistema de recordatorios PAUSADO');
            $this->warn('   Para activarlo: ve a /admin/appointments y presiona "Iniciar Envío"');
            $this->warn('   O usa --force para enviar de todos modos');
            $this->newLine();
            return Command::SUCCESS;
        }

        if ($this->option('force')) {
            $this->warn('⚠️  Forzando envío (ignorando estado pausado)');
            $this->newLine();
        }

        if ($this->option('dry-run')) {
            $this->warn('⚠️  Modo DRY-RUN: No se enviarán mensajes reales');
            $this->newLine();
        }

        try {
            $startTime = now();
            
            if ($this->option('dry-run')) {
                $result = $this->dryRun($reminderService);
            } else {
                $limit = $this->option('limit');
                $result = $reminderService->processReminders($limit);
            }
            
            $duration = now()->diffInSeconds($startTime);
            
            $this->newLine();
            $this->info('✅ Proceso completado');
            $this->newLine();
            
            $this->table(
                ['Métrica', 'Valor'],
                [
                    ['📤 Enviados', $result['sent']],
                    ['❌ Fallidos', $result['failed']],
                    ['⏭️  Omitidos', $result['skipped']],
                    ['⏱️  Duración', "{$duration} segundos"],
                    ['📊 Promedio', $result['sent'] > 0 ? round($result['sent'] / max($duration, 1), 2) . ' msg/seg' : 'N/A'],
                ]
            );
            
            return Command::SUCCESS;
        } catch (\Exception $e) {
            $this->error('❌ Error: ' . $e->getMessage());
            return Command::FAILURE;
        }
    }

    /**
     * Simula el envío sin ejecutar realmente
     */
    protected function dryRun(AppointmentReminderService $reminderService): array
    {
        $daysInAdvance = (int) \App\Models\Setting::get('reminder_days_in_advance', '2');
        $maxPerDay = $this->option('limit') ?? (int) \App\Models\Setting::get('reminder_max_per_day', '500');
        
        $targetDate = now()->addDays($daysInAdvance)->startOfDay();
        
        $appointments = \App\Models\Appointment::query()
            ->whereDate('citfc', $targetDate)
            ->where('reminder_sent', false)
            ->whereNotNull('citfc')
            ->whereNotNull('pactel')
            ->limit($maxPerDay)
            ->get();
        
        $this->info("📊 Se encontraron {$appointments->count()} citas que necesitan recordatorio");
        $this->info("📅 Fecha objetivo: {$targetDate->format('Y-m-d')}");
        $this->newLine();
        
        if ($appointments->count() > 0) {
            $this->info('Muestra de citas:');
            $sample = $appointments->take(5);
            
            $this->table(
                ['ID', 'Paciente', 'Teléfono', 'Fecha', 'Hora', 'Médico'],
                $sample->map(fn($apt) => [
                    $apt->id,
                    $apt->nom_paciente,
                    $apt->pactel,
                    $apt->citfc?->format('Y-m-d'),
                    $apt->cithor?->format('H:i'),
                    $apt->mednom
                ])
            );
            
            if ($appointments->count() > 5) {
                $this->info("... y " . ($appointments->count() - 5) . " más");
            }
        }
        
        return ['sent' => 0, 'failed' => 0, 'skipped' => $appointments->count()];
    }
}
