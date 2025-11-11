<?php

namespace App\Exports;

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Font;
use PhpOffice\PhpSpreadsheet\Style\Border;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StatisticsExport
{
    protected $statistics;
    protected $dateRange;
    
    // Colores institucionales
    private const COLOR_PRIMARY = '2E3F84'; // Azul institucional
    private const COLOR_PRIMARY_LIGHT = '3E4F94'; // Azul más claro
    private const COLOR_SECONDARY = 'E8EBF5'; // Gris claro
    private const COLOR_SUCCESS = '10B981'; // Verde
    private const COLOR_WARNING = 'F59E0B'; // Amarillo
    private const COLOR_DANGER = 'EF4444'; // Rojo
    private const COLOR_INFO = '3B82F6'; // Azul info

    public function __construct(array $statistics, array $dateRange)
    {
        $this->statistics = $statistics;
        $this->dateRange = $dateRange;
    }

    public function download(string $fileName): StreamedResponse
    {
        $spreadsheet = new Spreadsheet();
        
        // Crear hojas
        $this->createSummarySheet($spreadsheet);
        $this->createMessagesSheet($spreadsheet);
        $this->createAppointmentsSheet($spreadsheet);
        $this->createConversationsSheet($spreadsheet);
        $this->createTemplatesSheet($spreadsheet);
        $this->createUsersSheet($spreadsheet);

        // Eliminar la hoja por defecto
        $spreadsheet->removeSheetByIndex(0);

        $writer = new Xlsx($spreadsheet);

        return new StreamedResponse(function () use ($writer) {
            $writer->save('php://output');
        }, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="' . $fileName . '"',
            'Cache-Control' => 'max-age=0',
        ]);
    }

    private function createSummarySheet(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Resumen');

        $row = 1;
        
        // Título principal con estilo institucional
        $sheet->setCellValue('A' . $row, 'ESTADÍSTICAS DEL SISTEMA');
        $sheet->mergeCells('A' . $row . ':B' . $row);
        $sheet->getStyle('A' . $row)->applyFromArray([
            'font' => [
                'bold' => true,
                'size' => 18,
                'color' => ['rgb' => 'FFFFFF'],
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => self::COLOR_PRIMARY],
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => self::COLOR_PRIMARY],
                ],
            ],
        ]);
        $sheet->getRowDimension($row)->setRowHeight(35);
        $row += 2;

        // Información del rango de fechas
        $periodLabel = match($this->dateRange['period'] ?? 'all') {
            'today' => 'Hoy',
            'week' => 'Esta semana',
            'month' => 'Este mes',
            'year' => 'Este año',
            default => 'Todo el tiempo',
        };

        $sheet->setCellValue('A' . $row, 'Período');
        $sheet->setCellValue('B' . $row, $periodLabel);
        $this->styleInfoRow($sheet, $row);
        $row++;
        
        if ($this->dateRange['start'] && $this->dateRange['end']) {
            $sheet->setCellValue('A' . $row, 'Desde');
            $sheet->setCellValue('B' . $row, $this->dateRange['start']);
            $this->styleInfoRow($sheet, $row);
            $row++;
            $sheet->setCellValue('A' . $row, 'Hasta');
            $sheet->setCellValue('B' . $row, $this->dateRange['end']);
            $this->styleInfoRow($sheet, $row);
            $row++;
        }
        $row++;

        // Resumen de Mensajes
        $this->addSection($sheet, $row, 'MENSAJES', [
            ['Enviados', $this->statistics['messages']['sent']],
            ['Contestados', $this->statistics['messages']['answered']],
            ['Confirmados', $this->statistics['messages']['confirmed']],
            ['Cancelados', $this->statistics['messages']['cancelled']],
            ['Reprogramados', $this->statistics['messages']['rescheduled']],
        ], self::COLOR_INFO);
        $row += 8;

        // Resumen de Citas
        $this->addSection($sheet, $row, 'CITAS', [
            ['Total', $this->statistics['appointments']['total']],
            ['Recordatorios enviados', $this->statistics['appointments']['reminder_sent']],
            ['Confirmadas', $this->statistics['appointments']['confirmed']],
            ['Canceladas', $this->statistics['appointments']['cancelled']],
            ['Reprogramadas', $this->statistics['appointments']['rescheduled']],
            ['Pendientes', $this->statistics['appointments']['pending']],
            ['Fallidas', $this->statistics['appointments']['failed']],
        ], self::COLOR_PRIMARY);
        $row += 10;

        // Resumen de Conversaciones
        $this->addSection($sheet, $row, 'CONVERSACIONES', [
            ['Total', $this->statistics['conversations']['total']],
            ['Activas', $this->statistics['conversations']['active']],
            ['Pendientes', $this->statistics['conversations']['pending']],
            ['Cerradas', $this->statistics['conversations']['closed']],
            ['Con mensajes sin leer', $this->statistics['conversations']['unread']],
        ], self::COLOR_SUCCESS);
        $row += 8;

        // Resumen de Plantillas
        $this->addSection($sheet, $row, 'PLANTILLAS', [
            ['Total', $this->statistics['templates']['total']],
            ['Envíos exitosos', $this->statistics['templates']['successful_sends']],
            ['Envíos fallidos', $this->statistics['templates']['failed_sends']],
            ['Total de envíos', $this->statistics['templates']['total_sends']],
        ], self::COLOR_WARNING);
        $row += 7;

        // Resumen de Usuarios
        $this->addSection($sheet, $row, 'USUARIOS', [
            ['Total', $this->statistics['users']['total']],
            ['Administradores', $this->statistics['users']['admins']],
            ['Asesores', $this->statistics['users']['advisors']],
        ], self::COLOR_PRIMARY_LIGHT);

        // Ajustar anchos de columna
        $sheet->getColumnDimension('A')->setWidth(35);
        $sheet->getColumnDimension('B')->setWidth(25);
    }

    private function createMessagesSheet(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Mensajes');

        $row = 1;
        
        // Título de la hoja
        $sheet->setCellValue('A' . $row, 'ESTADÍSTICAS DE MENSAJES');
        $sheet->mergeCells('A' . $row . ':B' . $row);
        $this->styleSheetTitle($sheet, $row, self::COLOR_INFO);
        $row += 2;

        $sheet->setCellValue('A' . $row, 'Métrica');
        $sheet->setCellValue('B' . $row, 'Valor');
        $this->styleHeader($sheet, $row);
        $row++;

        $data = [
            ['Enviados', $this->statistics['messages']['sent']],
            ['Contestados', $this->statistics['messages']['answered']],
            ['Confirmados', $this->statistics['messages']['confirmed']],
            ['Cancelados', $this->statistics['messages']['cancelled']],
            ['Reprogramados', $this->statistics['messages']['rescheduled']],
        ];

        $dataRow = 0;
        foreach ($data as $item) {
            $this->styleDataRow($sheet, $row, $dataRow % 2 == 0);
            $sheet->setCellValue('A' . $row, $item[0]);
            $sheet->setCellValue('B' . $row, $item[1]);
            $row++;
            $dataRow++;
        }

        $row++;
        $sheet->setCellValue('A' . $row, 'Por Estado:');
        $sheet->mergeCells('A' . $row . ':B' . $row);
        $this->styleSubtitle($sheet, $row);
        $row++;

        foreach ($this->statistics['messages']['by_status'] as $status => $count) {
            $this->styleDataRow($sheet, $row, $dataRow % 2 == 0);
            $sheet->setCellValue('A' . $row, ucfirst($status));
            $sheet->setCellValue('B' . $row, $count);
            $row++;
            $dataRow++;
        }

        $sheet->getColumnDimension('A')->setWidth(35);
        $sheet->getColumnDimension('B')->setWidth(25);
    }

    private function createAppointmentsSheet(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Citas');

        $row = 1;
        
        // Título de la hoja
        $sheet->setCellValue('A' . $row, 'ESTADÍSTICAS DE CITAS');
        $sheet->mergeCells('A' . $row . ':B' . $row);
        $this->styleSheetTitle($sheet, $row, self::COLOR_PRIMARY);
        $row += 2;

        $sheet->setCellValue('A' . $row, 'Métrica');
        $sheet->setCellValue('B' . $row, 'Valor');
        $this->styleHeader($sheet, $row);
        $row++;

        $data = [
            ['Total', $this->statistics['appointments']['total']],
            ['Recordatorios enviados', $this->statistics['appointments']['reminder_sent']],
            ['Confirmadas', $this->statistics['appointments']['confirmed']],
            ['Canceladas', $this->statistics['appointments']['cancelled']],
            ['Reprogramadas', $this->statistics['appointments']['rescheduled']],
            ['Pendientes', $this->statistics['appointments']['pending']],
            ['Fallidas', $this->statistics['appointments']['failed']],
        ];

        $dataRow = 0;
        foreach ($data as $item) {
            $this->styleDataRow($sheet, $row, $dataRow % 2 == 0);
            $sheet->setCellValue('A' . $row, $item[0]);
            $sheet->setCellValue('B' . $row, $item[1]);
            $row++;
            $dataRow++;
        }

        $row++;
        $sheet->setCellValue('A' . $row, 'Por Estado:');
        $sheet->mergeCells('A' . $row . ':B' . $row);
        $this->styleSubtitle($sheet, $row);
        $row++;

        foreach ($this->statistics['appointments']['by_status'] as $status => $count) {
            $this->styleDataRow($sheet, $row, $dataRow % 2 == 0);
            $sheet->setCellValue('A' . $row, ucfirst($status));
            $sheet->setCellValue('B' . $row, $count);
            $row++;
            $dataRow++;
        }

        $sheet->getColumnDimension('A')->setWidth(35);
        $sheet->getColumnDimension('B')->setWidth(25);
    }

    private function createConversationsSheet(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Conversaciones');

        $row = 1;
        
        // Título de la hoja
        $sheet->setCellValue('A' . $row, 'ESTADÍSTICAS DE CONVERSACIONES');
        $sheet->mergeCells('A' . $row . ':B' . $row);
        $this->styleSheetTitle($sheet, $row, self::COLOR_SUCCESS);
        $row += 2;

        $sheet->setCellValue('A' . $row, 'Métrica');
        $sheet->setCellValue('B' . $row, 'Valor');
        $this->styleHeader($sheet, $row);
        $row++;

        $data = [
            ['Total', $this->statistics['conversations']['total']],
            ['Activas', $this->statistics['conversations']['active']],
            ['Pendientes', $this->statistics['conversations']['pending']],
            ['Cerradas', $this->statistics['conversations']['closed']],
            ['Con mensajes sin leer', $this->statistics['conversations']['unread']],
        ];

        $dataRow = 0;
        foreach ($data as $item) {
            $this->styleDataRow($sheet, $row, $dataRow % 2 == 0);
            $sheet->setCellValue('A' . $row, $item[0]);
            $sheet->setCellValue('B' . $row, $item[1]);
            $row++;
            $dataRow++;
        }

        $row++;
        $sheet->setCellValue('A' . $row, 'Por Estado:');
        $sheet->mergeCells('A' . $row . ':B' . $row);
        $this->styleSubtitle($sheet, $row);
        $row++;

        foreach ($this->statistics['conversations']['by_status'] as $status => $count) {
            $this->styleDataRow($sheet, $row, $dataRow % 2 == 0);
            $sheet->setCellValue('A' . $row, ucfirst($status));
            $sheet->setCellValue('B' . $row, $count);
            $row++;
            $dataRow++;
        }

        $sheet->getColumnDimension('A')->setWidth(35);
        $sheet->getColumnDimension('B')->setWidth(25);
    }

    private function createTemplatesSheet(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Plantillas');

        $row = 1;
        
        // Título de la hoja
        $sheet->setCellValue('A' . $row, 'ESTADÍSTICAS DE PLANTILLAS');
        $sheet->mergeCells('A' . $row . ':B' . $row);
        $this->styleSheetTitle($sheet, $row, self::COLOR_WARNING);
        $row += 2;

        $sheet->setCellValue('A' . $row, 'Métrica');
        $sheet->setCellValue('B' . $row, 'Valor');
        $this->styleHeader($sheet, $row);
        $row++;

        $data = [
            ['Total de plantillas', $this->statistics['templates']['total']],
            ['Envíos exitosos', $this->statistics['templates']['successful_sends']],
            ['Envíos fallidos', $this->statistics['templates']['failed_sends']],
            ['Total de envíos', $this->statistics['templates']['total_sends']],
        ];

        $dataRow = 0;
        foreach ($data as $item) {
            $this->styleDataRow($sheet, $row, $dataRow % 2 == 0);
            $sheet->setCellValue('A' . $row, $item[0]);
            $sheet->setCellValue('B' . $row, $item[1]);
            $row++;
            $dataRow++;
        }

        $sheet->getColumnDimension('A')->setWidth(35);
        $sheet->getColumnDimension('B')->setWidth(25);
    }

    private function createUsersSheet(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Usuarios');

        $row = 1;
        
        // Título de la hoja
        $sheet->setCellValue('A' . $row, 'ESTADÍSTICAS DE USUARIOS');
        $sheet->mergeCells('A' . $row . ':B' . $row);
        $this->styleSheetTitle($sheet, $row, self::COLOR_PRIMARY_LIGHT);
        $row += 2;

        $sheet->setCellValue('A' . $row, 'Métrica');
        $sheet->setCellValue('B' . $row, 'Valor');
        $this->styleHeader($sheet, $row);
        $row++;

        $data = [
            ['Total', $this->statistics['users']['total']],
            ['Administradores', $this->statistics['users']['admins']],
            ['Asesores', $this->statistics['users']['advisors']],
        ];

        $dataRow = 0;
        foreach ($data as $item) {
            $this->styleDataRow($sheet, $row, $dataRow % 2 == 0);
            $sheet->setCellValue('A' . $row, $item[0]);
            $sheet->setCellValue('B' . $row, $item[1]);
            $row++;
            $dataRow++;
        }

        $sheet->getColumnDimension('A')->setWidth(35);
        $sheet->getColumnDimension('B')->setWidth(25);
    }

    private function addSection($sheet, int $startRow, string $title, array $data, string $color): void
    {
        $row = $startRow;
        
        // Título de sección con color
        $sheet->setCellValue('A' . $row, $title);
        $sheet->mergeCells('A' . $row . ':B' . $row);
        $sheet->getStyle('A' . $row)->applyFromArray([
            'font' => [
                'bold' => true,
                'size' => 12,
                'color' => ['rgb' => 'FFFFFF'],
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => $color],
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => $color],
                ],
            ],
        ]);
        $sheet->getRowDimension($row)->setRowHeight(25);
        $row++;

        // Datos con filas alternadas
        $dataRow = 0;
        foreach ($data as $item) {
            $this->styleDataRow($sheet, $row, $dataRow % 2 == 0);
            $sheet->setCellValue('A' . $row, $item[0]);
            $sheet->setCellValue('B' . $row, $item[1]);
            $row++;
            $dataRow++;
        }
    }

    private function styleHeader($sheet, int $row): void
    {
        $sheet->getStyle('A' . $row . ':B' . $row)->applyFromArray([
            'font' => [
                'bold' => true,
                'size' => 11,
                'color' => ['rgb' => 'FFFFFF'],
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => self::COLOR_PRIMARY],
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => self::COLOR_PRIMARY],
                ],
            ],
        ]);
        $sheet->getRowDimension($row)->setRowHeight(25);
    }

    private function styleDataRow($sheet, int $row, bool $isEven = false): void
    {
        $bgColor = $isEven ? 'FFFFFF' : 'F8F9FA';
        $sheet->getStyle('A' . $row . ':B' . $row)->applyFromArray([
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => $bgColor],
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => 'E5E7EB'],
                ],
            ],
            'alignment' => [
                'vertical' => Alignment::VERTICAL_CENTER,
            ],
        ]);
        $sheet->getStyle('A' . $row)->applyFromArray([
            'font' => ['size' => 10],
        ]);
        $sheet->getStyle('B' . $row)->applyFromArray([
            'font' => ['size' => 10, 'bold' => true],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
            ],
        ]);
        $sheet->getRowDimension($row)->setRowHeight(20);
    }

    private function styleInfoRow($sheet, int $row): void
    {
        $sheet->getStyle('A' . $row . ':B' . $row)->applyFromArray([
            'font' => ['size' => 10],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => self::COLOR_SECONDARY],
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => 'D1D5DB'],
                ],
            ],
        ]);
        $sheet->getStyle('A' . $row)->applyFromArray([
            'font' => ['bold' => true],
        ]);
    }

    private function styleSheetTitle($sheet, int $row, string $color): void
    {
        $sheet->getStyle('A' . $row)->applyFromArray([
            'font' => [
                'bold' => true,
                'size' => 14,
                'color' => ['rgb' => 'FFFFFF'],
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => $color],
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => $color],
                ],
            ],
        ]);
        $sheet->getRowDimension($row)->setRowHeight(30);
    }

    private function styleSubtitle($sheet, int $row): void
    {
        $sheet->getStyle('A' . $row)->applyFromArray([
            'font' => [
                'bold' => true,
                'size' => 11,
                'color' => ['rgb' => self::COLOR_PRIMARY],
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => self::COLOR_SECONDARY],
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_LEFT,
                'vertical' => Alignment::VERTICAL_CENTER,
            ],
        ]);
        $sheet->getRowDimension($row)->setRowHeight(22);
    }
}
