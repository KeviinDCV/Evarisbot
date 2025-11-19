<?php

namespace App\Exports;

use App\Models\Appointment;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use Illuminate\Database\Eloquent\Builder;

class AppointmentsExport implements FromQuery, WithHeadings, WithMapping, WithStyles, WithColumnWidths
{
    protected $query;

    public function __construct(Builder $query)
    {
        $this->query = $query;
    }

    public function query()
    {
        return $this->query;
    }

    public function headings(): array
    {
        return [
            'Admisión',
            'IPS',
            'Paciente',
            'Cédula',
            'Teléfono',
            'Fecha Cita',
            'Hora',
            'Médico',
            'Especialidad',
            'Convenio',
            'Observaciones',
            'Recordatorio Enviado',
            'Fecha Envío',
            'Estado Recordatorio',
        ];
    }

    public function map($appointment): array
    {
        return [
            $appointment->citead ?? '',
            $appointment->cianom ?? '',
            $appointment->nom_paciente ?? '',
            $appointment->citide ?? '',
            $appointment->pactel ?? '',
            $appointment->citfc ? $appointment->citfc->format('Y-m-d') : '',
            $appointment->cithor ? $appointment->cithor->format('H:i') : '',
            $appointment->mednom ?? '',
            $appointment->espnom ?? '',
            $appointment->connom ?? '',
            $appointment->citobsobs ?? '',
            $appointment->reminder_sent ? 'Sí' : 'No',
            $appointment->reminder_sent_at ? $appointment->reminder_sent_at->format('Y-m-d H:i') : '',
            $this->getStatusLabel($appointment->reminder_status),
        ];
    }

    private function getStatusLabel(?string $status): string
    {
        return match($status) {
            'pending' => 'Pendiente',
            'sent' => 'Enviado',
            'delivered' => 'Entregado',
            'read' => 'Leído',
            'confirmed' => 'Confirmado',
            'cancelled' => 'Cancelado',
            'failed' => 'Fallido',
            default => '-',
        };
    }

    public function styles(Worksheet $sheet)
    {
        return [
            1 => [
                'font' => [
                    'bold' => true,
                    'size' => 12,
                    'color' => ['rgb' => 'FFFFFF'],
                ],
                'fill' => [
                    'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '2e3f84'],
                ],
            ],
        ];
    }

    public function columnWidths(): array
    {
        return [
            'A' => 12, // Admisión
            'B' => 20, // IPS
            'C' => 30, // Paciente
            'D' => 15, // Cédula
            'E' => 15, // Teléfono
            'F' => 12, // Fecha Cita
            'G' => 8,  // Hora
            'H' => 25, // Médico
            'I' => 20, // Especialidad
            'J' => 20, // Convenio
            'K' => 40, // Observaciones
            'L' => 12, // Recordatorio Enviado
            'M' => 16, // Fecha Envío
            'N' => 18, // Estado Recordatorio
        ];
    }
}
