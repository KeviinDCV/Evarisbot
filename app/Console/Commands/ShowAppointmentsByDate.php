<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Appointment;
use App\Models\User;
use Carbon\Carbon;

class ShowAppointmentsByDate extends Command
{
    protected $signature = 'appointments:show-by-date
                            {date : Fecha citfc a inspeccionar (YYYY-MM-DD)}
                            {--service=general : Servicio (general u oncology)}
                            {--only-pending : Solo las que aún no tienen recordatorio enviado}
                            {--samples=10 : Cuántas filas de muestra mostrar}';

    protected $description = 'Mostrar quién subió las citas de una fecha y un resumen (solo lectura)';

    public function handle()
    {
        $dateInput = $this->argument('date');
        $service = $this->option('service');
        $onlyPending = $this->option('only-pending');
        $sampleSize = (int) $this->option('samples');

        try {
            $date = Carbon::parse($dateInput)->format('Y-m-d');
        } catch (\Throwable $e) {
            $this->error("Fecha inválida: {$dateInput}. Usa formato YYYY-MM-DD.");
            return Command::FAILURE;
        }

        $query = Appointment::where('service', $service)
            ->whereDate('citfc', '=', $date);

        if ($onlyPending) {
            $query->where('reminder_sent', false);
        }

        $total = (clone $query)->count();

        $this->info("Servicio: {$service} | citfc: {$date} | solo pendientes: " . ($onlyPending ? 'sí' : 'no'));
        $this->info("Total de citas: {$total}");

        if ($total === 0) {
            return Command::SUCCESS;
        }

        // Desglose por usuario que subió
        $byUploader = (clone $query)
            ->selectRaw('uploaded_by, COUNT(*) as total, MIN(created_at) as primera, MAX(created_at) as ultima')
            ->groupBy('uploaded_by')
            ->orderByDesc('total')
            ->get();

        $rows = [];
        foreach ($byUploader as $g) {
            $userInfo = '(sin uploaded_by)';
            if ($g->uploaded_by) {
                $u = User::find($g->uploaded_by);
                $userInfo = $u ? "{$u->name} <{$u->email}>" : "ID {$g->uploaded_by} (usuario eliminado)";
            }
            $rows[] = [$g->uploaded_by ?? '-', $userInfo, $g->total, $g->primera, $g->ultima];
        }

        $this->newLine();
        $this->line('--- Quién las subió ---');
        $this->table(['uploaded_by', 'usuario', 'total', 'primera carga', 'última carga'], $rows);

        // Desglose por fecha de carga
        $byCreated = (clone $query)
            ->selectRaw('DATE(created_at) as fecha_carga, COUNT(*) as total')
            ->groupBy('fecha_carga')
            ->orderBy('fecha_carga')
            ->get();

        $this->line('--- Cuándo se subieron (fecha de created_at) ---');
        $this->table(
            ['fecha_carga', 'total'],
            $byCreated->map(fn($d) => [$d->fecha_carga, $d->total])->all()
        );

        // Muestras
        if ($sampleSize > 0) {
            $this->line("--- Muestras (primeras {$sampleSize} por id asc) ---");
            $samples = (clone $query)->orderBy('id')->take($sampleSize)->get([
                'id', 'pachis', 'nom_paciente', 'pactel', 'cithor',
                'mednom', 'espnom', 'created_at', 'uploaded_by',
            ]);
            $sampleRows = $samples->map(fn($a) => [
                $a->id,
                $a->pachis ?? '-',
                $a->nom_paciente ?? '-',
                $a->pactel ?? '-',
                $a->cithor ? $a->cithor->format('H:i') : '-',
                $a->mednom ?? '-',
                $a->espnom ?? '-',
                $a->created_at,
                $a->uploaded_by ?? '-',
            ])->all();
            $this->table(
                ['id', 'pachis', 'paciente', 'tel', 'hora', 'médico', 'esp', 'created_at', 'uploaded_by'],
                $sampleRows
            );
        }

        return Command::SUCCESS;
    }
}
