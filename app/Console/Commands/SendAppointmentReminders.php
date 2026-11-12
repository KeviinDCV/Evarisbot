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
                            {--forzar : Enviar de todos modos (no recomendado: la pantalla Citas es la que envía)}
                            {--limit= : Limitar número de recordatorios a enviar}';

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
        // Este comando envía en el mismo proceso, sin bloqueo, sin ámbito y sin mirar si hay un envío en curso desde
        // la pantalla: correrlo a mano durante un envío duplicaba mensajes. Se niega salvo --dry-run o --forzar.
        // (Sigue registrado en el programador, que no corre y no se debe activar.)
        if (!$this->option('forzar') && !$this->option('dry-run')) {
            $this->error('Este comando ya no se usa: los recordatorios se envían desde la pantalla Citas.');
            return Command::FAILURE;
        }

        $this->info('🚀 Iniciando proceso de recordatorios de citas...');
        $this->newLine();

        if ($this->option('dry-run')) {
            $this->warn('⚠️  Modo DRY-RUN: No se enviarán mensajes reales');
            $this->newLine();
        }

        try {
            $startTime = now();
            
            if ($this->option('dry-run')) {
                $result = $this->dryRun($reminderService);
            } else {
                $result = $reminderService->processReminders();
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
        // Por defecto 2 días: si hoy es 12/11, busca citas para 14/11 (pasado mañana). «Hoy» en hora de Colombia y
        // el mismo criterio que la pantalla Citas (sin canceladas ni confirmadas).
        $daysInAdvance = (int) \App\Models\Setting::get('reminder_days_in_advance', '2');
        $maxPerDay = (int) ($this->option('limit') ?? \App\Models\Setting::get('reminder_max_per_day', '500'));

        $targetDate = \App\Support\Recordatorios::dentroDe($daysInAdvance);

        $appointments = \App\Models\Appointment::query()
            ->porRecordar($targetDate)
            ->orderBy('cithor')
            ->orderBy('id')
            ->limit($maxPerDay)
            ->get();

        $this->info("📊 Se encontraron {$appointments->count()} citas que necesitan recordatorio");
        $this->info("📅 Fecha objetivo: {$targetDate}");
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
