<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Appointment;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class DeleteAppointmentsByDate extends Command
{
    protected $signature = 'appointments:delete-by-date
                            {date : Fecha de las citas a borrar (YYYY-MM-DD)}
                            {--service=general : Servicio (general u oncology)}
                            {--only-pending : Borrar solo las que aún no tienen recordatorio enviado}
                            {--force : No pedir confirmación}';

    protected $description = 'Eliminar citas con citfc en una fecha específica (útil para cargas erróneas)';

    public function handle()
    {
        $dateInput = $this->argument('date');
        $service = $this->option('service');
        $onlyPending = $this->option('only-pending');

        try {
            $date = Carbon::parse($dateInput)->format('Y-m-d');
        } catch (\Throwable $e) {
            $this->error("Fecha inválida: {$dateInput}. Usa formato YYYY-MM-DD.");
            return Command::FAILURE;
        }

        if (!in_array($service, ['general', 'oncology'])) {
            $this->error("Servicio inválido: {$service}. Usa 'general' u 'oncology'.");
            return Command::FAILURE;
        }

        $query = Appointment::where('service', $service)
            ->whereDate('citfc', '=', $date);

        if ($onlyPending) {
            $query->where('reminder_sent', false);
        }

        $total = (clone $query)->count();

        if ($total === 0) {
            $this->info("No hay citas con citfc={$date} y service={$service}" . ($onlyPending ? ' (pendientes)' : '') . '.');
            return Command::SUCCESS;
        }

        $this->info("Citas a eliminar: {$total}");
        $this->line("  service       = {$service}");
        $this->line("  citfc         = {$date}");
        $this->line('  only-pending  = ' . ($onlyPending ? 'sí' : 'no'));

        $byUploader = (clone $query)
            ->selectRaw('uploaded_by, COUNT(*) as total, MIN(created_at) as primera, MAX(created_at) as ultima')
            ->groupBy('uploaded_by')
            ->get();

        $rows = [];
        foreach ($byUploader as $g) {
            $userName = '(desconocido)';
            if ($g->uploaded_by) {
                $u = \App\Models\User::find($g->uploaded_by);
                if ($u) {
                    $userName = $u->name;
                }
            }
            $rows[] = [$g->uploaded_by ?? '-', $userName, $g->total, $g->primera, $g->ultima];
        }
        $this->table(['uploaded_by', 'usuario', 'total', 'primera carga', 'última carga'], $rows);

        $sentCount = (clone $query)->where('reminder_sent', true)->count();
        if ($sentCount > 0) {
            $this->warn("⚠️  De esas, {$sentCount} ya tienen reminder_sent=true (recordatorio ya enviado).");
        }

        if (!$this->option('force')) {
            if (!$this->confirm("¿Confirmas eliminar permanentemente {$total} cita(s)?", false)) {
                $this->info('Operación cancelada.');
                return Command::SUCCESS;
            }
        }

        $deleted = $query->delete();

        Log::warning('Eliminación masiva de citas por fecha', [
            'command' => 'appointments:delete-by-date',
            'date' => $date,
            'service' => $service,
            'only_pending' => $onlyPending,
            'deleted' => $deleted,
            'user' => 'CLI',
        ]);

        $this->info("✅ Eliminadas {$deleted} cita(s).");

        return Command::SUCCESS;
    }
}
