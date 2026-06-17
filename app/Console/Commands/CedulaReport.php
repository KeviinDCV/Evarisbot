<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Reporte de uso de la validación de cédulas, para justificar el feature ante el hospital.
 * Usa SOLO métricas (no cédulas ni nombres).
 *
 *   php artisan cedula:report
 *   php artisan cedula:report --days=60
 */
class CedulaReport extends Command
{
    protected $signature = 'cedula:report {--days=30 : Período a reportar, en días}';

    protected $description = 'Reporte de uso de la validación de cédulas (métricas para el hospital)';

    public function handle(): int
    {
        if (!Schema::hasTable('cedula_validation_logs')) {
            $this->error('La tabla cedula_validation_logs no existe. Corre: php artisan migrate');
            return self::FAILURE;
        }

        $days = max(1, (int) $this->option('days'));
        $since = now()->subDays($days);
        $base = DB::table('cedula_validation_logs')->where('created_at', '>=', $since);

        $total     = (clone $base)->count();
        $found     = (clone $base)->where('outcome', 'found')->count();
        $notFound  = (clone $base)->where('outcome', 'not_found')->count();
        $rate      = $total > 0 ? round($found / $total * 100, 1) : 0.0;

        $this->info("Validación de cédulas — últimos {$days} días (desde {$since->toDateString()})");
        $this->newLine();

        if ($total === 0) {
            $this->line('Aún no hay consultas registradas en el período.');
            return self::SUCCESS;
        }

        $this->table(['Métrica', 'Valor'], [
            ['Consultas totales', $total],
            ['Identidad encontrada', $found],
            ['No encontradas', $notFound],
            ['Tasa de acierto', "{$rate}%"],
            ['Consultas de pago evitadas (Didit gratis ≤500/mes)', $found],
        ]);

        // Por proveedor
        $byProvider = (clone $base)->select('provider', DB::raw('count(*) as n'))
            ->groupBy('provider')->orderByDesc('n')->get();
        if ($byProvider->isNotEmpty()) {
            $this->newLine();
            $this->comment('Por proveedor:');
            $this->table(['Proveedor', 'Consultas'], $byProvider->map(fn ($r) => [$r->provider, $r->n])->all());
        }

        // Por día (últimos 14 con actividad)
        $byDay = (clone $base)->select(DB::raw('DATE(created_at) as dia'), DB::raw('count(*) as n'))
            ->groupBy('dia')->orderByDesc('dia')->limit(14)->get();
        if ($byDay->isNotEmpty()) {
            $this->newLine();
            $this->comment('Por día (últimos con actividad):');
            $this->table(['Día', 'Consultas'], $byDay->map(fn ($r) => [$r->dia, $r->n])->all());
        }

        return self::SUCCESS;
    }
}
