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
        $this->createAdvisorsSheet($spreadsheet);

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
            ['Total de mensajes', $this->statistics['messages']['total']],
            ['Enviados por el sistema', $this->statistics['messages']['sent']],
            ['Recibidos de pacientes', $this->statistics['messages']['received']],
        ], self::COLOR_INFO);
        $row += 7;

        // Resumen de Citas
        $this->addSection($sheet, $row, 'CITAS', [
            ['Total', $this->statistics['appointments']['total']],
            ['Recordatorios enviados', $this->statistics['appointments']['reminder_sent']],
            ['Confirmadas', $this->statistics['appointments']['confirmed']],
            ['Canceladas', $this->statistics['appointments']['cancelled']],
            ['Pendientes', $this->statistics['appointments']['pending']],
            ['Fallidas', $this->statistics['appointments']['failed']],
        ], self::COLOR_PRIMARY);
        $row += 10;

        // Resumen de Conversaciones
        $this->addSection($sheet, $row, 'CONVERSACIONES', [
            ['Total', $this->statistics['conversations']['total']],
            ['Activas', $this->statistics['conversations']['active']],
            ['Pendientes', $this->statistics['conversations']['pending']],
            ['En progreso', $this->statistics['conversations']['in_progress'] ?? 0],
            ['Resueltas', $this->statistics['conversations']['resolved'] ?? 0],
            ['Cerradas', $this->statistics['conversations']['closed'] ?? 0],
            ['Con mensajes sin leer', $this->statistics['conversations']['unread']],
        ], self::COLOR_SUCCESS);
        $row += 11;

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
            ['Total de mensajes', $this->statistics['messages']['total']],
            ['Enviados por el sistema', $this->statistics['messages']['sent']],
            ['Recibidos de pacientes', $this->statistics['messages']['received']],
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
            ['En progreso', $this->statistics['conversations']['in_progress'] ?? 0],
            ['Resueltas', $this->statistics['conversations']['resolved'] ?? 0],
            ['Cerradas', $this->statistics['conversations']['closed'] ?? 0],
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

    private function createAdvisorsSheet(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Asesores');

        $row = 1;
        
        // Título de la hoja
        $sheet->setCellValue('A' . $row, 'RENDIMIENTO DE ASESORES');
        $sheet->mergeCells('A' . $row . ':G' . $row);
        $this->styleSheetTitle($sheet, $row, self::COLOR_PRIMARY);
        $row += 2;

        // Resumen general
        $sheet->setCellValue('A' . $row, 'RESUMEN GENERAL');
        $sheet->mergeCells('A' . $row . ':G' . $row);
        $this->styleSubtitle($sheet, $row);
        $row++;

        $sheet->setCellValue('A' . $row, 'Total de Asesores');
        $sheet->setCellValue('B' . $row, $this->statistics['advisors']['total_advisors']);
        $sheet->mergeCells('B' . $row . ':G' . $row);
        $this->styleInfoRow($sheet, $row, 'A');
        $row++;

        $sheet->setCellValue('A' . $row, 'Total Conversaciones');
        $sheet->setCellValue('B' . $row, $this->statistics['advisors']['total_conversations']);
        $sheet->mergeCells('B' . $row . ':G' . $row);
        $this->styleInfoRow($sheet, $row, 'A');
        $row++;

        $sheet->setCellValue('A' . $row, 'Total Resueltas');
        $sheet->setCellValue('B' . $row, $this->statistics['advisors']['total_resolved']);
        $sheet->mergeCells('B' . $row . ':G' . $row);
        $this->styleInfoRow($sheet, $row, 'A');
        $row++;

        $sheet->setCellValue('A' . $row, 'Total Activas');
        $sheet->setCellValue('B' . $row, $this->statistics['advisors']['total_active']);
        $sheet->mergeCells('B' . $row . ':G' . $row);
        $this->styleInfoRow($sheet, $row, 'A');
        $row++;

        $sheet->setCellValue('A' . $row, 'Conversaciones Sin Leer');
        $sheet->setCellValue('B' . $row, $this->statistics['advisors']['total_with_unread']);
        $sheet->mergeCells('B' . $row . ':G' . $row);
        $this->styleInfoRow($sheet, $row, 'A');
        $row++;

        $sheet->setCellValue('A' . $row, 'Total Mensajes Enviados');
        $sheet->setCellValue('B' . $row, $this->statistics['advisors']['total_messages_sent']);
        $sheet->mergeCells('B' . $row . ':G' . $row);
        $this->styleInfoRow($sheet, $row, 'A');
        $row++;

        $sheet->setCellValue('A' . $row, 'Tasa Resolución Promedio');
        $sheet->setCellValue('B' . $row, $this->statistics['advisors']['avg_resolution_rate'] . '%');
        $sheet->mergeCells('B' . $row . ':G' . $row);
        $this->styleInfoRow($sheet, $row, 'A');
        $row++;

        // Mejor asesor
        if ($this->statistics['advisors']['top_performer']) {
            $row++;
            $sheet->setCellValue('A' . $row, 'MEJOR ASESOR');
            $sheet->mergeCells('A' . $row . ':G' . $row);
            $this->styleSubtitle($sheet, $row);
            $row++;

            $top = $this->statistics['advisors']['top_performer'];
            $sheet->setCellValue('A' . $row, 'Nombre');
            $sheet->setCellValue('B' . $row, $top['name']);
            $sheet->mergeCells('B' . $row . ':G' . $row);
            $this->styleInfoRow($sheet, $row, 'A');
            $row++;

            $sheet->setCellValue('A' . $row, 'Conversaciones Resueltas');
            $sheet->setCellValue('B' . $row, $top['resolved_conversations']);
            $sheet->mergeCells('B' . $row . ':G' . $row);
            $this->styleInfoRow($sheet, $row, 'A');
            $row++;

            $sheet->setCellValue('A' . $row, 'Tasa de Resolución');
            $sheet->setCellValue('B' . $row, $top['resolution_rate'] . '%');
            $sheet->mergeCells('B' . $row . ':G' . $row);
            $this->styleInfoRow($sheet, $row, 'A');
            $row++;
        }

        // Detalle por asesor
        $row++;
        $sheet->setCellValue('A' . $row, 'DETALLE POR ASESOR');
        $sheet->mergeCells('A' . $row . ':G' . $row);
        $this->styleSubtitle($sheet, $row);
        $row += 2;

        // Encabezados de la tabla
        $headers = ['Asesor', 'Total Conversaciones', 'Resueltas', 'Activas', 'Con Sin Leer', 'Mensajes Enviados', 'Tasa de Resolución'];
        $col = 'A';
        foreach ($headers as $header) {
            $sheet->setCellValue($col . $row, $header);
            $col++;
        }
        $this->styleAdvisorHeader($sheet, $row, 'A', 'G');
        $row++;

        // Datos de cada asesor
        $dataRow = 0;
        foreach ($this->statistics['advisors']['advisors'] as $advisor) {
            $this->styleDataRow($sheet, $row, $dataRow % 2 == 0, 'A', 'G');
            
            $sheet->setCellValue('A' . $row, $advisor['name']);
            $sheet->setCellValue('B' . $row, $advisor['total_conversations']);
            $sheet->setCellValue('C' . $row, $advisor['resolved_conversations']);
            $sheet->setCellValue('D' . $row, $advisor['active_conversations']);
            $sheet->setCellValue('E' . $row, $advisor['conversations_with_unread']);
            $sheet->setCellValue('F' . $row, $advisor['messages_sent']);
            $sheet->setCellValue('G' . $row, $advisor['resolution_rate'] . '%');
            
            // Centrar valores numéricos
            $sheet->getStyle('B' . $row . ':G' . $row)->applyFromArray([
                'alignment' => [
                    'horizontal' => Alignment::HORIZONTAL_CENTER,
                ],
            ]);
            
            $row++;
            $dataRow++;
        }

        // Ajustar anchos de columna
        $sheet->getColumnDimension('A')->setWidth(30);
        $sheet->getColumnDimension('B')->setWidth(20);
        $sheet->getColumnDimension('C')->setWidth(15);
        $sheet->getColumnDimension('D')->setWidth(15);
        $sheet->getColumnDimension('E')->setWidth(15);
        $sheet->getColumnDimension('F')->setWidth(20);
        $sheet->getColumnDimension('G')->setWidth(18);
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

    private function styleAdvisorHeader($sheet, int $row, string $startCol = 'A', string $endCol = 'B'): void
    {
        $sheet->getStyle($startCol . $row . ':' . $endCol . $row)->applyFromArray([
            'font' => [
                'bold' => true,
                'size' => 10,
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

    private function styleDataRow($sheet, int $row, bool $isEven = false, string $startCol = 'A', string $endCol = 'B'): void
    {
        $bgColor = $isEven ? 'FFFFFF' : 'F8F9FA';
        $sheet->getStyle($startCol . $row . ':' . $endCol . $row)->applyFromArray([
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
        $sheet->getStyle($startCol . $row)->applyFromArray([
            'font' => ['size' => 10],
        ]);
        $sheet->getStyle($endCol . $row)->applyFromArray([
            'font' => ['size' => 10, 'bold' => true],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
            ],
        ]);
        $sheet->getRowDimension($row)->setRowHeight(20);
    }

    private function styleInfoRow($sheet, int $row, string $mergeEndCol = 'B'): void
    {
        $sheet->getStyle('A' . $row . ':' . $mergeEndCol . $row)->applyFromArray([
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
