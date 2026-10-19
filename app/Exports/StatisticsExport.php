<?php

namespace App\Exports;

use Carbon\Carbon;
use Illuminate\Support\Arr;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Shared\Date as FechaExcel;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\PageSetup;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Excel de /admin/statistics, el que acaba en los informes para la jefatura.
 *
 * Recibe el MISMO array `statistics` que pinta la pantalla (date_range en hora de Colombia,
 * generated_at, data_gaps, flowDemand…), así el Excel tiene las mismas cifras y los mismos
 * rótulos que se ven en la página.
 *
 * Reglas de escritura:
 * - Cantidades, porcentajes y dinero van como NÚMEROS con formato de celda: se pueden sumar
 *   y ordenar, y Excel los muestra con la coma o el punto del equipo de quien lo abre.
 * - null → «Sin datos» (texto). Nunca un «%» suelto ni un 0 inventado.
 * - Todo texto que viene de la base (nombres, EPS que escriben los pacientes) se guarda como
 *   texto explícito: un «=…» no se convierte en fórmula.
 */
class StatisticsExport
{
    protected array $statistics;

    protected array $dateRange;

    // Colores institucionales
    private const COLOR_PRIMARY = '2E3F84'; // Azul institucional
    private const COLOR_PRIMARY_LIGHT = '3E4F94'; // Azul más claro
    private const COLOR_SECONDARY = 'E8EBF5'; // Gris claro
    private const COLOR_SUCCESS = '10B981'; // Verde
    private const COLOR_WARNING = 'F59E0B'; // Amarillo
    private const COLOR_DANGER = 'EF4444'; // Rojo
    private const COLOR_INFO = '3B82F6'; // Azul info
    private const COLOR_SUAVE = '6B7280'; // Texto gris de las notas
    private const COLOR_AVISO_FONDO = 'FEF3C7'; // Ámbar claro de los avisos
    private const COLOR_AVISO_TEXTO = '92400E'; // Ámbar oscuro de los avisos

    private const ZONA = 'America/Bogota';

    private const FMT_ENTERO = '#,##0';
    private const FMT_PCT = '0.0%';
    private const FMT_FECHA = 'dd/mm/yyyy';

    private const SIN_DATOS = 'Sin datos';

    /** Desde este día Meta manda el dato de cobro (migración add_pricing_fields_to_messages_table). */
    private const INICIO_MEDICION_COSTO = '2026-07-02';

    private const MESES = [
        1 => 'enero', 2 => 'febrero', 3 => 'marzo', 4 => 'abril', 5 => 'mayo', 6 => 'junio',
        7 => 'julio', 8 => 'agosto', 9 => 'septiembre', 10 => 'octubre', 11 => 'noviembre', 12 => 'diciembre',
    ];

    /** Igual que resources/js/lib/nombres.ts: van en minúscula salvo al principio. */
    private const PARTICULAS = ['de', 'del', 'la', 'las', 'los', 'y'];

    /** Temas de data_gaps → nombre que lee el administrador. */
    private const TEMAS = [
        'messages' => 'Mensajes',
        'delivery' => 'Estado de entrega',
        'appointments' => 'Citas',
        'conversations' => 'Conversaciones',
        'costs' => 'Costo',
        'advisors' => 'Asesores',
    ];

    /** Textos de los vacíos de datos conocidos (los mismos de la pantalla). */
    private const TEXTOS_VACIOS = [
        'messages_nov2025_jan2026' => 'Noviembre y diciembre de 2025 casi no tienen mensajes guardados y enero de 2026 no tiene ninguno: no es una caída real.',
        'appointments_since_aug2026' => 'Desde el 13 de agosto de 2026 no se cargan agendas en Citas: las cifras de citas posteriores están incompletas.',
        'webhook_oct2026' => 'Del 11 al 13 de octubre de 2026 no llegaron mensajes de pacientes ni estados de entrega (incidente del webhook): las cifras de esos días están incompletas.',
        'late_oct2026' => 'Del 14 al 15 de octubre de 2026 los mensajes llegaron con retraso: se cuentan con la hora en que llegaron.',
        'cost_attacker_oct2026' => 'No incluye lo que Meta cobró por los envíos del atacante durante el incidente (~US$46,72).',
        'history_before_mar2026' => 'Antes del 31 de marzo de 2026 no hay historial de asignaciones ni resoluciones: para esas fechas no se pueden contar las resueltas ni las agendadas por asesor.',
    ];

    /**
     * @param  array  $statistics  El array `statistics` del contrato (el mismo de la pantalla).
     * @param  array|null  $dateRange  Solo por compatibilidad con la llamada antigua: si el array
     *                                 trae date_range (en hora de Colombia), manda ese.
     */
    public function __construct(array $statistics, ?array $dateRange = null)
    {
        $this->statistics = $statistics;
        $this->dateRange = ($statistics['date_range'] ?? null) ?: ($dateRange ?? []);
    }

