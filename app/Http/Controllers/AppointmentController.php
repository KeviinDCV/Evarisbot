<?php

namespace App\Http\Controllers;

use App\Jobs\SendAppointmentReminderJob;
use App\Models\Appointment;
use App\Models\Setting;
use App\Support\EnvioRecordatorios;
use App\Support\Recordatorios;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\DefaultValueBinder;
use PhpOffice\PhpSpreadsheet\Cell\StringValueBinder;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use PhpOffice\PhpSpreadsheet\Style\Conditional;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class AppointmentController extends Controller
{
    protected string $service = 'general';
    protected string $routePrefix = 'admin.appointments';
    protected string $urlPrefix = '/admin/appointments';
    protected string $inertiaPage = 'admin/appointments/index';
    protected string $inertiaViewPage = 'admin/appointments/view';

    /** Más citas que esto no se exportan de una vez (el libro se arma entero en memoria): hay que filtrar por fechas. */
    public const LIMITE_EXPORTAR = 40000;

    /** Columnas del Excel de agendas que se leen (citfci se guarda como citfc). */
    private const COLUMNAS_EXCEL = [
        'citead', 'cianom', 'citmed', 'mednom', 'citesp', 'espnom',
        'citfci', 'cithor', 'citdoc', 'nom_paciente', 'pactel', 'pacnac',
        'pachis', 'cittid', 'citide', 'citres', 'cittip', 'nom_cotizante',
        'citcon', 'connom', 'citurg', 'citobsobs', 'duracion', 'ageperdes_g', 'dia',
    ];

    /** Sin estas columnas no se carga nada: las citas quedarían sin fecha, hora, teléfono o paciente. */
    private const OBLIGATORIAS = [
        'citfci' => 'fecha de la cita',
        'cithor' => 'hora',
        'pactel' => 'teléfono',
        'nom_paciente' => 'paciente',
    ];

    /** Filtros, columnas de orden y direcciones que acepta la lista (view) y la exportación. */
    private const FILTROS = ['all', 'pending', 'failed', 'confirmed', 'cancelled'];
    private const ORDENES = ['id', 'nom_paciente', 'citide', 'pactel', 'citfc', 'cithor', 'mednom', 'espnom', 'reminder_status'];
    private const COLUMNAS_BUSQUEDA = ['nom_paciente', 'citide', 'pactel', 'mednom', 'espnom'];

    /**
     * Query builder filtrado por servicio
     */
    protected function serviceQuery()
    {
        return Appointment::where('service', $this->service);
    }

    /**
     * Claves de settings con prefijo de servicio para no colisionar
     */
    protected function settingKey(string $key): string
    {
        return $this->service === 'general' ? $key : $this->service . '_' . $key;
    }

    /** Días de anticipación del envío normal: 1 a 7 (cualquier otro valor guardado → 2). */
    protected function diasDeAnticipacion(): int
    {
        $dias = (int) Setting::get($this->settingKey('reminder_days_in_advance'), '2');

        return $dias >= 1 && $dias <= 7 ? $dias : 2;
    }

    /** Máximo de recordatorios por envío (límite diario de Meta): al menos 1, por defecto 1.000. */
    protected function maxPorDia(): int
    {
        $max = (int) Setting::get($this->settingKey('reminder_max_per_day'), '1000');

        return $max >= 1 ? $max : 1000;
    }

    /**
     * Las citas de una fecha a las que se les puede mandar el recordatorio, separadas por celular válido:
     * por_enviar (con celular), sin_celular (quedan fuera y se informan aparte), salen = lo que sale al pulsar
     * (como máximo max_per_day) e ids, en orden de hora, de las que saldrían.
     */
    protected function tanda(string $fecha, int $max): array
    {
        $validos = [];
        $filas = $this->serviceQuery()->porRecordar($fecha)->orderBy('cithor')->orderBy('id')->get(['id', 'pactel']);
        foreach ($filas as $fila) {
            if (Recordatorios::celular($fila->pactel) !== null) {
                $validos[] = (int) $fila->id;
            }
        }
        $salen = min(count($validos), $max);

        return [
            'fecha' => $fecha,
            'por_enviar' => count($validos),
            'sin_celular' => $filas->count() - count($validos),
            'salen' => $salen,
            'ids' => array_slice($validos, 0, $salen),
        ];
    }

    /**
     * Mostrar la página de gestión de citas
     */
    public function index()
    {
        // Estado del envío: la misma función que getReminderStatus (nunca dan respuestas distintas). Si el lote ya
        // terminó, aquí mismo se limpia y se cierra el «último envío».
        $estado = EnvioRecordatorios::estado($this->service);

        // El layout + cascarón (carga de Excel, controles y barra de progreso) se entregan al
        // instante. Las consultas pesadas (tabla de citas + conteos sobre 100k+ filas)
        // se DIFIEREN (Inertia v2 deferred props): viajan en una segunda petición automática
        // mientras el frontend muestra un skeleton. Beneficia también a Citas Oncología (subclase).
        return Inertia::render($this->inertiaPage, [
            'ambito' => $this->service,
            'routePrefix' => $this->urlPrefix,
            'reminderProcessing' => $estado['processing'],
            'reminderPaused' => $estado['paused'],
            'reminderProgress' => $estado['processing'] ? $estado['progress'] : null,
            'reminderStalled' => $estado['sin_avanzar'],
            'ultimoEnvio' => EnvioRecordatorios::ultimoEnvio($this->service),
            'uploadedFile' => session('uploaded_file'),
            'uploadError' => session('upload_error'),

            // Últimas 50 citas (más recientes primero) - todos los admins ven todas
            'appointments' => Inertia::defer(function () {
                $hoy = Recordatorios::hoy();

                return $this->serviceQuery()->orderBy('id', 'desc')
                    ->limit(50)
                    ->get(Recordatorios::COLUMNAS_FILA)
                    ->map(fn ($apt) => Recordatorios::fila($apt, $hoy));
            }),

            'totalAppointments' => Inertia::defer(fn () => $this->serviceQuery()->count()),

            'remindersStats' => Inertia::defer(fn () => $this->estadisticasEnvio()),
        ]);
    }

    /**
     * Cifras del panel de envío. Las dos tandas (objetivo y mañana) salen de la MISMA consulta que usa el inicio del
     * envío, así que lo que la confirmación dice es lo que sale.
     */
    protected function estadisticasEnvio(): array
    {
        $hoy = Recordatorios::hoy();
        $dias = $this->diasDeAnticipacion();
        $max = $this->maxPorDia();

        $objetivo = $this->tanda(Recordatorios::dentroDe($dias), $max);
        $manana = $dias === 1 ? $objetivo : $this->tanda(Recordatorios::dentroDe(1), $max);
        unset($objetivo['ids'], $manana['ids']);

        // OJO: NO combinar estos COUNT en un SUM(condición) "de una sola pasada".
        // Se probó y fue 2,5x MÁS LENTO (3.418 ms vs 1.351 ms): COUNT(*) con un índice
        // que cubre las columnas del WHERE se resuelve leyendo sólo el índice, mientras
        // que SUM(expresión) obliga a MySQL a leer las filas completas.
        // Los índices (service, reminder_sent) y (service, reminder_status) los cubren.
        // «Enviados» descuenta los que Meta avisó después que no entregó (siguen con reminder_sent = 1).
        $enviados = $this->serviceQuery()->where('reminder_sent', true)->count();
        $noEntregados = $this->serviceQuery()->where('reminder_status', 'failed')->where('reminder_sent', true)->count();

        return [
            'hoy' => $hoy,
            'days_in_advance' => $dias,
            'max_per_day' => $max,
            'objetivo' => $objetivo,
            'manana' => $manana,
            'sent' => max(0, $enviados - $noEntregados),
            'failed' => $this->serviceQuery()->where('reminder_status', 'failed')->count(),
            'futuras' => $this->serviceQuery()->where('citfc', '>=', $hoy)->count(),
        ];
    }

    /**
     * Mostrar página dedicada con todas las citas y filtros
     */
    public function view(Request $request)
    {
        $query = $this->serviceQuery()->select(Recordatorios::COLUMNAS_FILA);
        $filtros = $this->aplicarFiltros($query, $request);
        $hoy = Recordatorios::hoy();

        // withQueryString: «Siguiente» y «Anterior» conservan filtro, búsqueda, fechas y orden.
        $appointments = $query->paginate(20)
            ->withQueryString()
            ->through(fn ($apt) => Recordatorios::fila($apt, $hoy));

        return Inertia::render($this->inertiaViewPage, [
            'appointments' => $appointments,
            'filter' => $filtros['filter'],
            'search' => $filtros['search'],
            'date_from' => $filtros['date_from'],
            'date_to' => $filtros['date_to'],
            'sort' => $filtros['sort'],
            'direction' => $filtros['direction'],
            'stats' => $this->estadisticasLista($filtros),
            'ambito' => $this->service,
            'routePrefix' => $this->urlPrefix,
            'limite_exportar' => self::LIMITE_EXPORTAR,
        ]);
    }

    /**
     * Normaliza los parámetros de la lista y los aplica (fechas, búsqueda, estado y orden). Lo usan view() y
     * export(), así que lo exportado es exactamente lo que se ve, en el mismo orden.
     *
     * @return array{filter: string, search: ?string, date_from: ?string, date_to: ?string, sort: string, direction: string}
     */
    protected function aplicarFiltros(Builder $query, Request $request): array
    {
        $texto = fn (string $clave) => is_string($request->query($clave)) ? $request->query($clave) : null;

        $search = trim((string) $texto('search'));
        $search = mb_substr($search, 0, 100);
        $filter = $texto('filter');
        $sort = $texto('sort');
        $direction = strtolower((string) $texto('direction'));

        $filtros = [
            'filter' => in_array($filter, self::FILTROS, true) ? $filter : 'all',
            'search' => $search === '' ? null : $search,
            'date_from' => $this->fechaValida($texto('date_from')),
            'date_to' => $this->fechaValida($texto('date_to')),
            'sort' => in_array($sort, self::ORDENES, true) ? $sort : 'id',
            'direction' => in_array($direction, ['asc', 'desc'], true) ? $direction : 'desc',
        ];

        $this->aplicarBase($query, $filtros);
        $this->aplicarEstado($query, $filtros['filter']);
        $this->aplicarOrden($query, $filtros['sort'], $filtros['direction']);

        return $filtros;
    }

    /** 'Y-m-d' real o null (cualquier otra cosa se ignora). */
    private function fechaValida(?string $valor): ?string
    {
        $valor = trim((string) $valor);
        $fecha = \DateTime::createFromFormat('!Y-m-d', $valor);

        return $fecha && $fecha->format('Y-m-d') === $valor ? $valor : null;
    }

    /**
     * Fechas y búsqueda (lo que comparten la lista y sus cifras). La búsqueda se parte en palabras (máx. 5) y CADA
     * una debe aparecer en el nombre, la cédula, el teléfono, el médico o la especialidad: así se encuentran los
     * nombres con doble espacio y «apellido nombre». Se escapan los comodines del LIKE.
     * Si «Desde» va después de «Hasta» no se intercambian: la lista sale vacía y la pantalla lo avisa.
     */
    private function aplicarBase(Builder $query, array $filtros): void
    {
        if ($filtros['date_from']) {
            $query->where('citfc', '>=', $filtros['date_from']);
        }
        if ($filtros['date_to']) {
            $query->where('citfc', '<=', $filtros['date_to']);
        }

        $palabras = array_slice(preg_split('/\s+/u', (string) $filtros['search'], -1, PREG_SPLIT_NO_EMPTY) ?: [], 0, 5);
        foreach ($palabras as $palabra) {
            $like = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $palabra).'%';
            $query->where(function ($q) use ($like) {
                foreach (self::COLUMNAS_BUSQUEDA as $columna) {
                    $q->orWhereRaw($columna." LIKE ? ESCAPE '!'", [$like]);
                }
            });
        }
    }

    /**
     * Filtro por estado. «pending» es «Sin recordatorio» (ni enviado, ni con error, ni cancelada ni confirmada);
     * «failed» es «Con error» (incluye los que Meta avisó después que no entregó).
     */
    private function aplicarEstado(Builder $query, string $filtro): void
    {
        match ($filtro) {
            'pending' => $query->where('reminder_sent', false)
                ->where(fn ($q) => $q->whereNull('reminder_status')->orWhereNotIn('reminder_status', ['failed', 'cancelled', 'confirmed'])),
            'failed' => $query->where('reminder_status', 'failed'),
            'confirmed' => $query->where('reminder_status', 'confirmed'),
            'cancelled' => $query->where('reminder_status', 'cancelled'),
            default => null,
        };
    }

    /** Orden con desempate por id siempre: sin él, LIMIT/OFFSET podía repetir u omitir citas entre páginas. */
    private function aplicarOrden(Builder $query, string $campo, string $direccion): void
    {
        if ($campo === 'citfc') {
            $query->orderByRaw("COALESCE(citfc, '2099-12-31') ".$direccion)
                ->orderByRaw("COALESCE(cithor, '23:59:59') ".$direccion);
        } elseif ($campo === 'cithor') {
            $query->orderByRaw("COALESCE(cithor, '23:59:59') ".$direccion);
        } elseif ($campo !== 'id') {
            $query->orderBy($campo, $direccion);
        }
        $query->orderBy('id', $direccion);
    }

    /**
     * Cifras de los filtros de la lista, sobre la MISMA base que la lista (ámbito, fechas y búsqueda) pero sin el
     * filtro de estado. Sin fechas ni búsqueda: COUNT por índice. Con ellas: una sola pasada con SUM(CASE…).
     */
    protected function estadisticasLista(array $filtros): array
    {
        $pendiente = "reminder_sent = 0 AND (reminder_status IS NULL OR reminder_status NOT IN ('failed', 'cancelled', 'confirmed'))";

        if (! $filtros['search'] && ! $filtros['date_from'] && ! $filtros['date_to']) {
            return [
                'all' => $this->serviceQuery()->count(),
                'pending' => $this->serviceQuery()->whereRaw($pendiente)->count(),
                'failed' => $this->serviceQuery()->where('reminder_status', 'failed')->count(),
                'confirmed' => $this->serviceQuery()->where('reminder_status', 'confirmed')->count(),
                'cancelled' => $this->serviceQuery()->where('reminder_status', 'cancelled')->count(),
            ];
        }

        $base = $this->serviceQuery();
        $this->aplicarBase($base, $filtros);
        $fila = $base->toBase()->selectRaw(
            "COUNT(*) AS todas,
             SUM(CASE WHEN {$pendiente} THEN 1 ELSE 0 END) AS pendientes,
             SUM(CASE WHEN reminder_status = 'failed' THEN 1 ELSE 0 END) AS con_error,
             SUM(CASE WHEN reminder_status = 'confirmed' THEN 1 ELSE 0 END) AS confirmadas,
             SUM(CASE WHEN reminder_status = 'cancelled' THEN 1 ELSE 0 END) AS canceladas"
        )->first();

        return [
            'all' => (int) ($fila->todas ?? 0),
            'pending' => (int) ($fila->pendientes ?? 0),
            'failed' => (int) ($fila->con_error ?? 0),
            'confirmed' => (int) ($fila->confirmadas ?? 0),
            'cancelled' => (int) ($fila->canceladas ?? 0),
        ];
    }

    /**
     * Exportar citas a Excel (.xlsx) — lo mismo que se ve en la lista (filtros y orden), con los mismos nombres de
     * estado que la pantalla. PhpSpreadsheet directo; se recorre con lazy() sobre un orden total (con id), que no
     * repite ni omite filas; colores con formato condicional por columna, no celda a celda.
     */
    public function export(Request $request)
    {
        set_time_limit(300);

        $query = $this->serviceQuery()->select([
            'id', 'citead', 'cianom', 'citdoc', 'nom_paciente', 'cittid', 'citide', 'pactel', 'citfc', 'cithor',
            'mednom', 'espnom', 'connom', 'citcon', 'citres', 'citobsobs',
            'reminder_sent', 'reminder_sent_at', 'reminder_status', 'reminder_error', 'notes',
        ]);
        $this->aplicarFiltros($query, $request);

        // Tope: el libro se arma entero en memoria. Es una navegación (enlace), así que se vuelve con un aviso.
        if ((clone $query)->reorder()->count() > self::LIMITE_EXPORTAR) {
            return redirect()->back(302, [], $this->urlPrefix.'/view')
                ->with('error', 'Son más de 40.000 citas: filtre por fechas para exportar.');
        }

        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Citas');

        $headings = [
            'Admisión', 'IPS', 'N.º de cita', 'Paciente', 'Tipo de documento', 'Documento', 'Teléfono',
            'Fecha de la cita', 'Hora', 'Médico', 'Especialidad', 'Consultorio', 'Cód. consultorio', 'EPS',
            'Observaciones', 'Recordatorio', 'Fecha de envío (hora Colombia)', 'Respuesta del paciente',
            'Motivo del error', 'Notas',
        ];
        $sheet->fromArray($headings, null, 'A1');
        $sheet->getStyle('A1:T1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 12, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '2e3f84']],
        ]);

        $widths = [
            'A' => 12, 'B' => 20, 'C' => 12, 'D' => 30, 'E' => 10, 'F' => 15, 'G' => 15, 'H' => 14, 'I' => 8, 'J' => 25,
            'K' => 20, 'L' => 24, 'M' => 12, 'N' => 18, 'O' => 40, 'P' => 18, 'Q' => 18, 'R' => 24, 'S' => 40, 'T' => 40,
        ];
        foreach ($widths as $col => $w) {
            $sheet->getColumnDimension($col)->setWidth($w);
        }

        // Todo como texto: documentos y teléfonos sin notación científica ni ceros perdidos, y nada se toma por fórmula.
        Cell::setValueBinder(new StringValueBinder());
        $hoy = Recordatorios::hoy();
        $row = 2;

        try {
            $bloque = [];
            foreach ($query->lazy(1000) as $appt) {
                $estado = Recordatorios::estadoFila($appt, $hoy);
                $respuesta = Recordatorios::respuesta($appt);
                $motivo = $estado === 'con_error' ? (Recordatorios::motivo($appt->reminder_error) ?? 'otro') : null;
                $bloque[] = [
                    $appt->citead ?? '',
                    $appt->cianom ?? '',
                    $appt->citdoc ?? '',
                    $appt->nom_paciente ?? '',
                    $appt->cittid ?? '',
                    $appt->citide ?? '',
                    $appt->pactel ?? '',
                    Recordatorios::fechaDe($appt->getAttributes()['citfc'] ?? null) ?? '',
                    Recordatorios::horaDe($appt->getAttributes()['cithor'] ?? null) ?? '',
                    $appt->mednom ?? '',
                    $appt->espnom ?? '',
                    $appt->connom ?? '',
                    $appt->citcon ?? '',
                    $appt->citres ?? '',
                    $appt->citobsobs ?? '',
                    Recordatorios::ETIQUETAS_ESTADO[$estado],
                    Recordatorios::horaCol($appt->reminder_sent_at) ?? '',
                    $respuesta ? Recordatorios::ETIQUETAS_RESPUESTA[$respuesta] : '',
                    $motivo ? Recordatorios::ETIQUETAS_MOTIVO[$motivo] : '',
                    $appt->notes ?? '',
                ];
                if (count($bloque) >= 1000) {
                    $sheet->fromArray($bloque, null, "A{$row}");
                    $row += count($bloque);
                    $bloque = [];
                }
            }
            if ($bloque) {
                $sheet->fromArray($bloque, null, "A{$row}");
                $row += count($bloque);
            }
        } finally {
            Cell::setValueBinder(new DefaultValueBinder());
        }

        // Colores por formato condicional (una regla por estado sobre toda la columna).
        $ultima = max(2, $row - 1);
        $verde = ['C6EFCE', '006100'];
        $rojo = ['FFC7CE', '9C0006'];
        $ambar = ['FFEB9C', '9C6500'];
        $gris = ['F2F2F2', '7F7F7F'];
        $this->colorearColumna($sheet, 'P', $ultima, [
            'Enviado' => $verde, 'Con error' => $rojo, 'Por enviar' => $ambar, 'No se envió' => $gris,
            'Sin celular válido' => $gris, 'Sin fecha' => $gris, 'No hacía falta' => $gris,
        ]);
        $this->colorearColumna($sheet, 'R', $ultima, [
            'Confirmada' => $verde, 'Cancelada' => $rojo, 'Cancelada por el hospital' => $rojo, 'Sin respuesta' => $ambar,
        ]);

        // Guardar a archivo temporal y descargar
        $fileName = 'citas_'.($this->service === 'oncology' ? 'oncologia' : 'generales').'_'.now(Recordatorios::ZONA)->format('Y-m-d_Hi').'.xlsx';
        $temp = tempnam(sys_get_temp_dir(), 'citas_export_');

        $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
        $writer->setPreCalculateFormulas(false);
        $writer->save($temp);

        // Liberar memoria
        $spreadsheet->disconnectWorksheets();
        unset($spreadsheet);

        return response()->download($temp, $fileName, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    /** Formato condicional: celda igual a «texto» → fondo y letra de ese color. */
    private function colorearColumna($sheet, string $columna, int $ultima, array $colores): void
    {
        $reglas = [];
        foreach ($colores as $texto => [$fondo, $letra]) {
            $regla = new Conditional();
            $regla->setConditionType(Conditional::CONDITION_CELLIS)
                ->setOperatorType(Conditional::OPERATOR_EQUAL)
                ->addCondition('"'.$texto.'"');
            $regla->getStyle()->getFont()->setBold(true)->getColor()->setRGB($letra);
            $regla->getStyle()->getFill()->setFillType(Fill::FILL_SOLID);
            $regla->getStyle()->getFill()->getStartColor()->setRGB($fondo);
            $regla->getStyle()->getFill()->getEndColor()->setRGB($fondo);
            $reglas[] = $regla;
        }
        $sheet->getStyle("{$columna}2:{$columna}{$ultima}")->setConditionalStyles($reglas);
    }

    /**
     * Subir archivo Excel con citas. Cargar NO envía mensajes: solo deja las citas en el sistema.
     */
    public function upload(Request $request)
    {
        $validacion = Validator::make($request->all(), [
            'file' => ['required', 'file', 'mimes:xlsx,xls', 'max:10240'], // Max 10 MB
        ], [
            'file.required' => 'Elija el archivo de citas.',
            'file.file' => 'El archivo no llegó completo. Vuelva a intentarlo.',
            'file.uploaded' => 'El archivo no llegó completo. Vuelva a intentarlo.',
            'file.mimes' => 'El archivo debe ser Excel (.xlsx o .xls).',
            'file.max' => 'El archivo pesa más de 10 MB.',
        ]);

        if ($validacion->fails()) {
            $regla = array_key_first($validacion->failed()['file'] ?? []) ?? 'Required';
            $code = match ($regla) {
                'Required' => 'requerido',
                'Mimes' => 'tipo',
                'Max' => 'tamano',
                default => 'subida_incompleta',
            };

            return redirect()->back(302, [], $this->urlPrefix)->withErrors($validacion)->with('upload_error', ['code' => $code]);
        }

        $file = $request->file('file');
        $originalName = $file->getClientOriginalName();
        $ext = strtolower((string) $file->getClientOriginalExtension());
        if (! in_array($ext, ['xlsx', 'xls'], true)) {
            $ext = $file->guessExtension() === 'xls' ? 'xls' : 'xlsx';
        }

        // Copia temporal con su extensión (el lector la necesita) que se borra siempre al terminar: ya no queda
        // guardado el Excel con datos de pacientes.
        $base = tempnam(sys_get_temp_dir(), 'citas_');
        $temporal = $base.'.'.$ext;

        try {
            copy($file->getRealPath(), $temporal);
            $resultado = $this->processAndSaveExcel($temporal);

            if (isset($resultado['rechazo'])) {
                Log::info('Archivo de citas rechazado', ['archivo' => $originalName, 'motivo' => $resultado['rechazo']['code'], 'user_id' => auth()->id()]);

                return redirect()->back(302, [], $this->urlPrefix)
                    ->withErrors(['file' => $resultado['mensaje']])
                    ->with('upload_error', $resultado['rechazo']);
            }

            Log::info('Archivo de citas cargado', [
                'archivo' => $originalName,
                'columnas' => $resultado['columnas'],
                'conteos' => $resultado['conteos'],
                'user_id' => auth()->id(),
            ]);

            return redirect()->route($this->routePrefix . '.index')->with('uploaded_file', [
                'name' => $originalName,
                'size' => $file->getSize(),
                'uploaded_at' => Recordatorios::ahoraCol(),
            ] + $resultado['conteos']);
        } catch (\Throwable $e) {
            // El detalle va al log (sin datos de pacientes: de un error SQL solo el texto del motor, no la consulta).
            Log::error('Error al cargar archivo de citas', [
                'archivo' => $originalName,
                'error' => $e instanceof QueryException ? ($e->errorInfo[2] ?? (string) $e->getCode()) : $e->getMessage(),
                'tipo' => get_class($e),
                'user_id' => auth()->id(),
            ]);

            return redirect()->back(302, [], $this->urlPrefix)->withErrors([
                'file' => 'No se pudo cargar el archivo y no se guardó ninguna cita. Revise que sea el Excel de agendas y vuelva a intentarlo.',
            ])->with('upload_error', ['code' => 'fallo']);
        } finally {
            @unlink($temporal);
            @unlink($base);
        }
    }

    /**
     * Lee el Excel y guarda las citas en dos fases: primero solo lectura (columnas, fechas, repetidas, qué existe
     * ya) y después todas las escrituras en una transacción, para que un fallo no deje nada a medias.
     *
     * Una cita es la misma si coinciden persona (cédula, o historia si no hay cédula), fecha, hora y médico, la haya
     * cargado quien la haya cargado. Si ya existe: con recordatorio enviado no se toca; sin él se actualizan sus
     * datos (teléfono, observaciones…). Si llega con otra fecha u hora el mismo número de cita de la misma persona,
     * aún sin recordatorio, y el archivo trae la agenda del día y el médico de la cita vieja (que ya no aparece en
     * ella), es la cita movida: se reprograma esa fila (evita avisar la fecha vieja).
     *
     * @return array{conteos: array, columnas: array}|array{rechazo: array, mensaje: string}
     */
    private function processAndSaveExcel(string $ruta): array
    {
        ini_set('memory_limit', '2048M');
        set_time_limit(600); // 10 minutos

        $reader = IOFactory::createReaderForFile($ruta);
        $reader->setReadDataOnly(true);
        $spreadsheet = $reader->load($ruta);
        $filas = [];
        $sinFecha = 0;

        try {
            $hoja = $spreadsheet->getActiveSheet();
            $ultimaFila = $hoja->getHighestDataRow();
            $ultimaColumna = $hoja->getHighestDataColumn();

            $titulos = $hoja->rangeToArray('A1:'.$ultimaColumna.'1', null, true, false, false)[0] ?? [];
            $titulos = array_map(fn ($t) => mb_strtolower(trim((string) $t)), $titulos);
            if (count(array_filter($titulos, fn ($t) => $t !== '')) === 0) {
                return $this->rechazoCarga('vacio');
            }

            $indices = [];
            foreach (self::COLUMNAS_EXCEL as $columna) {
                $i = array_search($columna, $titulos, true);
                if ($i !== false) {
                    $indices[$columna] = $i;
                }
            }

            $faltan = array_values(array_diff(array_keys(self::OBLIGATORIAS), array_keys($indices)));
            if ($faltan) {
                return $this->rechazoCarga('columnas_faltantes', $faltan);
            }

            for ($inicio = 2; $inicio <= $ultimaFila; $inicio += 100) {
                $fin = min($inicio + 99, $ultimaFila);
                foreach ($hoja->rangeToArray("A{$inicio}:{$ultimaColumna}{$fin}", null, true, false, false) as $row) {
                    if (count(array_filter($row, fn ($v) => $v !== null && trim((string) $v) !== '')) === 0) {
                        continue;
                    }
                    $cita = $this->leerFila($row, $indices);
                    if ($cita['citfc'] === null || $cita['cithor'] === null) {
                        $sinFecha++;
                        continue;
                    }
                    $filas[] = $cita;
                }
            }
        } finally {
            $spreadsheet->disconnectWorksheets();
            unset($spreadsheet);
        }

        if (! $filas && $sinFecha === 0) {
            return $this->rechazoCarga('vacio');
        }

        $campos = array_keys($filas[0] ?? []);
        $hoy = Recordatorios::hoy();
        $conteos = ['nuevas' => 0, 'actualizadas' => 0, 'reprogramadas' => 0, 'duplicadas' => 0, 'sin_fecha' => $sinFecha, 'sin_celular' => 0];

        // ---- Fase 1 (solo lectura): lo que ya existe del ámbito en las fechas del archivo, sin mirar quién lo cargó.
        $existentes = [];
        $fechas = array_values(array_unique(array_column($filas, 'citfc')));
        foreach (array_chunk($fechas, 200) as $trozo) {
            foreach (DB::table('appointments')->where('service', $this->service)->whereIn('citfc', $trozo)->orderBy('id')->get() as $e) {
                $existentes[$this->claveCita((array) $e, $campos)][] = $e;
            }
        }

        $vistos = [];
        $usadas = [];
        $sinCoincidencia = [];
        $actualizar = [];
        $nuevas = [];
        $finales = []; // [citfc, pactel] de lo que entra o cambia, para contar sin celular

        foreach ($filas as $cita) {
            $clave = $this->claveCita($cita, $campos);
            if (isset($vistos[$clave])) {
                $conteos['duplicadas']++; // Repetida dentro del mismo archivo.
                continue;
            }
            $vistos[$clave] = true;

            if (! isset($existentes[$clave])) {
                $sinCoincidencia[] = $cita;
                continue;
            }

            $grupo = $existentes[$clave];
            $libre = null;
            foreach ($grupo as $e) {
                if ((bool) $e->reminder_sent) {
                    $libre = false;
                    break;
                }
                if ($libre === null && ! isset($usadas[$e->id])) {
                    $libre = $e;
                }
            }
            if (! $libre) {
                $conteos['duplicadas']++; // Ya tiene recordatorio: no se toca.
                continue;
            }

            $usadas[$libre->id] = true;
            $cambios = $this->cambiosDeCita($libre, $cita);
            if ($cambios) {
                $actualizar[$libre->id] = $cambios;
                $conteos['actualizadas']++;
                $finales[] = [$cita['citfc'], array_key_exists('pactel', $cambios) ? $cambios['pactel'] : $libre->pactel];
            } else {
                $conteos['duplicadas']++;
            }
        }

        // Citas movidas: mismo número de cita y misma persona, aún sin recordatorio y de hoy en adelante.
        $candidatas = [];
        $documentos = array_values(array_unique(array_filter(array_map(fn ($c) => $c['citdoc'] ?? null, $sinCoincidencia))));
        foreach (array_chunk($documentos, 500) as $trozo) {
            $consulta = DB::table('appointments')->where('service', $this->service)
                ->whereIn('citdoc', $trozo)
                ->where('reminder_sent', false)
                ->where(fn ($q) => $q->whereNull('reminder_status')->orWhereNotIn('reminder_status', Recordatorios::RESUELTAS))
                ->where('citfc', '>=', $hoy)
                ->orderBy('id');
            foreach ($consulta->get() as $e) {
                $candidatas[$this->texto($e->citdoc)][] = $e;
            }
        }

        // El mismo número de cita NO basta para decir que se movió: en producción hay cientos de pacientes con varias
        // citas reales bajo el mismo citdoc (sesiones, controles; 179 con las dos confirmadas). Solo se toma por
        // movida si este archivo trae la agenda de ese día y ese médico (fecha|médico de la cita vieja) y la cita ya
        // no está en ella; si el archivo no cubre ese día, la nueva entra como nueva y la vieja se queda como está.
        $cubiertas = [];
        foreach ($filas as $c) {
            $cubiertas[$c['citfc'].'|'.mb_strtoupper((string) ($c['citmed'] ?? ''))] = true;
        }

        $ahora = now();
        foreach ($sinCoincidencia as $cita) {
            $persona = $this->personaDe($cita);
            $movida = null;
            foreach ($candidatas[$cita['citdoc'] ?? ''] ?? [] as $e) {
                $agenda = Recordatorios::fechaDe($e->citfc).'|'.mb_strtoupper((string) $this->texto($e->citmed ?? null));
                if ($persona !== null && ! isset($usadas[$e->id]) && $this->personaDe((array) $e) === $persona && isset($cubiertas[$agenda])) {
                    $movida = $e;
                    break;
                }
            }

            if ($movida) {
                $usadas[$movida->id] = true;
                $actualizar[$movida->id] = ['citfc' => $cita['citfc'], 'cithor' => $cita['cithor']] + $this->cambiosDeCita($movida, $cita);
                $conteos['reprogramadas']++;
                $finales[] = [$cita['citfc'], array_key_exists('pactel', $actualizar[$movida->id]) ? $actualizar[$movida->id]['pactel'] : $movida->pactel];
                continue;
            }

            $nuevas[] = $cita + [
                'uploaded_by' => auth()->id(),
                'service' => $this->service,
                'created_at' => $ahora,
                'updated_at' => $ahora,
            ];
            $conteos['nuevas']++;
            $finales[] = [$cita['citfc'], $cita['pactel'] ?? null];
        }

        foreach ($finales as [$fecha, $telefono]) {
            if ($fecha >= $hoy && Recordatorios::celular($telefono) === null) {
                $conteos['sin_celular']++;
            }
        }

        // ---- Fase 2: todas las escrituras juntas. Si algo falla, no queda nada a medias.
        DB::transaction(function () use ($nuevas, $actualizar, $ahora) {
            foreach (array_chunk($nuevas, 100) as $lote) {
                DB::table('appointments')->insert($lote);
            }
            foreach ($actualizar as $id => $cambios) {
                DB::table('appointments')->where('id', $id)->update($cambios + ['updated_at' => $ahora]);
            }
        });

        return ['conteos' => $conteos, 'columnas' => array_keys($indices)];
    }

    /** Respuesta de una carga rechazada: código para la pantalla y el texto en español llano. */
    private function rechazoCarga(string $code, array $columnas = []): array
    {
        if ($code === 'columnas_faltantes') {
            $lista = implode(', ', array_map(fn ($c) => $c.' ('.self::OBLIGATORIAS[$c].')', $columnas));

            return [
                'rechazo' => ['code' => $code, 'columnas' => $columnas],
                'mensaje' => 'El archivo no tiene estas columnas: '.$lista.'. La primera fila debe traer los nombres de las columnas tal como salen del sistema de agendas. No se cargó ninguna cita.',
            ];
        }

        return [
            'rechazo' => ['code' => 'vacio'],
            'mensaje' => 'El archivo no trae citas: está vacío o solo tiene la fila de títulos. No se cargó ninguna cita.',
        ];
    }

    /** Una fila del Excel ya interpretada: textos sin espacios de más, fecha 'Y-m-d' y hora 'H:i:s' (o null). */
    private function leerFila(array $row, array $indices): array
    {
        $cita = [];
        foreach ($indices as $columna => $i) {
            $valor = $row[$i] ?? null;
            match ($columna) {
                'citfci' => $cita['citfc'] = $this->leerFecha($valor),
                'cithor' => $cita['cithor'] = $this->leerHora($valor),
                'pacnac' => $cita['pacnac'] = $this->leerNacimiento($valor),
                default => $cita[$columna] = $this->texto($valor),
            };
        }

        return $cita;
    }

    /** Texto normalizado: sin espacios al borde ni dobles; los números enteros de Excel sin «.0»; vacío → null. */
    private function texto(mixed $valor): ?string
    {
        if ($valor === null) {
            return null;
        }
        if (is_float($valor) && floor($valor) == $valor && abs($valor) < 1e15) {
            $valor = (string) (int) $valor;
        }
        $original = trim((string) $valor);
        $limpio = preg_replace('/\s+/u', ' ', $original);
        $limpio = $limpio === null ? $original : trim($limpio);

        return $limpio === '' ? null : $limpio;
    }

    /** Fecha de la cita: número de Excel o texto AAAA/MM/DD, DD/MM/AAAA o AAAA-MM-DD. */
    private function leerFecha(mixed $valor): ?string
    {
        if ($valor === null || $valor === '') {
            return null;
        }
        if (is_numeric($valor)) {
            try {
                return Date::excelToDateTimeObject($valor)->format('Y-m-d');
            } catch (\Throwable) {
                return null;
            }
        }
        $texto = trim((string) $valor);
        foreach (['Y/m/d', 'd/m/Y', 'Y-m-d'] as $formato) {
            $fecha = \DateTime::createFromFormat($formato, $texto);
            if ($fecha && $fecha->format($formato) === $texto) {
                return $fecha->format('Y-m-d');
            }
        }

        return null;
    }

    /** Hora de la cita: fracción del día de Excel o texto «04:30 PM», «16:30», «16:30:00». */
    private function leerHora(mixed $valor): ?string
    {
        if ($valor === null || $valor === '') {
            return null;
        }
        if (is_numeric($valor)) {
            try {
                return Date::excelToDateTimeObject($valor)->format('H:i:s');
            } catch (\Throwable) {
                return null;
            }
        }
        $texto = trim((string) $valor);
        foreach ([['h:i A', strtoupper($texto)], ['h:i a', strtolower($texto)], ['H:i', $texto], ['H:i:s', $texto]] as [$formato, $v]) {
            $hora = \DateTime::createFromFormat($formato, $v);
            if ($hora) {
                return $hora->format('H:i:s');
            }
        }

        return null;
    }

    /** Fecha de nacimiento: 0 o vacío → null; número de Excel o DD/MM/AAAA. */
    private function leerNacimiento(mixed $valor): ?string
    {
        if (empty($valor) || $valor === '0') {
            return null;
        }
        if (is_numeric($valor)) {
            try {
                return Date::excelToDateTimeObject($valor)->format('Y-m-d');
            } catch (\Throwable) {
                return null;
            }
        }
        $fecha = \DateTime::createFromFormat('d/m/Y', trim((string) $valor));

        return $fecha ? $fecha->format('Y-m-d') : null;
    }

    /** Persona de la cita: la cédula, o la historia si no hay cédula (en mayúsculas para comparar). */
    private function personaDe(array $cita): ?string
    {
        $persona = $this->texto($cita['citide'] ?? null) ?? $this->texto($cita['pachis'] ?? null);

        return $persona === null ? null : mb_strtoupper($persona);
    }

    /**
     * Identidad de una cita: persona | fecha | hora | médico. Sin cédula ni historia, la huella de todas las columnas
     * que trae el archivo (como antes), comparadas ya normalizadas en los dos lados.
     */
    private function claveCita(array $cita, array $campos): string
    {
        $fecha = Recordatorios::fechaDe($cita['citfc'] ?? null);
        $hora = Recordatorios::horaDe($cita['cithor'] ?? null);
        $persona = $this->personaDe($cita);

        if ($persona !== null) {
            return implode('|', ['p', $persona, $fecha, $hora, mb_strtoupper((string) $this->texto($cita['citmed'] ?? null))]);
        }

        $huella = [];
        foreach ($campos as $campo) {
            $huella[$campo] = match ($campo) {
                'citfc' => $fecha,
                'cithor' => $hora,
                'pacnac' => Recordatorios::fechaDe($cita['pacnac'] ?? null),
                default => $this->texto($cita[$campo] ?? null),
            };
        }

        return 'h|'.md5(json_encode($huella));
    }

    /**
     * Datos que cambian en una cita que ya estaba (nunca reminder_*, service, uploaded_by, conversation_id ni notes).
     * Si cambió el teléfono y la cita tenía error de teléfono, el error se limpia para que vuelva a «Por enviar».
     */
    private function cambiosDeCita(object $existente, array $cita): array
    {
        $cambios = [];
        foreach ($cita as $campo => $valor) {
            if ($campo === 'citfc' || $campo === 'cithor') {
                continue;
            }
            $actual = $campo === 'pacnac' ? Recordatorios::fechaDe($existente->pacnac ?? null) : $this->texto($existente->{$campo} ?? null);
            if ($actual !== $valor) {
                $cambios[$campo] = $valor;
            }
        }

        if (array_key_exists('pactel', $cambios) && Recordatorios::motivo($existente->reminder_error ?? null) === 'telefono') {
            $cambios['reminder_error'] = null;
            // Una cita cancelada o confirmada sigue así: volverla a 'pending' la metía otra vez en «Por enviar».
            if (! in_array($existente->reminder_status ?? null, Recordatorios::RESUELTAS, true)) {
                $cambios['reminder_status'] = 'pending';
            }
        }

        return $cambios;
    }

    /**
     * Iniciar envío de recordatorios (citas de hoy + días de anticipación)
     */
    public function startReminders(Request $request)
    {
        return $this->iniciarEnvio($request, 'normal');
    }

    /**
     * Iniciar envío de recordatorios 1 día antes (mañana)
     * Para citas que no se enviaron a tiempo (2 días antes)
     */
    public function startRemindersDayBefore(Request $request)
    {
        return $this->iniciarEnvio($request, 'dia_antes');
    }

    /**
     * Inicia un envío. La fecha la calcula SIEMPRE el servidor (hoy en Colombia + días): lo que manda la página
     * (fecha_citas y esperadas, lo que mostró la confirmación) solo se compara. Si no coincide no se crea nada y
     * se responde 409 'cambio' con las cifras nuevas para volver a confirmar.
     */
    protected function iniciarEnvio(Request $request, string $tipo)
    {
        // Dos clics, dos pestañas o dos administradores a la vez: solo uno inicia.
        $lock = Cache::lock('recordatorios-inicio-'.$this->service, 120);
        if (! $lock->get()) {
            return $this->respuestaEnCurso();
        }

        $batch = null;

        try {
            $validacion = Validator::make($request->all(), [
                'fecha_citas' => ['required', 'date_format:Y-m-d'],
                'esperadas' => ['required', 'integer', 'min:1', 'max:100000'],
            ]);
            if ($validacion->fails()) {
                // Una pestaña con la versión vieja (sin cuerpo) cae aquí: la página pide recargar.
                return response()->json(['success' => false, 'code' => 'datos_invalidos'], 422);
            }

            if (EnvioRecordatorios::estado($this->service)['processing']) {
                return $this->respuestaEnCurso();
            }

            if (! filled(Setting::get('whatsapp_token')) || ! filled(Setting::get('whatsapp_phone_number_id'))) {
                return response()->json(['success' => false, 'code' => 'sin_configurar'], 422);
            }

            $dias = $tipo === 'dia_antes' ? 1 : $this->diasDeAnticipacion();
            $fecha = Recordatorios::dentroDe($dias);
            $tanda = $this->tanda($fecha, $this->maxPorDia());

            if ($request->input('fecha_citas') !== $fecha || (int) $request->input('esperadas') !== $tanda['salen']) {
                return response()->json([
                    'success' => false,
                    'code' => 'cambio',
                    'cambio' => true,
                    'fecha' => $fecha,
                    'total' => $tanda['salen'],
                    'por_enviar' => $tanda['por_enviar'],
                    'sin_celular' => $tanda['sin_celular'],
                ], 409);
            }

            $ids = $tanda['ids'];

            // Solo las que se encolan: se limpia su error reintentable y quedan 'pending' (nunca toca canceladas).
            Appointment::whereIntegerInRaw('id', $ids)
                ->where('reminder_sent', false)
                ->where(fn ($q) => $q->whereNull('reminder_status')->orWhereNotIn('reminder_status', Recordatorios::RESUELTAS))
                ->update(['reminder_error' => null, 'reminder_status' => 'pending']);

            $service = $this->service;
            $batch = Bus::batch(array_map(fn ($id) => new SendAppointmentReminderJob($id), $ids))
                ->name(EnvioRecordatorios::NOMBRE_LOTE.' ('.$service.') - '.now(Recordatorios::ZONA)->format('Y-m-d H:i'))
                ->allowFailures() // Permitir que algunos jobs fallen sin cancelar todo
                ->finally(function (\Illuminate\Bus\Batch $batch) use ($service) {
                    // Solo limpia si sigue siendo el lote vigente del ámbito, y cierra el «último envío».
                    \App\Support\EnvioRecordatorios::alTerminarLote($service, $batch);
                })
                ->dispatch();

            $ultimo = EnvioRecordatorios::iniciar($service, $batch->id, $ids, [
                'tipo' => $tipo,
                'fecha_citas' => $fecha,
                'sin_celular' => $tanda['sin_celular'],
                'iniciado_por' => auth()->user()?->name,
            ]);

            Log::info('Envío de recordatorios iniciado', [
                'user_id' => auth()->id(),
                'service' => $service,
                'tipo' => $tipo,
                'fecha_citas' => $fecha,
                'total' => count($ids),
                'sin_celular' => $tanda['sin_celular'],
                'batch_id' => $batch->id,
            ]);

            return response()->json([
                'success' => true,
                'total' => count($ids),
                'fecha' => $fecha,
                'batch_id' => $batch->id,
                'ultimo_envio' => $ultimo,
            ]);
        } catch (\Throwable $e) {
            if ($batch) {
                try {
                    $batch->cancel();
                } catch (\Throwable) {
                    // Nada más que hacer: el log de abajo lo deja registrado.
                }
                EnvioRecordatorios::limpiar($this->service, $batch->id);
            }

            Log::error('Error al iniciar recordatorios', [
                'service' => $this->service,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['success' => false, 'code' => 'fallo'], 500);
        } finally {
            $lock->release();
        }
    }

    /** 409: ya hay un envío en marcha (la página se pone a seguirlo en vez de ocultarlo). */
    private function respuestaEnCurso()
    {
        return response()->json([
            'success' => false,
            'code' => 'en_curso',
            'en_curso' => true,
            'ultimo_envio' => EnvioRecordatorios::ultimoEnvio($this->service),
        ], 409);
    }

    /**
     * Pausar envío de recordatorios (solo el de este ámbito: el trabajo lee la pausa del ámbito de su cita)
     */
    public function pauseReminders()
    {
        return $this->cambiarPausa(true);
    }

    /**
     * Reanudar envío de recordatorios
     */
    public function resumeReminders()
    {
        return $this->cambiarPausa(false);
    }

    private function cambiarPausa(bool $pausar)
    {
        try {
            if (! EnvioRecordatorios::estado($this->service)['processing']) {
                return response()->json(['success' => false, 'code' => 'sin_envio'], 409);
            }

            EnvioRecordatorios::guardar($this->service, 'reminder_paused', $pausar ? 'true' : 'false');

            Log::info($pausar ? 'Recordatorios pausados manualmente' : 'Recordatorios reanudados manualmente', [
                'user_id' => auth()->id(),
                'service' => $this->service,
            ]);

            return response()->json(['success' => true, 'paused' => $pausar]);
        } catch (\Throwable $e) {
            Log::error($pausar ? 'Error al pausar recordatorios' : 'Error al reanudar recordatorios', [
                'service' => $this->service,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['success' => false, 'code' => 'fallo'], 500);
        }
    }

    /**
     * Detener completamente el envío de recordatorios de ESTE ámbito: cancela sus lotes vivos y borra de la cola los
     * trabajos de sus citas (también huérfanos sin lote). Las citas no enviadas siguen en «Por enviar».
     */
    public function stopReminders()
    {
        try {
            $resultado = EnvioRecordatorios::detener($this->service);

            Log::info('Recordatorios detenidos', [
                'user_id' => auth()->id(),
                'service' => $this->service,
                'jobs_eliminados' => $resultado['borrados'],
            ]);

            return response()->json(['success' => true] + $resultado);
        } catch (\Throwable $e) {
            Log::error('Error al detener recordatorios', [
                'service' => $this->service,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['success' => false, 'code' => 'fallo'], 500);
        }
    }

    /**
     * Estado del envío para el sondeo de la página (solo JSON). Sin COUNT de pendientes: las cifras del panel se
     * recargan aparte al terminar.
     */
    public function getReminderStatus()
    {
        $estado = EnvioRecordatorios::estado($this->service);

        return response()->json([
            'processing' => $estado['processing'],
            'paused' => $estado['paused'],
            'progress' => $estado['processing'] ? $estado['progress'] : null,
            'sin_avanzar' => $estado['sin_avanzar'],
            'ultimo_envio' => EnvioRecordatorios::ultimoEnvio($this->service),
        ])->header('Cache-Control', 'no-store');
    }
}
