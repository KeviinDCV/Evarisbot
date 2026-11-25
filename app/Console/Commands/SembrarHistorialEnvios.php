<?php

namespace App\Console\Commands;

use App\Support\HistorialEnvios;
use Illuminate\Console\Command;

/**
 * Pasa al historial de envíos (tablas envios_recordatorio / envio_recordatorio_cita) el último envío de cada ámbito
 * que quedó en settings con su lista exacta de citas. Se corre una vez al publicar el historial. Sin --aplicar solo
 * dice qué haría. No inventa los envíos anteriores: no hay lista de sus citas.
 */
class SembrarHistorialEnvios extends Command
{
    protected $signature = 'recordatorios:historial-sembrar {--aplicar : Escribe en el historial (sin esto solo muestra)}';

    protected $description = 'Pasa al historial de envíos de Citas el último envío de cada ámbito (General y Oncología)';

    public function handle(): int
    {
        $aplicar = (bool) $this->option('aplicar');

        foreach (['general', 'oncology'] as $service) {
            $r = HistorialEnvios::sembrarUltimo($service, $aplicar);
            $this->line(json_encode($r, JSON_UNESCAPED_UNICODE));
        }
        if (! $aplicar) {
            $this->warn('Simulación: no se escribió nada. Use --aplicar para pasarlo al historial.');
        }

        return self::SUCCESS;
    }
}