    public function download(string $fileName): StreamedResponse
    {
        $spreadsheet = new Spreadsheet();
        $spreadsheet->getProperties()
            ->setCreator('Evarisbot')
            ->setTitle('Estadísticas de Evarisbot');

        $this->createSummarySheet($spreadsheet);
        $this->createNoticesSheet($spreadsheet);
        $this->createMessagesSheet($spreadsheet);
        $this->createAppointmentsSheet($spreadsheet);
        $this->createConversationsSheet($spreadsheet);
        $this->createTemplatesSheet($spreadsheet);
        $this->createCostsSheet($spreadsheet);
        $this->createUsersSheet($spreadsheet);
        $this->createAdvisorsSheet($spreadsheet);
        $this->createWelcomeMenuSheet($spreadsheet);

        // Eliminar la hoja por defecto y abrir en «Resumen»
        $spreadsheet->removeSheetByIndex(0);
        $spreadsheet->setActiveSheetIndex(0);

        $writer = new Xlsx($spreadsheet);

        return new StreamedResponse(function () use ($writer) {
            $writer->save('php://output');
        }, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="' . $fileName . '"',
            'Cache-Control' => 'max-age=0',
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Hojas
    // ─────────────────────────────────────────────────────────────────────────────

    private function createSummarySheet(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Resumen');
        $sheet->getColumnDimension('A')->setWidth(52);
        $sheet->getColumnDimension('B')->setWidth(40);

        // Título principal con estilo institucional
        $sheet->setCellValue('A1', 'ESTADÍSTICAS DE EVARISBOT');
        $sheet->mergeCells('A1:B1');
        $sheet->getStyle('A1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 18, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => self::COLOR_PRIMARY]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => self::COLOR_PRIMARY]]],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(35);

        // El nombre del hospital va aparte y en letra normal para que no se corte.
        $sheet->setCellValue('A2', 'Hospital Universitario del Valle');
        $sheet->mergeCells('A2:B2');
        $sheet->getStyle('A2')->applyFromArray([
            'font' => ['size' => 11, 'color' => ['rgb' => self::COLOR_PRIMARY]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
        ]);
        $sheet->getRowDimension(2)->setRowHeight(20);
        $row = 4;

        // Período, fechas (hora de Colombia) y hora de corte de las cifras
        $info = [['Período', $this->periodLabel()]];
        $start = $this->dateRange['start'] ?? null;
        $end = $this->dateRange['end'] ?? null;
        if ($start && $end) {
            $hasta = $this->fechaLarga($end);
            // Un período en curso (este mes, este año…) termina después de hoy: las cifras
            // llegan hasta la hora de «Generado», no hasta esa fecha.
            if (substr((string) $end, 0, 10) > $this->generado()->toDateString()) {
                $hasta .= ' (período en curso)';
            }
            $info[] = ['Desde', $this->fechaLarga($start)];
            $info[] = ['Hasta', $hasta];
        }
        $info[] = ['Generado', $this->generadoTexto()];

        foreach ($info as [$label, $value]) {
            $sheet->setCellValueExplicit('A' . $row, $label, DataType::TYPE_STRING);
            $sheet->setCellValueExplicit('B' . $row, $value, DataType::TYPE_STRING);
            $this->styleInfoRow($sheet, $row);
            $sheet->getStyle('A' . $row . ':B' . $row)->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);
            $sheet->getStyle('B' . $row)->getAlignment()->setWrapText(true);
            $this->ajustarAlto($sheet, $row, $value, $this->ancho($sheet, 'B', 'B'));
            $row++;
        }
        $row++;

        $row = $this->addSection($sheet, $row, 'MENSAJES', $this->messageRows(), self::COLOR_INFO) + 1;

        $row = $this->addSection($sheet, $row, 'CITAS', $this->appointmentRows(true), self::COLOR_PRIMARY,
            'Citas con fecha dentro del período y qué respondieron los pacientes.') + 1;

        $row = $this->addSection($sheet, $row, 'CONVERSACIONES', $this->conversationRows(), self::COLOR_SUCCESS,
            'Conversaciones iniciadas en el período, según su estado actual.') + 1;

        $row = $this->addSection($sheet, $row, 'ENVÍOS MASIVOS', $this->templateRows(), self::COLOR_WARNING,
            'No incluye recordatorios de citas ni plantillas enviadas desde el chat.') + 1;

        $row = $this->addSection($sheet, $row, 'COSTO ESTIMADO DE WHATSAPP (META)', $this->costSummaryRows(), self::COLOR_DANGER) + 1;

        $row = $this->addSection($sheet, $row, 'EQUIPO', $this->userRows(), self::COLOR_PRIMARY_LIGHT,
            'Personas con acceso hoy; no depende del período.') + 1;

        // Nota al pie: los vacíos de datos conocidos que se cruzan con el período.
        $vacios = $this->vacios();
        if ($vacios) {
            $row = $this->subtitulo($sheet, $row, 'AVISOS SOBRE LOS DATOS', 'B');
            foreach ($vacios as $vacio) {
                $row = $this->nota($sheet, $row, $vacio['texto'], 'B', true);
            }
            $this->nota($sheet, $row, 'El detalle con fechas y temas afectados está en la hoja «Avisos».', 'B');
        }
    }

    private function createNoticesSheet(Spreadsheet $spreadsheet): void
    {
        $vacios = $this->vacios();
        if (! $vacios) {
            return;
        }

        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Avisos');
        $sheet->getTabColor()->setRGB(self::COLOR_WARNING);
        $sheet->getColumnDimension('A')->setWidth(70);
        $sheet->getColumnDimension('B')->setWidth(24);
        $sheet->getColumnDimension('C')->setWidth(24);
        $sheet->getColumnDimension('D')->setWidth(28);

        $row = $this->titulo($sheet, 'AVISOS SOBRE LOS DATOS', 'D', self::COLOR_WARNING);
        $row = $this->nota($sheet, $row, 'Huecos o retrasos conocidos que se cruzan con el período del informe. En esos días las cifras afectadas no reflejan la actividad real.', 'D');
        $row++;

        foreach (['Aviso', 'Desde', 'Hasta', 'Afecta a'] as $i => $header) {
            $sheet->setCellValue(chr(ord('A') + $i) . $row, $header);
        }
        $this->styleAdvisorHeader($sheet, $row, 'A', 'D');
        $row++;

        foreach ($vacios as $i => $vacio) {
            $this->styleDataRow($sheet, $row, $i % 2 === 0, 'A', 'D');
            $sheet->getStyle('D' . $row)->getFont()->setBold(false);
            $sheet->setCellValueExplicit('A' . $row, $vacio['texto'], DataType::TYPE_STRING);
            $sheet->setCellValueExplicit('B' . $row, $vacio['desde'], DataType::TYPE_STRING);
            $sheet->setCellValueExplicit('C' . $row, $vacio['hasta'], DataType::TYPE_STRING);
            $sheet->setCellValueExplicit('D' . $row, $vacio['temas'], DataType::TYPE_STRING);
            $sheet->getStyle('A' . $row . ':D' . $row)->getAlignment()->setWrapText(true);
            $this->ajustarAlto($sheet, $row, $vacio['texto'], $this->ancho($sheet, 'A', 'A'));
            $row++;
        }

        $this->horizontal($sheet);
    }

    private function createMessagesSheet(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Mensajes');
        $sheet->getColumnDimension('A')->setWidth(46);
        $sheet->getColumnDimension('B')->setWidth(22);

        $row = $this->titulo($sheet, 'ESTADÍSTICAS DE MENSAJES', 'B', self::COLOR_INFO);
        $row = $this->notasVacios($sheet, $row, ['messages', 'delivery'], 'B');
        if ($row > 3) {
            $row++;
        }

        $row = $this->encabezado($sheet, $row);
        $row = $this->filas($sheet, $row, $this->messageRows());

        $row++;
        $row = $this->subtitulo($sheet, $row, 'Estado de entrega de los mensajes enviados', 'B');

        $etiquetas = [
            'read' => 'Leídos',
            'delivered' => 'Entregados, sin leer',
            'sent' => 'Sin confirmar entrega',
            'pending' => 'En cola',
            'failed' => 'Con error',
        ];
        $estados = (array) ($this->d('messages.delivery_status') ?? []);
        $filas = [];
        foreach ($etiquetas as $estado => $etiqueta) {
            $filas[] = [$etiqueta, $this->entero($estados[$estado] ?? null)];
        }
        foreach (array_diff_key($estados, $etiquetas) as $estado => $cantidad) {
            $filas[] = [$this->capital((string) $estado), $this->entero($cantidad)];
        }
        $row = $this->filas($sheet, $row, $filas);

        $this->nota($sheet, $row + 1, '“Leídos” solo se sabe si el paciente tiene activada la confirmación de lectura en WhatsApp.', 'B');
    }

    private function createAppointmentsSheet(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Citas');
        $sheet->getColumnDimension('A')->setWidth(46);
        $sheet->getColumnDimension('B')->setWidth(18);
        $sheet->getColumnDimension('C')->setWidth(14);

        $row = $this->titulo($sheet, 'ESTADÍSTICAS DE CITAS', 'C', self::COLOR_PRIMARY);
        $row = $this->notasVacios($sheet, $row, ['appointments'], 'C');

        $start = $this->dateRange['start'] ?? null;
        $end = $this->dateRange['end'] ?? null;
        if ($start && $end) {
            $texto = 'Cuenta las citas con fecha del ' . $this->fechaLarga($start) . ' al ' . $this->fechaLarga($end);
            $texto .= ((int) ($this->d('appointments.future') ?? 0)) > 0 ? ', también las que aún no han llegado.' : '.';
            $row = $this->nota($sheet, $row, $texto, 'C');
        }
        if ($row > 3) {
            $row++;
        }

        $row = $this->encabezado($sheet, $row);
        $row = $this->filas($sheet, $row, $this->appointmentRows(false));

        // Respuesta de pacientes: solo citas con recordatorio enviado. Sus tres filas suman la base.
        $row++;
        $row = $this->subtitulo($sheet, $row, 'Respuesta de pacientes (citas con recordatorio enviado)', 'C');
        foreach (['Respuesta', 'Citas', '%'] as $i => $header) {
            $sheet->setCellValue(chr(ord('A') + $i) . $row, $header);
        }
        $this->styleAdvisorHeader($sheet, $row, 'A', 'C');
        $row++;

        $base = $this->d('appointments.with_reminder_base');
        $parte = function ($valor) use ($base) {
            return is_numeric($valor) && is_numeric($base) && (float) $base > 0
                ? $this->pct((float) $valor / (float) $base * 100)
                : $this->pct(null);
        };
        $respuestas = [
            ['Confirmadas por el paciente', $this->d('appointments.confirmed')],
            ['Canceladas por el paciente', $this->d('appointments.cancelled_by_patient')],
            ['Recordatorio enviado, sin respuesta', $this->d('appointments.awaiting_reply')],
        ];
        $filas = [];
        foreach ($respuestas as [$etiqueta, $valor]) {
            $filas[] = [$etiqueta, $this->entero($valor), $parte($valor)];
        }
        // No es «Recordatorios enviados» (reminder_sent): esta base deja fuera las citas con
        // recordatorio que después canceló el hospital o quedaron en otro estado. Con el rótulo
        // «Total con recordatorio enviado» la hoja daba dos cifras distintas para lo mismo.
        $filas[] = ['Total (base de los porcentajes)', $this->entero($base), $parte($base)];
        $row = $this->filas($sheet, $row, $filas, 'C');
        $sheet->getStyle('A' . ($row - 1) . ':C' . ($row - 1))->getFont()->setBold(true);
    }

    private function createConversationsSheet(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Conversaciones');
        $sheet->getColumnDimension('A')->setWidth(46);
        $sheet->getColumnDimension('B')->setWidth(22);

        $row = $this->titulo($sheet, 'ESTADÍSTICAS DE CONVERSACIONES', 'B', self::COLOR_SUCCESS);
        $row = $this->nota($sheet, $row, 'Conversaciones iniciadas en el período, según su estado actual.', 'B');
        $row = $this->notasVacios($sheet, $row, ['conversations'], 'B');
        $row++;

        $row = $this->encabezado($sheet, $row);
        $this->filas($sheet, $row, $this->conversationRows());
    }

    private function createTemplatesSheet(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Envíos masivos');
        $sheet->getColumnDimension('A')->setWidth(46);
        $sheet->getColumnDimension('B')->setWidth(22);

        $row = $this->titulo($sheet, 'ENVÍOS MASIVOS', 'B', self::COLOR_WARNING);
        $row = $this->nota($sheet, $row, 'Mensajes de envíos masivos en el período. No incluye recordatorios de citas ni plantillas enviadas desde el chat.', 'B');
        $row++;

        $row = $this->encabezado($sheet, $row);
        $this->filas($sheet, $row, $this->templateRows());
    }

    private function createCostsSheet(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Costos');
        $sheet->getColumnDimension('A')->setWidth(50);
        $sheet->getColumnDimension('B')->setWidth(16);
        $sheet->getColumnDimension('C')->setWidth(20);
        $sheet->getColumnDimension('D')->setWidth(18);

        $row = $this->titulo($sheet, 'COSTO ESTIMADO DE WHATSAPP (META)', 'D', self::COLOR_DANGER);

        $mesTarifas = $this->mesLargo((string) ($this->d('costs.rates_as_of') ?? ''));
        $row = $this->nota($sheet, $row, 'Según el tipo de mensaje que cobra Meta, con tarifas de Colombia'
            . ($mesTarifas ? ' de ' . $mesTarifas : '') . '.', 'D');
        $row = $this->notasVacios($sheet, $row, ['costs'], 'D');
        $row++;

        // Tabla por categoría
        foreach (['Categoría', 'Con cobro', 'Tarifa por mensaje', 'Costo estimado'] as $i => $header) {
            $sheet->setCellValue(chr(ord('A') + $i) . $row, $header);
        }
        $this->styleAdvisorHeader($sheet, $row, 'A', 'D');
        $row++;

        $labels = [
            'marketing' => 'Marketing',
            'utility' => 'Utilidad (recordatorios y avisos de citas)',
            'authentication' => 'Autenticación (códigos de verificación)',
            'service' => 'Servicio (respuestas a quien escribió en las últimas 24 h)',
        ];

        $filas = [];
        foreach ((array) ($this->d('costs.by_category') ?? []) as $cat => $data) {
            $rate = (float) ($data['rate'] ?? 0);
            $billable = (int) ($data['billable'] ?? 0);
            // Tarifa 0 con mensajes cobrados = categoría sin tarifa configurada, no «Gratis».
            $tarifa = $rate > 0 ? $this->dinero($rate, 4) : ($billable > 0 ? 'Sin tarifa' : 'Gratis');
            $filas[] = [$labels[$cat] ?? $this->capital((string) $cat), $this->entero($data['billable'] ?? null), $tarifa, $this->dinero($data['cost'] ?? null)];
        }
        $row = $this->filas($sheet, $row, $filas, 'D');

        // Fila de total
        $sheet->setCellValue('A' . $row, 'TOTAL ESTIMADO');
        $sheet->mergeCells('A' . $row . ':C' . $row);
        $this->styleAdvisorHeader($sheet, $row, 'A', 'D');
        $this->poner($sheet, 'D' . $row, $this->dinero($this->d('costs.total_cost')));
        $sheet->getStyle('D' . $row)->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
        $row++;

        $sinTarifa = (int) ($this->d('costs.billable_without_rate') ?? 0);
        if ($sinTarifa > 0) {
            $row = $this->nota($sheet, $row, $this->miles($sinTarifa) . ' mensajes con cobro son de un tipo sin tarifa configurada y no suman al total.', 'D', true);
        }
        $row++;

        // Cobertura de la medición
        $row = $this->subtitulo($sheet, $row, 'Mensajes con dato de cobro', 'D');
        $filas = [
            ['Mensajes enviados en el período', $this->n('costs.outbound_total')],
            ['Con dato de cobro de Meta', $this->n('costs.with_pricing')],
            ['Sin dato de cobro de Meta', $this->n('costs.without_pricing')],
        ];
        if ((int) ($this->d('costs.unconfirmed') ?? 0) > 0) {
            $filas[] = [$this->sub('de ellos, con tipo de mensaje pero sin confirmar si se cobra'), $this->n('costs.unconfirmed')];
        }
        $filas[] = ['Cobertura (mensajes con dato de cobro)', $this->cobertura()];
        $filas[] = ['Con cobro', $this->n('costs.billable_total')];
        $filas[] = ['Gratis (respuestas dentro de las 24 h)', $this->n('costs.free_total')];
        if ($sinTarifa > 0) {
            $filas[] = ['Con cobro, de un tipo sin tarifa (no suman al costo)', $this->entero($sinTarifa)];
        }
        $row = $this->filas($sheet, $row, $filas);
        $row++;

        $row = $this->nota($sheet, $row, 'Sin dato de cobro: mensajes de antes de julio de 2026 (inicio de la medición) o sin aviso de Meta; el costo real puede ser mayor.', 'D');
        $row = $this->nota($sheet, $row, 'Estimación con tarifas de Colombia (Meta, modelo por mensaje). Cifra de referencia: el cobro real y las facturas están en Meta Business Manager › Facturación y pagos.', 'D');

        // Evolución diaria del costo (días sin cobro en 0, para que un hueco se vea como hueco)
        $serie = $this->serieDiaria();
        if ($serie) {
            $row++;
            $row = $this->subtitulo($sheet, $row, 'Evolución diaria del costo (hora de Colombia)', 'D');
            foreach (['Día', 'Con cobro', 'Costo estimado'] as $i => $header) {
                $sheet->setCellValue(chr(ord('A') + $i) . $row, $header);
            }
            $this->styleAdvisorHeader($sheet, $row, 'A', 'C');
            $row++;

            $filas = [];
            foreach ($serie as $dia) {
                $filas[] = [$this->fecha($dia['day']), $this->entero($dia['billable']), $this->dinero($dia['cost'])];
            }
            $primera = $row;
            $row = $this->filas($sheet, $row, $filas, 'C');
            $sheet->getStyle('A' . $primera . ':A' . ($row - 1))->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
        }

        $this->horizontal($sheet);
    }

    private function createUsersSheet(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Usuarios');
        $sheet->getColumnDimension('A')->setWidth(40);
        $sheet->getColumnDimension('B')->setWidth(22);

        $row = $this->titulo($sheet, 'EQUIPO', 'B', self::COLOR_PRIMARY_LIGHT);
        $row = $this->nota($sheet, $row, 'Personas con acceso hoy; no depende del período. No incluye el usuario de inteligencia artificial.', 'B');
        $row++;

        $row = $this->encabezado($sheet, $row);
        $this->filas($sheet, $row, $this->userRows());
    }

    private function createAdvisorsSheet(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Asesores');
        $anchos = ['A' => 36, 'B' => 16, 'C' => 14, 'D' => 12, 'E' => 12, 'F' => 14, 'G' => 16, 'H' => 13, 'I' => 18];
        foreach ($anchos as $col => $ancho) {
            $sheet->getColumnDimension($col)->setWidth($ancho);
        }

        $row = $this->titulo($sheet, 'RENDIMIENTO DE ASESORES', 'I', self::COLOR_PRIMARY);
        $row = $this->nota($sheet, $row, 'Atendidas: conversaciones que el asesor tomó, que le asignaron, en las que escribió o que resolvió en el período. Resueltas y agendadas: las que él mismo resolvió o agendó en el período. Activas y sin leer: lo que tiene ahora. Mensajes: solo los escritos por la persona (sin envíos masivos, ocultos ni fallidos). Resolución: resueltas ÷ atendidas.', 'I');
        $row = $this->notasVacios($sheet, $row, ['advisors'], 'I');
        $row++;

        // C20: con la liberación automática apagada y nada liberado, un 0 diría «nadie dejó
        // chats sin atender» cuando en realidad no se mide.
        $autoRelease = $this->d('advisors.auto_release_enabled');
        $releasedTotal = (int) ($this->d('advisors.total_released_inactive') ?? 0);
        $funcionApagada = $autoRelease === false && $releasedTotal === 0;
        $etiquetaLiberadas = 'Liberadas por no responder a tiempo';
        if ($autoRelease === false && $releasedTotal > 0) {
            $etiquetaLiberadas .= ' (hoy la función está apagada)';
        }

        // Resumen general
        $row = $this->subtitulo($sheet, $row, 'RESUMEN GENERAL', 'I');
        $resumen = [
            ['Asesores en el equipo', $this->n('advisors.total_advisors')],
            ['Conversaciones atendidas en el período', $this->n('advisors.total_conversations')],
            ['Resueltas o cerradas', $this->n('advisors.total_resolved')],
            ['Agendadas en el período', $this->n('advisors.total_scheduled')],
            ['Activas (ahora)', $this->n('advisors.total_active')],
            ['Con mensajes sin leer (ahora)', $this->n('advisors.total_with_unread')],
            ['Mensajes escritos (sin masivos)', $this->n('advisors.total_messages_sent')],
            ['Resolución del equipo (resueltas ÷ atendidas)', $this->p('advisors.avg_resolution_rate')],
            [$etiquetaLiberadas, $funcionApagada ? 'Función apagada' : $this->entero($releasedTotal)],
        ];
        $row = $this->filasInfo($sheet, $row, $resumen, 'D');

        // Más conversaciones resueltas: solo si alguien resolvió algo y no hay empate (el
        // servidor manda null). Mide volumen, no calidad, y el rótulo lo dice.
        $top = $this->d('advisors.top_performer');
        if (is_array($top) && (int) ($top['resolved_conversations'] ?? 0) > 0) {
            $row++;
            $row = $this->subtitulo($sheet, $row, 'MÁS CONVERSACIONES RESUELTAS', 'I');
            $row = $this->filasInfo($sheet, $row, [
                ['Asesor', $this->nombrePropio($top['name'] ?? '')],
                ['Conversaciones resueltas', $this->entero($top['resolved_conversations'] ?? null)],
                ['Resolución (de las que atendió)', $this->pct($top['resolution_rate'] ?? null)],
            ], 'D');
        }

        // Detalle por asesor
        $row++;
        $row = $this->subtitulo($sheet, $row, 'DETALLE POR ASESOR', 'I');
        $row++;

        $headers = ['Asesor', 'Atendidas en el período', 'Resueltas en el período', 'Agendadas en el período', 'Activas (ahora)', 'Con mensajes sin leer (ahora)', 'Mensajes escritos (sin masivos)', 'Resolución (resueltas ÷ atendidas)', 'Liberadas por no responder a tiempo'];
        $col = 'A';
        foreach ($headers as $header) {
            $sheet->setCellValue($col . $row, $header);
            $col++;
        }
        $this->styleAdvisorHeader($sheet, $row, 'A', 'I');
        $sheet->getStyle('A' . $row . ':I' . $row)->getAlignment()->setWrapText(true);
        $sheet->getRowDimension($row)->setRowHeight(45);
        $row++;

        $asesores = (array) ($this->d('advisors.advisors') ?? []);
        if (! $asesores) {
            $this->styleDataRow($sheet, $row, true, 'A', 'I');
            $sheet->setCellValue('A' . $row, 'No hay asesores en el equipo.');
            $sheet->mergeCells('A' . $row . ':I' . $row);
        }

        foreach ($asesores as $i => $advisor) {
            $this->styleDataRow($sheet, $row, $i % 2 === 0, 'A', 'I');
            $sheet->setCellValueExplicit('A' . $row, $this->nombrePropio($advisor['name'] ?? ''), DataType::TYPE_STRING);
            $this->poner($sheet, 'B' . $row, $this->entero($advisor['total_conversations'] ?? null));
            $this->poner($sheet, 'C' . $row, $this->entero($advisor['resolved_conversations'] ?? null));
            $this->poner($sheet, 'D' . $row, $this->entero($advisor['scheduled_conversations'] ?? null));
            $this->poner($sheet, 'E' . $row, $this->entero($advisor['active_conversations'] ?? null));
            $this->poner($sheet, 'F' . $row, $this->entero($advisor['conversations_with_unread'] ?? null));
            $this->poner($sheet, 'G' . $row, $this->entero($advisor['messages_sent'] ?? null));
            // resolution_rate es null si el asesor no tiene conversaciones: «Sin datos».
            $this->poner($sheet, 'H' . $row, $this->pct($advisor['resolution_rate'] ?? null));
            $this->poner($sheet, 'I' . $row, $funcionApagada ? 'Función apagada' : $this->entero($advisor['released_inactive'] ?? 0));
            // styleDataRow pone en negrita la última columna: la cifra principal es la resolución.
            if (is_numeric($advisor['resolution_rate'] ?? null)) {
                $sheet->getStyle('H' . $row)->getFont()->setBold(true);
            }
            $sheet->getStyle('I' . $row)->getFont()->setBold(false);
            $row++;
        }

        $this->horizontal($sheet);
    }

    private function createWelcomeMenuSheet(Spreadsheet $spreadsheet): void
    {
        $fd = (array) ($this->d('flowDemand') ?? []);
        $total = (int) ($fd['total'] ?? 0);
        if ($total <= 0) {
            return;
        }

        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Menú de bienvenida');
        $sheet->getColumnDimension('A')->setWidth(52);
        $sheet->getColumnDimension('B')->setWidth(16);
        $sheet->getColumnDimension('C')->setWidth(14);

        $row = $this->titulo($sheet, 'MENÚ DE BIENVENIDA', 'C', self::COLOR_PRIMARY_LIGHT);
        $row = $this->nota($sheet, $row, 'Clasificación automática de lo que pide cada paciente en el menú de bienvenida.', 'C');
        $row++;

        $porSalida = (array) ($fd['by_outcome'] ?? []);
        $terminaron = (int) ($porSalida['self_service'] ?? 0) + (int) ($porSalida['advisor'] ?? 0);

        $row = $this->encabezado($sheet, $row);
        $row = $this->filas($sheet, $row, [
            ['Recorridos iniciados', $this->entero($total)],
            ['Aceptaron el aviso de privacidad', $this->entero($fd['accepted_privacy'] ?? null)],
            ['Eligieron un servicio', $this->entero($fd['reached_menu'] ?? null)],
            ['Pasaron a un asesor', $this->entero($porSalida['advisor'] ?? 0)],
            [
                'Resueltos por el menú, sin asesor (de los ' . $this->miles($terminaron) . ' que terminaron por el menú o con un asesor)',
                $this->pct($terminaron > 0 ? ($fd['automation_rate'] ?? null) : null),
            ],
        ]);

        // Cómo terminó: % sobre el total de recorridos, como en la pantalla.
        $row++;
        $row = $this->subtitulo($sheet, $row, 'Cómo terminó', 'C');
        foreach (['Resultado', 'Recorridos', '% del total'] as $i => $header) {
            $sheet->setCellValue(chr(ord('A') + $i) . $row, $header);
        }
        $this->styleAdvisorHeader($sheet, $row, 'A', 'C');
        $row++;

        $salidas = [
            'self_service' => 'Resuelto por el menú',
            'advisor' => 'Pasó a un asesor',
            'rejected' => 'No aceptó el aviso de privacidad',
            'in_progress' => 'Sin terminar',
        ];
        $filas = [];
        foreach ($salidas + array_fill_keys(array_keys(array_diff_key($porSalida, $salidas)), null) as $clave => $etiqueta) {
            if (! array_key_exists($clave, $porSalida)) {
                continue;
            }
            $valor = (int) $porSalida[$clave];
            $filas[] = [$etiqueta ?? $this->capital((string) $clave), $this->entero($valor), $this->pct($valor / $total * 100)];
        }
        if (! $filas) {
            $filas[] = [self::SIN_DATOS, '', ''];
        }
        $row = $this->filas($sheet, $row, $filas, 'C');

        // Listas
        $servicios = ['agendamiento' => 'Agendamiento', 'cancelacion' => 'Cancelación', 'informacion' => 'Información', 'asesor' => 'Hablar con un asesor'];
        $regimenes = ['subsidiado' => 'Subsidiado', 'contributivo' => 'Contributivo'];

        $lista = function (array $pares, array $etiquetas = []): array {
            $filas = [];
            foreach ($pares as $nombre => $valor) {
                $filas[] = [$etiquetas[$nombre] ?? $this->capital((string) $nombre), $this->entero($valor)];
            }
            return $filas;
        };
        $top = function ($filasTop): array {
            $filas = [];
            foreach ((array) $filasTop as $f) {
                $filas[] = [trim((string) ($f['name'] ?? '')), $this->entero($f['value'] ?? null)];
            }
            return $filas;
        };

        $bloques = [
            ['Por servicio solicitado', 'Servicio', $lista((array) ($fd['by_service'] ?? []), $servicios)],
            ['Régimen', 'Régimen', $lista((array) ($fd['by_regimen'] ?? []), $regimenes)],
            ['EPS más frecuentes', 'EPS', $top($fd['top_eps'] ?? [])],
            ['Trámites más pedidos', 'Trámite', $top($fd['top_sub_service'] ?? [])],
        ];
        foreach ($bloques as [$titulo, $columna, $filas]) {
            $row++;
            $row = $this->subtitulo($sheet, $row, $titulo, 'C');
            $sheet->setCellValue('A' . $row, $columna);
            $sheet->setCellValue('B' . $row, 'Recorridos');
            $this->styleAdvisorHeader($sheet, $row, 'A', 'B');
            $row++;
            $row = $this->filas($sheet, $row, $filas ?: [[self::SIN_DATOS, '']]);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Filas compartidas entre «Resumen» y las hojas de detalle (mismos rótulos)
    // ─────────────────────────────────────────────────────────────────────────────

    private function messageRows(): array
    {
        return [
            ['Total de mensajes', $this->n('messages.total')],
            ['Enviados por el sistema y asesores', $this->n('messages.sent_by_system')],
            ['Recibidos de pacientes', $this->n('messages.received_from_users')],
            [$this->sub('Escritos por pacientes'), $this->n('messages.received_written')],
            [$this->sub('Toques de los botones Confirmar/Cancelar'), $this->n('messages.button_taps')],
        ];
    }

    /** @param bool $conRespuestas En «Resumen» van también las respuestas; la hoja Citas las pone en su tabla. */
    private function appointmentRows(bool $conRespuestas): array
    {
        $filas = [['Citas con fecha en el período', $this->n('appointments.total')]];
        if ((int) ($this->d('appointments.future') ?? 0) > 0) {
            $filas[] = [$this->sub('de ellas, en días que aún no llegan'), $this->n('appointments.future')];
        }
        $filas[] = ['Recordatorios enviados', $this->n('appointments.reminder_sent')];
        if ($conRespuestas) {
            $filas[] = ['Confirmadas por el paciente', $this->n('appointments.confirmed')];
            $filas[] = ['Canceladas por el paciente', $this->n('appointments.cancelled_by_patient')];
            $filas[] = ['Recordatorio enviado, sin respuesta', $this->n('appointments.awaiting_reply')];
        }
        $filas[] = ['Canceladas por el hospital (plantilla)', $this->n('appointments.cancelled_by_hospital')];
        $filas[] = ['Recordatorio sin enviar', $this->n('appointments.pending')];
        $filas[] = ['Recordatorio con error', $this->n('appointments.failed')];

        return $filas;
    }

    private function conversationRows(): array
    {
        $filas = [
            ['Iniciadas en el período', $this->n('conversations.total')],
            ['Activas', $this->n('conversations.active')],
            ['Pendientes', $this->n('conversations.pending')],
            ['Resueltas', $this->n('conversations.resolved')],
            ['Agendadas (incluye abiertas por recordatorio)', $this->n('conversations.scheduled')],
        ];
        // «En progreso» y «Cerradas» ya no se pueden asignar: solo salen si tienen algo.
        if ((int) ($this->d('conversations.in_progress') ?? 0) > 0) {
            $filas[] = ['En progreso', $this->n('conversations.in_progress')];
        }
        if ((int) ($this->d('conversations.closed') ?? 0) > 0) {
            $filas[] = ['Cerradas', $this->n('conversations.closed')];
        }
        $filas[] = ['Con mensajes sin leer (ahora mismo)', $this->n('conversations.unread')];

        return $filas;
    }

    private function templateRows(): array
    {
        return [
            ['Mensajes de envíos masivos', $this->n('templates.total_sends')],
            [$this->sub('Aceptados por WhatsApp'), $this->n('templates.successful_sends')],
            [$this->sub('No se pudieron enviar'), $this->n('templates.failed_sends')],
            ['Respuestas rápidas guardadas (hoy, no depende del período)', $this->n('templates.total')],
        ];
    }

    private function costSummaryRows(): array
    {
        $filas = [
            ['Costo total estimado', $this->dinero($this->d('costs.total_cost'))],
            ['Mensajes con cobro', $this->n('costs.billable_total')],
            ['Gratis (respuestas dentro de las 24 h)', $this->n('costs.free_total')],
            ['Sin dato de cobro de Meta', $this->n('costs.without_pricing')],
            ['Cobertura (mensajes con dato de cobro)', $this->cobertura()],
        ];
        if ((int) ($this->d('costs.billable_without_rate') ?? 0) > 0) {
            $filas[] = ['Con cobro, de un tipo sin tarifa (no suman al costo)', $this->n('costs.billable_without_rate')];
        }

        return $filas;
    }

    private function userRows(): array
    {
        $admins = $this->d('users.admins');
        $advisors = $this->d('users.advisors');
        $equipo = $this->d('users.team_total');
        if ($equipo === null && is_numeric($admins) && is_numeric($advisors)) {
            $equipo = (int) $admins + (int) $advisors;
        }

        return [
            ['Personas en el equipo (hoy)', $this->entero($equipo)],
            [$this->sub('Administradores'), $this->entero($admins)],
            [$this->sub('Asesores'), $this->entero($advisors)],
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Datos y textos
    // ─────────────────────────────────────────────────────────────────────────────

    private function d(string $ruta): mixed
    {
        return Arr::get($this->statistics, $ruta);
    }

    private function n(string $ruta): array
    {
        return $this->entero($this->d($ruta));
    }

    private function p(string $ruta): array
    {
        return $this->pct($this->d($ruta));
    }

    /** Sin mensajes enviados no hay cobertura que medir: «Sin datos», no un 0,0 % inventado (el servidor manda 0). */
    private function cobertura(): array
    {
        $enviados = $this->d('costs.outbound_total');

        return $this->pct(is_numeric($enviados) && (int) $enviados === 0 ? null : $this->d('costs.coverage_percent'));
    }

    private function entero(mixed $valor): array
    {
        return ['_tipo' => 'entero', 'v' => $valor];
    }

    /** Porcentaje que llega de 0 a 100 (como en la pantalla); se guarda como fracción. */
    private function pct(mixed $valor): array
    {
        return ['_tipo' => 'pct', 'v' => $valor];
    }

    private function dinero(mixed $valor, int $decimales = 2): array
    {
        return ['_tipo' => 'dinero', 'v' => $valor, 'd' => $decimales];
    }

    private function fecha(?string $ymd): array
    {
        return ['_tipo' => 'fecha', 'v' => $ymd];
    }

    /** Rótulo con sangría: es un desglose de la fila de arriba. */
    private function sub(string $texto): array
    {
        return ['texto' => $texto, 'sangria' => 2];
    }

    private function periodLabel(): string
    {
        if (! empty($this->dateRange['custom'])) {
            return 'Rango personalizado';
        }

        return match ($this->dateRange['period'] ?? 'all') {
            'today' => 'Hoy',
            'week' => 'Esta semana',
            'month' => 'Este mes',
            'year' => 'Este año',
            'custom' => 'Rango personalizado',
            default => 'Todo el tiempo',
        };
    }

    /** Hora de corte de las cifras (hora de Colombia). */
    private function generado(): Carbon
    {
        $valor = $this->statistics['generated_at'] ?? null;
        if ($valor) {
            try {
                return Carbon::parse($valor)->setTimezone(self::ZONA);
            } catch (\Throwable) {
                // Si llega algo raro, se usa la hora actual: el Excel se está generando ahora.
            }
        }

        return Carbon::now(self::ZONA);
    }

    /** «15 de octubre de 2026, 3:20 p. m. (hora de Colombia)» */
    private function generadoTexto(): string
    {
        $g = $this->generado();

        return $g->day . ' de ' . self::MESES[$g->month] . ' de ' . $g->year . ', '
            . $g->format('g:i') . ($g->hour < 12 ? ' a. m.' : ' p. m.') . ' (hora de Colombia)';
    }

    /** 'Y-m-d' → «1 de octubre de 2026». */
    private function fechaLarga(?string $ymd): string
    {
        $ymd = substr((string) $ymd, 0, 10);
        if (! preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $ymd, $m) || ! checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
            return $ymd !== '' ? $ymd : self::SIN_DATOS;
        }

        return ((int) $m[3]) . ' de ' . self::MESES[(int) $m[2]] . ' de ' . $m[1];
    }

    /** '2025-11' → «noviembre de 2025» (vacío si no se reconoce). */
    private function mesLargo(string $ym): string
    {
        if (! preg_match('/^(\d{4})-(\d{1,2})/', $ym, $m) || (int) $m[2] < 1 || (int) $m[2] > 12) {
            return '';
        }

        return self::MESES[(int) $m[2]] . ' de ' . $m[1];
    }

    private function miles(int|float $n): string
    {
        return number_format((float) $n, 0, ',', '.');
    }

    private function capital(string $texto): string
    {
        $texto = str_replace('_', ' ', trim($texto));

        return mb_strtoupper(mb_substr($texto, 0, 1, 'UTF-8'), 'UTF-8') . mb_substr($texto, 1, null, 'UTF-8');
    }

    /**
     * Equivalente PHP de nombrePropio() de resources/js/lib/nombres.ts:
     * «ANDREA CAROLINA MUÑOZ PAZ» → «Andrea Carolina Muñoz Paz», «MARIA DEL PILAR» → «Maria del Pilar»;
     * los compuestos con guion se respetan.
     */
    public static function nombrePropio(?string $nombre): string
    {
        $palabras = preg_split('/\s+/u', mb_strtolower(trim((string) $nombre), 'UTF-8'), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $mayuscula = fn (string $parte) => mb_strtoupper(mb_substr($parte, 0, 1, 'UTF-8'), 'UTF-8') . mb_substr($parte, 1, null, 'UTF-8');

        foreach ($palabras as $i => $palabra) {
            if ($i > 0 && in_array($palabra, self::PARTICULAS, true)) {
                continue;
            }
            $palabras[$i] = implode('-', array_map($mayuscula, explode('-', $palabra)));
        }

        return implode(' ', $palabras);
    }

    /**
     * Vacíos de datos que mandó el servidor (ya filtrados por el rango), con su texto.
     *
     * @return array<int, array{texto: string, desde: string, hasta: string, temas: string, topics: array}>
     */
    private function vacios(): array
    {
        $vacios = [];
        foreach ((array) ($this->statistics['data_gaps'] ?? []) as $gap) {
            if (! is_array($gap)) {
                continue;
            }
            $topics = array_values(array_filter((array) ($gap['topics'] ?? []), 'is_string'));
            $desde = $this->fechaLarga($gap['from'] ?? null);
            $hasta = ! empty($gap['to']) ? $this->fechaLarga($gap['to']) : 'Sigue ocurriendo';
            $texto = self::TEXTOS_VACIOS[$gap['key'] ?? ''] ?? (
                empty($gap['to'])
                    ? 'Datos incompletos desde el ' . $desde . '.'
                    : 'Datos incompletos del ' . $desde . ' al ' . $hasta . '.'
            );
            $vacios[] = [
                'texto' => $texto,
                'desde' => $desde,
                'hasta' => $hasta,
                'temas' => implode(', ', array_map(fn ($t) => self::TEMAS[$t] ?? $this->capital($t), $topics)) ?: '—',
                'topics' => $topics,
            ];
        }

        return $vacios;
    }

    /**
     * Serie diaria del costo con los días sin cobro en 0 (dentro del rango y hasta la hora de
     * corte), para que un apagón se vea como hueco en vez de desaparecer.
     */
    private function serieDiaria(): array
    {
        $porDia = [];
        foreach ((array) ($this->d('costs.series') ?? []) as $p) {
            $dia = substr((string) ($p['day'] ?? ''), 0, 10);
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $dia)) {
                $porDia[$dia] = ['day' => $dia, 'billable' => (int) ($p['billable'] ?? 0), 'cost' => (float) ($p['cost'] ?? 0)];
            }
        }
        if (! $porDia) {
            return [];
        }
        ksort($porDia);

        $dias = array_keys($porDia);
        $hoy = $this->generado()->toDateString();
        $inicio = ($this->dateRange['start'] ?? null) ?: $dias[0];
        // Antes de la medición no hay dato de cobro: rellenar esos días con 0 («Este año» daba
        // enero–junio en US$ 0,00) diría «no costó nada» cuando no se sabe.
        $inicio = max($inicio, min($dias[0], self::INICIO_MEDICION_COSTO));
        $fin = min(($this->dateRange['end'] ?? null) ?: $hoy, $hoy);
        $inicio = min($inicio, $dias[0]);
        $fin = max($fin, end($dias));

        try {
            $cursor = Carbon::createFromFormat('!Y-m-d', $inicio, self::ZONA);
            $ultimo = Carbon::createFromFormat('!Y-m-d', $fin, self::ZONA);
        } catch (\Throwable) {
            return array_values($porDia);
        }
        // Con «Todo el tiempo» y años de datos no se rellena: la lista quedaría enorme.
        if ($cursor->diffInDays($ultimo) > 800) {
            return array_values($porDia);
        }

        $serie = [];
        while ($cursor->lte($ultimo)) {
            $dia = $cursor->toDateString();
            $serie[] = $porDia[$dia] ?? ['day' => $dia, 'billable' => 0, 'cost' => 0.0];
            $cursor->addDay();
        }

        return $serie;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Escritura de celdas
    // ─────────────────────────────────────────────────────────────────────────────

    /** Escribe un valor tipado (entero, pct, dinero, fecha), texto o null («Sin datos»). */
    private function poner(Worksheet $sheet, string $celda, mixed $valor): void
    {
        if (is_array($valor) && isset($valor['_tipo'])) {
            $v = $valor['v'];

            if ($valor['_tipo'] === 'fecha') {
                $ymd = substr((string) $v, 0, 10);
                if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $ymd, $m)) {
                    $sheet->setCellValueExplicit($celda, FechaExcel::formattedPHPToExcel((int) $m[1], (int) $m[2], (int) $m[3]), DataType::TYPE_NUMERIC);
                    $sheet->getStyle($celda)->getNumberFormat()->setFormatCode(self::FMT_FECHA);
                } else {
                    $this->ponerSinDatos($sheet, $celda);
                }

                return;
            }

            if (! is_numeric($v)) {
                $this->ponerSinDatos($sheet, $celda);

                return;
            }

            [$numero, $formato] = match ($valor['_tipo']) {
                'pct' => [(float) $v / 100, self::FMT_PCT],
                'dinero' => [round((float) $v, $valor['d']), $this->formatoDinero($valor['d'])],
                default => [(int) round((float) $v), self::FMT_ENTERO],
            };
            $sheet->setCellValueExplicit($celda, $numero, DataType::TYPE_NUMERIC);
            $sheet->getStyle($celda)->getNumberFormat()->setFormatCode($formato);

            return;
        }

        if ($valor === null) {
            $this->ponerSinDatos($sheet, $celda);

            return;
        }

        if (is_int($valor) || is_float($valor)) {
            $sheet->setCellValueExplicit($celda, $valor, DataType::TYPE_NUMERIC);
            $sheet->getStyle($celda)->getNumberFormat()->setFormatCode(self::FMT_ENTERO);

            return;
        }

        $sheet->setCellValueExplicit($celda, (string) $valor, DataType::TYPE_STRING);
    }

    private function ponerSinDatos(Worksheet $sheet, string $celda): void
    {
        $sheet->setCellValueExplicit($celda, self::SIN_DATOS, DataType::TYPE_STRING);
        $sheet->getStyle($celda)->getFont()->setBold(false)->getColor()->setRGB(self::COLOR_SUAVE);
    }

    /** «US$ 1.234,50» en un Excel en español; el número sigue siendo número. */
    private function formatoDinero(int $decimales): string
    {
        $moneda = (string) ($this->d('costs.currency') ?: 'USD');
        $simbolo = $moneda === 'USD' ? 'US$' : str_replace('"', '', $moneda);

        return '"' . $simbolo . '" #,##0' . ($decimales > 0 ? '.' . str_repeat('0', $decimales) : '');
    }

    private function etiqueta(Worksheet $sheet, int $row, mixed $etiqueta): void
    {
        $sangria = 0;
        if (is_array($etiqueta) && ! isset($etiqueta['_tipo'])) {
            $sangria = (int) ($etiqueta['sangria'] ?? 1);
            $etiqueta = (string) ($etiqueta['texto'] ?? '');
        }

        if (is_array($etiqueta)) {
            // Una fecha u otro valor tipado en la primera columna (serie diaria del costo).
            $this->poner($sheet, 'A' . $row, $etiqueta);

            return;
        }

        $etiqueta = (string) $etiqueta;
        $sheet->setCellValueExplicit('A' . $row, $etiqueta, DataType::TYPE_STRING);
        if ($sangria > 0) {
            $sheet->getStyle('A' . $row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT)->setIndent($sangria);
            $sheet->getStyle('A' . $row)->getFont()->getColor()->setRGB('374151');
        }

        // Letra de 10 puntos: caben ~1,2 caracteres por unidad de ancho de columna.
        $ancho = $this->ancho($sheet, 'A', 'A') - $sangria * 2;
        if (mb_strlen($etiqueta) > $ancho * 1.2) {
            $sheet->getStyle('A' . $row)->getAlignment()->setWrapText(true);
            $this->ajustarAlto($sheet, $row, $etiqueta, $ancho, 1.15);
        }
    }

    /** Filas [etiqueta, valor, (valor…)] con el estilo alterno; devuelve la fila siguiente. */
    private function filas(Worksheet $sheet, int $row, array $filas, string $endCol = 'B'): int
    {
        foreach ($filas as $i => $fila) {
            $this->styleDataRow($sheet, $row, $i % 2 === 0, 'A', $endCol);
            $this->etiqueta($sheet, $row, $fila[0]);
            $col = 'B';
            foreach (array_slice($fila, 1) as $valor) {
                $this->poner($sheet, $col . $row, $valor);
                $col++;
            }
            $row++;
        }

        return $row;
    }

    /**
     * Filas de resumen (etiqueta en negrita sobre gris, valor en B). El valor se combina hasta
     * $endCol para que quepa un nombre completo en hojas de columnas estrechas.
     */
    private function filasInfo(Worksheet $sheet, int $row, array $filas, string $endCol = 'B'): int
    {
        foreach ($filas as [$etiqueta, $valor]) {
            $this->styleInfoRow($sheet, $row, $endCol);
            $this->etiqueta($sheet, $row, $etiqueta);
            $this->poner($sheet, 'B' . $row, $valor);
            if ($endCol !== 'B') {
                $sheet->mergeCells('B' . $row . ':' . $endCol . $row);
            }
            $sheet->getStyle('A' . $row . ':' . $endCol . $row)->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);
            $sheet->getStyle('B' . $row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $row++;
        }

        return $row;
    }

    /** Título de la hoja; devuelve la fila donde sigue el contenido. */
    private function titulo(Worksheet $sheet, string $texto, string $endCol, string $color): int
    {
        $sheet->setCellValue('A1', $texto);
        $sheet->mergeCells('A1:' . $endCol . '1');
        $this->styleSheetTitle($sheet, 1, $color);

        return 3;
    }

    private function subtitulo(Worksheet $sheet, int $row, string $texto, string $endCol): int
    {
        $sheet->setCellValue('A' . $row, $texto);
        $sheet->mergeCells('A' . $row . ':' . $endCol . $row);
        $this->styleSubtitle($sheet, $row);

        return $row + 1;
    }

    private function encabezado(Worksheet $sheet, int $row): int
    {
        $sheet->setCellValue('A' . $row, 'Métrica');
        $sheet->setCellValue('B' . $row, 'Valor');
        $this->styleHeader($sheet, $row);

        return $row + 1;
    }

    /** Nota de una línea o varias (gris, o ámbar si es un aviso); devuelve la fila siguiente. */
    private function nota(Worksheet $sheet, int $row, string $texto, string $endCol, bool $aviso = false): int
    {
        $sheet->setCellValueExplicit('A' . $row, $texto, DataType::TYPE_STRING);
        if ($endCol !== 'A') {
            $sheet->mergeCells('A' . $row . ':' . $endCol . $row);
        }

        $estilo = [
            'font' => $aviso
                ? ['size' => 10, 'color' => ['rgb' => self::COLOR_AVISO_TEXTO]]
                : ['size' => 9, 'italic' => true, 'color' => ['rgb' => self::COLOR_SUAVE]],
            'alignment' => ['wrapText' => true, 'vertical' => Alignment::VERTICAL_CENTER, 'horizontal' => Alignment::HORIZONTAL_LEFT],
        ];
        if ($aviso) {
            $estilo['fill'] = ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => self::COLOR_AVISO_FONDO]];
        }
        $sheet->getStyle('A' . $row . ':' . $endCol . $row)->applyFromArray($estilo);
        $this->ajustarAlto($sheet, $row, $texto, $this->ancho($sheet, 'A', $endCol), $aviso ? 1.25 : 1.4, $aviso ? 14.0 : 13.0);

        return $row + 1;
    }

    /** Avisos de vacíos de datos que tocan alguno de estos temas. */
    private function notasVacios(Worksheet $sheet, int $row, array $temas, string $endCol): int
    {
        foreach ($this->vacios() as $vacio) {
            if (array_intersect($temas, $vacio['topics'])) {
                $row = $this->nota($sheet, $row, 'Aviso: ' . $vacio['texto'], $endCol, true);
            }
        }

        return $row;
    }

    /** Ancho total (en caracteres) de las columnas de $desde a $hasta. */
    private function ancho(Worksheet $sheet, string $desde, string $hasta): float
    {
        $total = 0.0;
        $col = $desde;
        while (true) {
            $w = $sheet->getColumnDimension($col)->getWidth();
            $total += $w > 0 ? $w : 9.14;
            if ($col === $hasta) {
                break;
            }
            $col++;
        }

        return $total;
    }

    /**
     * Excel no ajusta el alto de celdas combinadas con texto largo: se calcula a mano.
     * $porUnidad = caracteres que caben por unidad de ancho (más con letra más pequeña).
     */
    private function ajustarAlto(Worksheet $sheet, int $row, string $texto, float $ancho, float $porUnidad = 1.15, float $porLinea = 14.0): void
    {
        $porFila = max(1.0, $ancho * $porUnidad);
        $lineas = 0;
        foreach (explode("\n", $texto) as $parrafo) {
            $lineas += max(1, (int) ceil(mb_strlen($parrafo) / $porFila));
        }
        $alto = max((float) $sheet->getRowDimension($row)->getRowHeight(), $lineas * $porLinea + 6);
        $sheet->getRowDimension($row)->setRowHeight($alto);
    }

    /** Hojas anchas: impresión horizontal y a una página de ancho. */
    private function horizontal(Worksheet $sheet): void
    {
        $sheet->getPageSetup()
            ->setOrientation(PageSetup::ORIENTATION_LANDSCAPE)
            ->setFitToWidth(1)
            ->setFitToHeight(0);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Estilos
    // ─────────────────────────────────────────────────────────────────────────────

    private function addSection(Worksheet $sheet, int $startRow, string $title, array $data, string $color, ?string $nota = null): int
    {
        $row = $startRow;

        // Título de sección con color
        $sheet->setCellValue('A' . $row, $title);
        $sheet->mergeCells('A' . $row . ':B' . $row);
        $sheet->getStyle('A' . $row)->applyFromArray([
            'font' => ['bold' => true, 'size' => 12, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $color]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => $color]]],
        ]);
        $sheet->getRowDimension($row)->setRowHeight(25);
        $row++;

        if ($nota) {
            $row = $this->nota($sheet, $row, $nota, 'B');
        }

        return $this->filas($sheet, $row, $data);
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
            'font' => ['size' => 10],
        ]);
        // Las cifras van centradas; la última columna, en negrita.
        if ($endCol !== $startCol) {
            $sheet->getStyle('B' . $row . ':' . $endCol . $row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        }
        $sheet->getStyle($endCol . $row)->getFont()->setBold(true);
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
        $sheet->getRowDimension($row)->setRowHeight(20);
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
