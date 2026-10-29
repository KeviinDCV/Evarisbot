<?php

namespace App\Http\Controllers\Admin;

use App\Exports\StatisticsExport;
use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Template;
use App\Models\User;
use App\Services\InactiveConversationReleaser;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class StatisticsController extends Controller
{
    /**
     * Zona horaria del negocio. La app corre en UTC y las marcas de tiempo se guardan
     * en UTC, pero el hospital opera en Colombia (UTC-5).
     */
    private const BUSINESS_TZ = 'America/Bogota';

    private const PERIODOS = ['today', 'week', 'month', 'year', 'all'];

    /**
     * Toques de los botones de los recordatorios (Confirmar/Cancelar…): llegan como mensajes del
     * paciente pero no son algo que haya escrito. Misma lista que conversations:hide-appointment-responses
     * (desde jun 2026 ya llegan ocultos; los de antes no).
     */
    private const BOTONES = [
        'confirmar', 'confirmo', 'confirmado', 'confirmada',
        'asistir', 'asisto', 'asistire', 'asistiré',
        'cancelar', 'cancelo', 'cancelado', 'cancelada',
        'si confirmo', 'sí confirmo', 'si asisto', 'sí asisto',
        '✅', '❌',
    ];

    /** Nota que deja AppointmentCancellationSync cuando el HOSPITAL cancela la cita con la plantilla. */
    private const NOTA_CANCELADA_HOSPITAL = '%Cancelada al enviar la plantilla%';

    /**
     * Huecos de datos conocidos: la pantalla y el Excel los avisan para que un 0 o una caída no
     * se lean como «no hubo actividad». Fechas en hora de Colombia; to=null es «sin fin».
     */
    private const VACIOS = [
        ['key' => 'messages_nov2025_jan2026', 'topics' => ['messages', 'advisors'], 'from' => '2025-11-01', 'to' => '2026-01-31'],
        ['key' => 'appointments_since_aug2026', 'topics' => ['appointments'], 'from' => '2026-08-13', 'to' => null],
        ['key' => 'webhook_oct2026', 'topics' => ['messages', 'delivery', 'conversations', 'costs'], 'from' => '2026-10-11', 'to' => '2026-10-13'],
        ['key' => 'late_oct2026', 'topics' => ['messages'], 'from' => '2026-10-14', 'to' => '2026-10-15'],
        ['key' => 'cost_attacker_oct2026', 'topics' => ['costs'], 'from' => '2026-10-11', 'to' => '2026-10-12'],
        // Antes de esta fecha no existe el historial (conversation_activities): las resueltas y
        // agendadas por asesor no se pueden contar y la resolución sale más baja de lo real.
        ['key' => 'history_before_mar2026', 'topics' => ['advisors'], 'from' => '2000-01-01', 'to' => '2026-03-30'],
    ];

    /**
     * Display statistics page
     */
    public function index(Request $request)
    {
        [$period, $startDate, $endDate] = $this->filtros($request);

        // El layout (sidebar/topbar) y el cascarón de la página se entregan de inmediato.
        // Las agregaciones pesadas se DIFIEREN (Inertia v2 deferred props): viajan en una
        // segunda petición automática y el frontend muestra un skeleton mientras tanto.
        return Inertia::render('admin/statistics/index', [
            'statistics' => Inertia::defer(fn () => $this->calcular($period, $startDate, $endDate)),
        ]);
    }

    /**
     * Export statistics to Excel. Usa exactamente las mismas cifras (y la misma caché) que la pantalla.
     */
    public function export(Request $request)
    {
        [$period, $startDate, $endDate] = $this->filtros($request);

        $statistics = $this->calcular($period, $startDate, $endDate);

        // Hora de Colombia: con now() (UTC) un archivo bajado a las 15:00 salía marcado
        // como las 20:00, y los de la tarde aparecían fechados al día siguiente.
        $fileName = 'estadisticas_' . now()->setTimezone(self::BUSINESS_TZ)->format('Y-m-d_His') . '.xlsx';

        $export = new StatisticsExport($statistics, $statistics['date_range']);

        return $export->download($fileName);
    }

    /**
     * Filtros validados: [period, start_date|null, end_date|null]. Un periodo desconocido vale 'all';
     * un rango incompleto, mal escrito o al revés se ignora (antes daba error 500 o cifras en cero).
     */
    private function filtros(Request $request): array
    {
        $period = in_array($request->query('period'), self::PERIODOS, true) ? $request->query('period') : 'all';

        $fecha = function ($valor): ?string {
            if (! is_string($valor) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $valor)) {
                return null;
            }
            [$y, $m, $d] = array_map('intval', explode('-', $valor));
            if (! checkdate($m, $d, $y) || $y < 2000 || $y > (int) now()->year + 1) {
                return null;
            }

            return $valor;
        };

        $start = $fecha($request->query('start_date'));
        $end = $fecha($request->query('end_date'));

        if (! $start || ! $end || $start > $end) {
            return [$period, null, null];
        }

        return [$period, $start, $end];
    }

    /**
     * Todas las cifras de la pantalla (y del Excel), cacheadas 5 minutos (1 minuto para «Hoy»).
     */
    private function calcular(string $period, ?string $startDate, ?string $endDate): array
    {
        [$dateStart, $dateEnd] = $this->calculateDateRange($startDate, $endDate, $period);
        $custom = $startDate !== null && $endDate !== null;

        $cacheKey = 'statistics_v3_' . md5(serialize([
            'start' => $dateStart?->toIso8601String(),
            'end' => $dateEnd?->toIso8601String(),
            'period' => $period,
            'custom' => $custom,
        ]));

        $ttl = ($period === 'today' && ! $custom) ? 60 : 300;

        return Cache::remember($cacheKey, $ttl, function () use ($dateStart, $dateEnd, $period, $custom) {
            $rango = $this->rangoNegocio($dateStart, $dateEnd, $period, $custom);

            return [
                'messages' => $this->getMessageStatistics($dateStart, $dateEnd),
                'appointments' => $this->getAppointmentStatistics($dateStart, $dateEnd),
                'conversations' => $this->getConversationStatistics($dateStart, $dateEnd),
                'templates' => $this->getTemplateStatistics($dateStart, $dateEnd),
                'costs' => $this->getCostStatistics($dateStart, $dateEnd),
                'users' => $this->getUserStatistics(),
                'advisors' => $this->getAdvisorStatistics($dateStart, $dateEnd),
                'flowDemand' => $this->getFlowDemandStatistics($dateStart, $dateEnd),
                'date_range' => $rango,
                'data_gaps' => $this->vaciosDelRango($rango),
                'generated_at' => now()->setTimezone(self::BUSINESS_TZ)->toIso8601String(),
            ];
        });
    }

    /**
     * El rango en fechas de COLOMBIA para mostrar. El fin del día colombiano (23:59 -05) es la
     * madrugada siguiente en UTC: formatear el Carbon en UTC ponía «Hasta» un día después.
     */
    private function rangoNegocio(?Carbon $dateStart, ?Carbon $dateEnd, string $period, bool $custom): array
    {
        return [
            'start' => $dateStart?->copy()->setTimezone(self::BUSINESS_TZ)->toDateString(),
            'end' => $dateEnd?->copy()->setTimezone(self::BUSINESS_TZ)->toDateString(),
            'period' => $period,
            'custom' => $custom,
        ];
    }

    /** Los huecos de datos que se cruzan con el rango (con «Todo el tiempo», todos). */
    private function vaciosDelRango(array $rango): array
    {
        return array_values(array_filter(self::VACIOS, function (array $v) use ($rango) {
            if (! $rango['start'] || ! $rango['end']) {
                return true;
            }

            return $v['from'] <= $rango['end'] && ($v['to'] === null || $v['to'] >= $rango['start']);
        }));
    }

    /**
     * Demanda del menú de bienvenida: clasifica lo que pide cada usuario.
     * Lista para informes (servicio, EPS, régimen, autoservicio vs asesor, embudo).
     */
    private function getFlowDemandStatistics(?Carbon $dateStart, ?Carbon $dateEnd): array
    {
        $base = \App\Models\FlowClassification::query();
        if ($dateStart && $dateEnd) {
            $base->whereBetween('created_at', [$dateStart, $dateEnd]);
        }

        $countsBy = fn (string $col) => (clone $base)
            ->select($col, DB::raw('count(*) as total'))
            ->whereNotNull($col)
            ->groupBy($col)
            ->pluck('total', $col)
            ->toArray();

        $topBy = fn (string $col) => (clone $base)
            ->select($col, DB::raw('count(*) as total'))
            ->whereNotNull($col)
            ->groupBy($col)->orderByDesc('total')->limit(8)
            ->get()
            ->map(fn ($r) => ['name' => $r->{$col}, 'value' => (int) $r->total])
            ->toArray();

        $byOutcome = $countsBy('outcome');
        $selfService = $byOutcome['self_service'] ?? 0;
        $advisor = $byOutcome['advisor'] ?? 0;
        $resolved = $selfService + $advisor;

        return [
            'total' => (clone $base)->count(),
            'accepted_privacy' => (clone $base)->where('accepted_privacy', true)->count(),
            'reached_menu' => (clone $base)->whereNotNull('service')->count(),
            'by_service' => $countsBy('service'),
            'by_outcome' => $byOutcome,
            'by_regimen' => $countsBy('regimen'),
            'top_eps' => $topBy('eps'),
            'top_sub_service' => $topBy('sub_service'),
            'automation_rate' => $resolved > 0 ? round($selfService / $resolved * 100, 1) : 0,
        ];
    }

    /**
     * Ventana de fechas para filtrar columnas created_at (que están en UTC).
     *
     * Los días se recortan en hora de COLOMBIA y luego se convierten a UTC, porque es
     * lo que entiende quien mira el panel: "Hoy" es el día colombiano, no el día UTC.
     *
     * Antes se usaba now()->startOfDay() (UTC) directamente: "Hoy" iba de las 19:00 de
     * ayer a las 18:59 de hoy hora local y, a partir de las 19:00, el panel se vaciaba
     * porque la ventana ya había saltado al día siguiente.
     */
    private function calculateDateRange(?string $startDate, ?string $endDate, string $period): array
    {
        $tz = self::BUSINESS_TZ;

        if ($startDate && $endDate) {
            return [
                Carbon::parse($startDate, $tz)->startOfDay()->utc(),
                Carbon::parse($endDate, $tz)->endOfDay()->utc(),
            ];
        }

        $ahora = now()->setTimezone($tz);

        return match ($period) {
            'today' => [
                $ahora->copy()->startOfDay()->utc(),
                $ahora->copy()->endOfDay()->utc(),
            ],
            'week' => [
                $ahora->copy()->startOfWeek()->utc(),
                $ahora->copy()->endOfWeek()->utc(),
            ],
            'month' => [
                $ahora->copy()->startOfMonth()->utc(),
                $ahora->copy()->endOfMonth()->utc(),
            ],
            'year' => [
                $ahora->copy()->startOfYear()->utc(),
                $ahora->copy()->endOfYear()->utc(),
            ],
            default => [null, null], // Todo el tiempo
        };
    }

    /**
     * Mensaje escrito por una PERSONA del equipo: saliente, visible, con autor, no fallido y que
     * no sea un envío masivo. «[Env_o masivo%»: el «_» cubre también los masivos de feb–mar 2026
     * guardados con la tilde dañada («Env?o»). Antes los masivos se contaban como mensajes del
     * asesor que los lanzó (miles por lote).
     */
    private function respuestaHumana($query, string $t = '')
    {
        $c = $t !== '' ? $t . '.' : '';

        return $query
            ->where($c . 'is_from_user', false)
            ->where($c . 'is_hidden', false)
            ->whereNotNull($c . 'sent_by')
            ->where(fn ($q) => $q->whereNull($c . 'status')->orWhere($c . 'status', '<>', 'failed'))
            ->where(fn ($q) => $q->whereNull($c . 'content')->orWhere($c . 'content', 'not like', '[Env_o masivo%'));
    }

    /** La misma condición en SQL crudo, para la consulta de la mediana. */
    private function respuestaHumanaSql(string $t): string
    {
        return "{$t}.is_from_user = 0 AND {$t}.is_hidden = 0 AND {$t}.sent_by IS NOT NULL"
            . " AND ({$t}.status IS NULL OR {$t}.status <> 'failed')"
            . " AND ({$t}.content IS NULL OR {$t}.content NOT LIKE '[Env_o masivo%')";
    }

    /**
     * Get message statistics - OPTIMIZADO con una sola consulta agregada
     */
    private function getMessageStatistics(?Carbon $startDate, ?Carbon $endDate): array
    {
        $botones = implode(',', array_fill(0, count(self::BOTONES), '?'));

        // Una sola consulta agregada para obtener todos los conteos
        $stats = DB::table('messages')
            ->selectRaw("
                COUNT(*) as total,
                SUM(CASE WHEN is_from_user = 0 THEN 1 ELSE 0 END) as sent_by_system,
                SUM(CASE WHEN is_from_user = 1 THEN 1 ELSE 0 END) as received_from_users,
                SUM(CASE WHEN is_from_user = 1 AND is_hidden = 0 AND LOWER(TRIM(COALESCE(content, ''))) NOT IN ({$botones}) THEN 1 ELSE 0 END) as received_written,
                SUM(CASE WHEN is_from_user = 0 AND status = 'pending' THEN 1 ELSE 0 END) as status_pending,
                SUM(CASE WHEN is_from_user = 0 AND status = 'sent' THEN 1 ELSE 0 END) as status_sent,
                SUM(CASE WHEN is_from_user = 0 AND status = 'delivered' THEN 1 ELSE 0 END) as status_delivered,
                SUM(CASE WHEN is_from_user = 0 AND status = 'read' THEN 1 ELSE 0 END) as status_read,
                SUM(CASE WHEN is_from_user = 0 AND status = 'failed' THEN 1 ELSE 0 END) as status_failed
            ", self::BOTONES);

        if ($startDate && $endDate) {
            $stats->whereBetween('created_at', [$startDate, $endDate]);
        }

        $result = $stats->first();

        $received = (int) ($result->received_from_users ?? 0);
        $written = (int) ($result->received_written ?? 0);

        return [
            'total' => (int) ($result->total ?? 0),
            'sent_by_system' => (int) ($result->sent_by_system ?? 0),
            'received_from_users' => $received,
            // Lo que el paciente escribió de verdad, sin los toques de Confirmar/Cancelar.
            'received_written' => $written,
            'button_taps' => max(0, $received - $written),
            'delivery_status' => [
                'pending' => (int) ($result->status_pending ?? 0),
                'sent' => (int) ($result->status_sent ?? 0),
                'delivered' => (int) ($result->status_delivered ?? 0),
                'read' => (int) ($result->status_read ?? 0),
                'failed' => (int) ($result->status_failed ?? 0),
            ],
        ];
    }

    /**
     * Get appointment statistics - OPTIMIZADO con consultas agregadas
     */
    private function getAppointmentStatistics(?Carbon $startDate, ?Carbon $endDate): array
    {
        $hoy = now()->setTimezone(self::BUSINESS_TZ)->toDateString();

        // Las cancelaciones se separan: las del paciente (contestó «Cancelar» al recordatorio) y las
        // que hizo el HOSPITAL al enviar la plantilla de cancelación (AppointmentCancellationSync deja
        // una nota), que no son una respuesta del paciente y pueden no tener recordatorio.
        // reminder_status nunca pasa a 'delivered' ni 'read': 'sent' es «aceptado por Meta».
        $stats = DB::table('appointments')
            ->selectRaw("
                COUNT(*) as total,
                SUM(CASE WHEN reminder_sent = 1 THEN 1 ELSE 0 END) as reminder_sent,
                SUM(CASE WHEN reminder_status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN reminder_status = 'sent' THEN 1 ELSE 0 END) as sent,
                SUM(CASE WHEN reminder_status = 'sent' AND reminder_sent = 1 THEN 1 ELSE 0 END) as awaiting,
                SUM(CASE WHEN reminder_status = 'failed' THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN reminder_status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_all,
                SUM(CASE WHEN reminder_status = 'confirmed' AND reminder_sent = 1 THEN 1 ELSE 0 END) as confirmed,
                SUM(CASE WHEN reminder_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_all,
                SUM(CASE WHEN reminder_status = 'cancelled' AND notes LIKE ? THEN 1 ELSE 0 END) as cancelled_hospital,
                SUM(CASE WHEN reminder_status = 'cancelled' AND reminder_sent = 1 AND (notes IS NULL OR notes NOT LIKE ?) THEN 1 ELSE 0 END) as cancelled_patient,
                SUM(CASE WHEN citfc > ? THEN 1 ELSE 0 END) as future
            ", [self::NOTA_CANCELADA_HOSPITAL, self::NOTA_CANCELADA_HOSPITAL, $hoy]);

        // Se filtra por citfc (FECHA DE LA CITA), no por created_at: las citas se insertan
        // con DB::table()->insert(), que se salta los timestamps de Eloquent, así que
        // created_at es NULL en las 105.000 filas y whereBetween sobre ella no casaba
        // NUNCA — cualquier periodo distinto de "todo el tiempo" devolvía 0 citas.
        //
        // citfc es de tipo DATE y está en hora de Colombia, mientras que el rango llega
        // en UTC; se convierte de vuelta a la zona del negocio para comparar días con días.
        if ($startDate && $endDate) {
            $stats->whereBetween('citfc', [
                $startDate->copy()->setTimezone(self::BUSINESS_TZ)->toDateString(),
                $endDate->copy()->setTimezone(self::BUSINESS_TZ)->toDateString(),
            ]);
        }

        $r = $stats->first();
        $n = fn (string $k) => (int) ($r->{$k} ?? 0);

        $confirmed = $n('confirmed');
        $cancelledPatient = $n('cancelled_patient');
        $cancelledHospital = $n('cancelled_hospital');
        $awaiting = $n('awaiting');

        return [
            'total' => $n('total'),
            'reminder_sent' => $n('reminder_sent'),
            'confirmed' => $confirmed,
            'cancelled_by_patient' => $cancelledPatient,
            'cancelled_by_hospital' => $cancelledHospital,
            'cancelled' => $cancelledPatient + $cancelledHospital,
            // Recordatorio enviado (aceptado por Meta) y el paciente todavía no ha contestado.
            'awaiting_reply' => $awaiting,
            // Base del anillo «Respuesta de pacientes»: el centro es la suma de su leyenda.
            'with_reminder_base' => $confirmed + $cancelledPatient + $awaiting,
            'pending' => $n('pending'),
            'failed' => $n('failed'),
            // Citas del total con fecha posterior a hoy (los periodos en curso cuentan el periodo completo).
            'future' => $n('future'),
            'by_status' => [
                'pending' => $n('pending'),
                'sent' => $n('sent'),
                'failed' => $n('failed'),
                'confirmed' => $n('confirmed_all'),
                'cancelled' => $n('cancelled_all'),
            ],
        ];
    }

    /**
     * Get conversation statistics - OPTIMIZADO con consultas agregadas
     *
     * Ojo: hay UNA conversación por número de teléfono, así que created_at es la primera vez que
     * ese número habló con el hospital, y el estado que se cuenta es el de AHORA.
     */
    private function getConversationStatistics(?Carbon $startDate, ?Carbon $endDate): array
    {
        // Una sola consulta para todos los conteos
        $stats = DB::table('conversations')
            ->selectRaw("
                COUNT(*) as total,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
                SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed,
                SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
                SUM(CASE WHEN unread_count > 0 THEN 1 ELSE 0 END) as unread
            ");

        if ($startDate && $endDate) {
            $stats->whereBetween('created_at', [$startDate, $endDate]);
        }

        $result = $stats->first();

        return [
            'total' => (int) ($result->total ?? 0),
            'active' => (int) ($result->active ?? 0),
            'pending' => (int) ($result->pending ?? 0),
            'in_progress' => (int) ($result->in_progress ?? 0),
            'resolved' => (int) ($result->resolved ?? 0),
            'closed' => (int) ($result->closed ?? 0),
            'scheduled' => (int) ($result->scheduled ?? 0),
            'unread' => (int) ($result->unread ?? 0),
        ];
    }

    /**
     * Get template statistics - OPTIMIZADO
     */
    private function getTemplateStatistics(?Carbon $startDate, ?Carbon $endDate): array
    {
        // Los envíos salen de bulk_send_recipients, no de template_sends.
        //
        // template_sends la llena TemplateSendService (pantalla "enviar plantilla"), que
        // nunca se ha usado: 0 filas, así que el panel mostraba siempre "0 envíos". Los
        // envíos de plantillas que SÍ ocurren son los masivos, y los 94 lotes existentes
        // llevan todos template_name. Esta tabla además tiene created_at, así que respeta
        // el filtro de fechas (templates.usage_count no serviría: es un contador acumulado).
        // Ojo: NO incluye los recordatorios de citas ni las plantillas enviadas desde el chat.
        $stats = DB::table('bulk_send_recipients')
            ->selectRaw("
                SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as successful_sends,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_sends
            ");

        if ($startDate && $endDate) {
            $stats->whereBetween('created_at', [$startDate, $endDate]);
        }

        $result = $stats->first();

        $successfulSends = (int) ($result->successful_sends ?? 0);
        $failedSends = (int) ($result->failed_sends ?? 0);

        return [
            // Respuestas rápidas del chat (Template), no las plantillas de Meta.
            'total' => Template::count(),
            'successful_sends' => $successfulSends,
            'failed_sends' => $failedSends,
            'total_sends' => $successfulSends + $failedSends,
        ];
    }

    /**
     * Estima el costo del API de WhatsApp (Meta) del período.
     *
     * Meta cobra por mensaje de plantilla entregado según su categoría; los datos
     * reales (categoría facturada y si fue facturable) llegan por webhook y se
     * guardan en messages.pricing_category / messages.billable. Aquí se agregan y
     * se multiplican por el rate card de config/whatsapp.php.
     *
     * Es una ESTIMACIÓN: solo cubre mensajes con datos de facturación (los
     * enviados después de activar esta medición). El cobro real vive en Meta.
     */
    private function getCostStatistics(?Carbon $startDate, ?Carbon $endDate): array
    {
        $rates = (array) config('whatsapp.billing.rates', []);
        $currency = (string) config('whatsapp.billing.currency', 'USD');
        $ratesAsOf = (string) config('whatsapp.billing.rates_as_of', '');

        // Base: mensajes salientes (los que Meta puede cobrar) del período.
        //
        // Se excluyen los que acabaron en 'failed': Meta manda el objeto de precio en el
        // callback 'sent' y luego, si el mensaje resulta no entregable, llega un 'failed'
        // que no limpia billable. Esos no se cobran, pero aquí se sumaban igual.
        $base = DB::table('messages')
            ->where('is_from_user', 0)
            ->where(fn ($q) => $q->where('status', '<>', 'failed')->orWhereNull('status'));
        if ($startDate && $endDate) {
            $base->whereBetween('created_at', [$startDate, $endDate]);
        }

        // Conteos agregados por categoría facturada y si Meta lo marcó facturable.
        $rows = (clone $base)
            ->whereNotNull('pricing_category')
            ->selectRaw('pricing_category, billable, COUNT(*) as cnt')
            ->groupBy('pricing_category', 'billable')
            ->get();

        // Estructura por categoría, en orden fijo para el frontend.
        $byCategory = [];
        foreach (['marketing', 'utility', 'authentication', 'service'] as $cat) {
            $byCategory[$cat] = [
                'billable' => 0,
                'free' => 0,
                'rate' => (float) ($rates[$cat] ?? 0),
                'cost' => 0.0,
            ];
        }

        $billableTotal = 0;
        $freeTotal = 0;
        // Con categoría pero sin el dato «facturable» (billable NULL): antes se sumaban como gratis y
        // el costo podía caer a 0 en silencio. Ahora cuentan como «sin dato de cobro».
        $unconfirmed = 0;
        foreach ($rows as $r) {
            $cat = $r->pricing_category;
            if (! isset($byCategory[$cat])) {
                $byCategory[$cat] = ['billable' => 0, 'free' => 0, 'rate' => (float) ($rates[$cat] ?? 0), 'cost' => 0.0];
            }
            $cnt = (int) $r->cnt;
            if ($r->billable === null) {
                $unconfirmed += $cnt;
            } elseif ((int) $r->billable === 1) {
                $byCategory[$cat]['billable'] += $cnt;
                $billableTotal += $cnt;
            } else {
                $byCategory[$cat]['free'] += $cnt;
                $freeTotal += $cnt;
            }
        }

        $totalCost = 0.0;
        $sinTarifa = 0;
        foreach ($byCategory as $cat => $data) {
            $cost = round($data['billable'] * $data['rate'], 2);
            $byCategory[$cat]['cost'] = $cost;
            $totalCost += $cost;

            // Si Meta estrena una categoría que no está en config/whatsapp.php, su tarifa
            // es 0 y aportaría 0 USD sin avisar. Se cuenta para poder advertirlo.
            if ($data['rate'] <= 0 && $data['billable'] > 0) {
                $sinTarifa += $data['billable'];
            }
        }

        // Cobertura: qué porción de los salientes tiene el dato de cobro de Meta.
        $outbound = (int) (clone $base)->count();
        $withPricing = $billableTotal + $freeTotal;

        // Evolución diaria del coste dentro del período. Se agrupa por día en hora de
        // Colombia (created_at está en UTC); el frontend suma por mes cuando el usuario
        // lo pide y rellena los días sin datos. Solo facturables: los gratuitos no mueven el
        // coste y ensuciarían las barras.
        $series = [];
        $porDia = (clone $base)
            ->where('billable', 1)
            ->whereNotNull('pricing_category')
            ->selectRaw("DATE(CONVERT_TZ(created_at, '+00:00', '-05:00')) AS dia, pricing_category, COUNT(*) AS cnt")
            ->groupBy('dia', 'pricing_category')
            ->orderBy('dia')
            ->get();
        foreach ($porDia as $r) {
            $dia = (string) $r->dia;
            $series[$dia] ??= ['day' => $dia, 'billable' => 0, 'cost' => 0.0];
            $series[$dia]['billable'] += (int) $r->cnt;
            $series[$dia]['cost'] += (int) $r->cnt * (float) ($rates[$r->pricing_category] ?? 0);
        }
        foreach ($series as &$s) {
            $s['cost'] = round($s['cost'], 2);
        }
        unset($s);

        return [
            'currency' => $currency,
            'rates_as_of' => $ratesAsOf,
            'by_category' => $byCategory,
            'series' => array_values($series),
            'total_cost' => round($totalCost, 2),
            'billable_total' => $billableTotal,
            'free_total' => $freeTotal,
            'outbound_total' => $outbound,
            'with_pricing' => $withPricing,
            'without_pricing' => max(0, $outbound - $withPricing),
            'unconfirmed' => $unconfirmed,
            'coverage_percent' => $outbound > 0 ? round($withPricing / $outbound * 100, 1) : 0,
            'billable_without_rate' => $sinTarifa,
        ];
    }

    /**
     * Get user statistics - OPTIMIZADO con una sola consulta
     */
    private function getUserStatistics(): array
    {
        $stats = DB::table('users')
            ->selectRaw("
                COUNT(*) as total,
                SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
                SUM(CASE WHEN role = 'advisor' THEN 1 ELSE 0 END) as advisors
            ")
            ->first();

        $admins = (int) ($stats->admins ?? 0);
        $advisors = (int) ($stats->advisors ?? 0);

        return [
            'total' => (int) ($stats->total ?? 0),
            'admins' => $admins,
            'advisors' => $advisors,
            // Personas del equipo (sin el usuario de IA ni otros roles técnicos).
            'team_total' => $admins + $advisors,
        ];
    }

    /**
     * Get advisor performance statistics - CORREGIDO para contar mensajes independientemente de la asignación actual
     */
    private function getAdvisorStatistics(?Carbon $startDate, ?Carbon $endDate): array
    {
        // Obtener todos los asesores
        $advisors = User::where('role', 'advisor')->get();

        // Trabajo REAL del período, del historial de cada conversación (ver trabajoAsesores()).
        $trabajo = $this->trabajoAsesores($startDate, $endDate);

        // Solo lo que escribió la persona: sin envíos masivos, ocultos ni fallidos.
        $msgAgg = $this->respuestaHumana(DB::table('messages'))
            ->selectRaw('sent_by, COUNT(*) AS sent')
            ->when($startDate && $endDate, fn ($q) => $q->whereBetween('created_at', [$startDate, $endDate]))
            ->groupBy('sent_by')
            ->pluck('sent', 'sent_by');

        $liberadas = $this->liberadasPorInactividad($startDate, $endDate);

        $advisorStats = $advisors->map(function ($advisor) use ($trabajo, $msgAgg, $liberadas) {
            $c = $trabajo[$advisor->id] ?? [];

            $totalConversations = (int) ($c['atendidas'] ?? 0);
            $resolvedConversations = (int) ($c['resueltas'] ?? 0);

            // null (no 0) cuando no atendió ninguna: "sin datos" y "resolvió el 0%" son cosas
            // distintas, y el frontend pintaba de rojo (bajo rendimiento) a quien no tenía carga.
            $resolutionRate = $totalConversations > 0
                ? round(($resolvedConversations * 100.0) / $totalConversations, 2)
                : null;

            return [
                'id' => $advisor->id,
                'name' => $advisor->name,
                // Atendidas en el período: las que tomó, le asignaron, en las que escribió o que resolvió.
                'total_conversations' => $totalConversations,
                // Resueltas y agendadas POR ÉL en el período.
                'resolved_conversations' => $resolvedConversations,
                'scheduled_conversations' => (int) ($c['agendadas'] ?? 0),
                // Foto de ahora (no dependen del período).
                'active_conversations' => (int) ($c['activas'] ?? 0),
                'conversations_with_unread' => (int) ($c['sin_leer'] ?? 0),
                'messages_sent' => (int) ($msgAgg[$advisor->id] ?? 0),
                'resolution_rate' => $resolutionRate,
                // Conversaciones que se le quitaron por no responder a tiempo (Configuración →
                // Liberación automática) en el período.
                'released_inactive' => (int) ($liberadas[$advisor->id] ?? 0),
            ];
        })->sortByDesc('resolved_conversations')->values()->toArray();

        $totalConversations = array_sum(array_column($advisorStats, 'total_conversations'));
        $totalResolved = array_sum(array_column($advisorStats, 'resolved_conversations'));

        // Tasa PONDERADA por volumen: resueltas / atendidas sobre el total real.
        //
        // Antes era la media aritmética de los porcentajes individuales dividida entre
        // TODOS los asesores, incluidos los que no tienen ninguna conversación (que
        // aportaban 0%). Con 10 de 27 asesores sin carga, el panel mostraba 62,12%
        // cuando el equipo resuelve de verdad el 91,03%. null si no hay conversaciones.
        $avgResolutionRate = $totalConversations > 0
            ? round(($totalResolved * 100.0) / $totalConversations, 2)
            : null;

        // «Más conversaciones resueltas»: solo si alguien resolvió algo y no hay empate en el máximo
        // (antes nombraba a un asesor cualquiera con 0 resueltas).
        $maximo = $advisorStats[0]['resolved_conversations'] ?? 0;
        $empatados = count(array_filter($advisorStats, fn ($a) => $a['resolved_conversations'] === $maximo));
        $topAdvisor = $maximo > 0 && $empatados === 1 ? $advisorStats[0] : null;

        return [
            'total_advisors' => count($advisorStats),
            'total_conversations' => $totalConversations,
            'total_resolved' => $totalResolved,
            'total_scheduled' => array_sum(array_column($advisorStats, 'scheduled_conversations')),
            'total_active' => array_sum(array_column($advisorStats, 'active_conversations')),
            'total_with_unread' => array_sum(array_column($advisorStats, 'conversations_with_unread')),
            'total_messages_sent' => array_sum(array_column($advisorStats, 'messages_sent')),
            'avg_resolution_rate' => $avgResolutionRate,
            // Suma de la tabla, como las demás cifras del bloque (no incluye administradores ni
            // usuarios borrados, que no tienen fila).
            'total_released_inactive' => array_sum(array_column($advisorStats, 'released_inactive')),
            // Con la función apagada, un 0 en «Liberadas» no significa nada: la pantalla lo dice.
            'auto_release_enabled' => (bool) (InactiveConversationReleaser::settings()['enabled'] ?? false),
            'top_performer' => $topAdvisor,
            'advisors' => $advisorStats,
        ];
    }

    /**
     * Trabajo REAL de cada asesor en el período, por id: atendidas, resueltas, agendadas (del
     * período) y activas, pendientes y con mensajes sin leer (foto de ahora).
     *
     * Antes se contaban las conversaciones CREADAS en el período con su asesor y estado de HOY. Como
     * hay una conversación por teléfono, eso eran «contactos nuevos»; y cuando un paciente volvía a
     * escribir, la conversación quedaba sin asesor y quien la había resuelto perdía el crédito. Con
     * «Este mes», quien atendió a pacientes antiguos salía con 0.
     *
     * Ahora, del historial (conversation_activities, desde el 31-03-2026) y de los mensajes:
     *  - atendidas: conversaciones que tomó (auto_assigned), que le asignaron (assigned →
     *    metadata.assigned_to), en las que escribió una respuesta (sin masivos) o que resolvió;
     *  - resueltas: las que él marcó como resueltas (type resolved, user_id = él);
     *  - agendadas: las que él pasó a «Agendado» (status_changed con new_status scheduled).
     * Cada conversación cuenta una vez por asesor, así que la resolución nunca pasa del 100 %.
     *
     * @return array<int, array{atendidas:int, resueltas:int, agendadas:int, activas:int, pendientes:int, sin_leer:int}>
     */
    private function trabajoAsesores(?Carbon $startDate, ?Carbon $endDate, ?int $userId = null): array
    {
        $rango = fn (string $col) => $startDate && $endDate ? " AND {$col} BETWEEN ? AND ?" : '';
        $fechas = $startDate && $endDate ? [$startDate, $endDate] : [];
        $soloUno = fn (string $col) => $userId ? " AND {$col} = ?" : '';
        $uno = $userId ? [$userId] : [];

        $asignadoA = "(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.assigned_to')) + 0)";

        $atendidas = DB::select("
            SELECT uid, COUNT(DISTINCT cid) AS n FROM (
                SELECT user_id AS uid, conversation_id AS cid FROM conversation_activities
                WHERE type IN ('auto_assigned', 'resolved') AND user_id IS NOT NULL" . $rango('created_at') . $soloUno('user_id') . "
                UNION ALL
                SELECT {$asignadoA} AS uid, conversation_id AS cid FROM conversation_activities
                WHERE type = 'assigned'" . $rango('created_at') . $soloUno($asignadoA) . "
                UNION ALL
                SELECT sent_by AS uid, conversation_id AS cid FROM messages m
                WHERE " . $this->respuestaHumanaSql('m') . $rango('m.created_at') . $soloUno('m.sent_by') . "
            ) trabajo
            WHERE uid IS NOT NULL
            GROUP BY uid
        ", array_merge($fechas, $uno, $fechas, $uno, $fechas, $uno));

        $porTipo = function (string $condicion) use ($rango, $fechas, $soloUno, $uno) {
            return collect(DB::select("
                SELECT user_id AS uid, COUNT(DISTINCT conversation_id) AS n FROM conversation_activities
                WHERE user_id IS NOT NULL AND {$condicion}" . $rango('created_at') . $soloUno('user_id') . "
                GROUP BY user_id
            ", array_merge($fechas, $uno)))->pluck('n', 'uid');
        };

        $resueltas = $porTipo("type = 'resolved'");
        $agendadas = $porTipo("type = 'status_changed' AND metadata LIKE '%\"new_status\":\"scheduled\"%'");

        // Foto de ahora: lo que tiene asignado en este momento.
        $ahora = DB::table('conversations')
            ->whereNotNull('assigned_to')
            ->when($userId, fn ($q) => $q->where('assigned_to', $userId))
            ->selectRaw("
                assigned_to AS uid,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS activas,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pendientes,
                SUM(CASE WHEN unread_count > 0 THEN 1 ELSE 0 END) AS sin_leer
            ")
            ->groupBy('assigned_to')
            ->get()
            ->keyBy('uid');

        $ids = collect($atendidas)->pluck('uid')->merge($ahora->keys())->map(fn ($id) => (int) $id)->unique();
        $atendidasPorId = collect($atendidas)->pluck('n', 'uid');

        $resultado = [];
        foreach ($ids as $id) {
            $a = $ahora->get($id);
            $resultado[$id] = [
                'atendidas' => (int) ($atendidasPorId[$id] ?? 0),
                'resueltas' => (int) ($resueltas[$id] ?? 0),
                'agendadas' => (int) ($agendadas[$id] ?? 0),
                'activas' => (int) ($a->activas ?? 0),
                'pendientes' => (int) ($a->pendientes ?? 0),
                'sin_leer' => (int) ($a->sin_leer ?? 0),
            ];
        }

        return $resultado;
    }

    /**
     * Liberaciones automáticas por inactividad en el periodo, por asesor: [user_id => n].
     *
     * Salen del historial de cada conversación (conversation_activities, type 'unassigned' con
     * reason 'auto_release', ver InactiveConversationReleaser) y se fechan por el momento de
     * la liberación, no por la creación de la conversación. Una sola consulta agrupada.
     *
     * @return array<int, int>
     */
    private function liberadasPorInactividad(?Carbon $startDate, ?Carbon $endDate, ?int $userId = null): array
    {
        return DB::table('conversation_activities')
            ->where('type', 'unassigned')
            ->where('metadata', 'like', '%"reason":"auto_release"%')
            ->when($startDate && $endDate, fn ($q) => $q->whereBetween('created_at', [$startDate, $endDate]))
            ->when($userId, fn ($q) => $q->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.released_from_id')) = ?", [(string) $userId]))
            ->selectRaw("JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.released_from_id')) AS asesor, COUNT(*) AS n")
            ->groupBy('asesor')
            ->pluck('n', 'asesor')
            ->mapWithKeys(fn ($n, $asesor) => [(int) $asesor => (int) $n])
            ->all();
    }

    /**
     * Get detailed statistics for a specific advisor
     */
    public function advisorDetail(Request $request, User $user)
    {
        [$period, $startDate, $endDate] = $this->filtros($request);
        [$dateStart, $dateEnd] = $this->calculateDateRange($startDate, $endDate, $period);
        $custom = $startDate !== null && $endDate !== null;

        $cacheKey = 'statistics_asesor_v3_' . $user->id . '_' . md5(serialize([$dateStart?->toIso8601String(), $dateEnd?->toIso8601String(), $period, $custom]));

        return response()->json(Cache::remember($cacheKey, 300, function () use ($user, $dateStart, $dateEnd, $period, $custom) {
            $enRango = fn ($q) => $q->when($dateStart && $dateEnd, fn ($q) => $q->whereBetween('created_at', [$dateStart, $dateEnd]));

            // Solo lo que escribió la persona (sin masivos, ocultos ni fallidos).
            $humanos = fn () => $enRango($this->respuestaHumana(DB::table('messages'))->where('sent_by', $user->id));

            $messagesSent = $humanos()->count();

            // Las mismas definiciones que la fila de la tabla: trabajo del período + foto de ahora.
            $trabajo = $this->trabajoAsesores($dateStart, $dateEnd, $user->id)[$user->id] ?? [];

            $totalConversations = (int) ($trabajo['atendidas'] ?? 0);
            $resolvedConversations = (int) ($trabajo['resueltas'] ?? 0);

            [$medianResponseTime, $waitsOver24h] = $this->calculateMedianResponseTime($user->id, $dateStart, $dateEnd);

            // Distribución por hora, en hora de Colombia (created_at está en UTC).
            $hourlyDistribution = $humanos()
                ->selectRaw("HOUR(CONVERT_TZ(created_at, '+00:00', '-05:00')) as hour, COUNT(*) as count")
                ->groupBy('hour')
                ->orderBy('hour')
                ->pluck('count', 'hour')
                ->toArray();

            $hourly = [];
            for ($h = 0; $h < 24; $h++) {
                $hourly[] = [
                    'hour' => sprintf('%02d:00', $h),
                    'count' => (int) ($hourlyDistribution[$h] ?? 0),
                ];
            }

            $messageTypes = $humanos()
                ->selectRaw('message_type, COUNT(*) as count')
                ->groupBy('message_type')
                ->pluck('count', 'message_type')
                ->map(fn ($n) => (int) $n)
                ->toArray();

            return [
                'advisor' => [
                    'id' => $user->id,
                    'name' => $user->name,
                ],
                'date_range' => $this->rangoNegocio($dateStart, $dateEnd, $period, $custom),
                'summary' => [
                    'messages_sent' => $messagesSent,
                    'total_conversations' => $totalConversations,
                    'resolved_conversations' => $resolvedConversations,
                    'scheduled_conversations' => (int) ($trabajo['agendadas'] ?? 0),
                    'active_conversations' => (int) ($trabajo['activas'] ?? 0),
                    'pending_conversations' => (int) ($trabajo['pendientes'] ?? 0),
                    // null (no 0) sin conversaciones: «Sin datos», igual que en la tabla.
                    'resolution_rate' => $totalConversations > 0
                        ? round(($resolvedConversations * 100.0) / $totalConversations, 2)
                        : null,
                    'median_response_time_minutes' => $medianResponseTime,
                    'waits_over_24h' => $waitsOver24h,
                    'released_inactive' => $this->liberadasPorInactividad($dateStart, $dateEnd, $user->id)[$user->id] ?? 0,
                ],
                'daily_activity' => $this->getDailyActivity($user->id, $dateStart, $dateEnd),
                'hourly_distribution' => $hourly,
                'message_types' => $messageTypes,
            ];
        }));
    }

    /**
     * Tiempo de respuesta TÍPICO (mediana), en minutos, de un asesor, y cuántas esperas pasaron de 24 h.
     *
     * Se usa la mediana y no la media porque la distribución tiene una cola muy larga:
     * medido sobre datos reales, una asesora con mediana de 24 min (y un 30% de respuestas
     * en menos de 5 min) salía con una media de 3h52m por culpa del 10% de casos que
     * tardan más de 16 h. La media hacía parecer al equipo diez veces más lento de lo que es.
     *
     * Se empareja POR RESPUESTA DEL ASESOR, no por mensaje del paciente: para cada respuesta se mide
     * desde que el paciente empezó a esperar, es decir, su primer mensaje visible posterior a la
     * última respuesta de una PERSONA en esa conversación. Cada respuesta cuenta una sola vez.
     *
     * Cambios (oct 2026): el reloj ya no se reinicia con avisos automáticos (fin de semana, respuestas
     * de cita, bot, recordatorios, masivos), que dejaban fuera justo las esperas largas; la hora del
     * paciente es la real de WhatsApp (wa_sent_at) cuando existe; y ya no se descartan las esperas de
     * más de 24 h (la mediana ya aguanta la cola larga; se informa cuántas fueron).
     *
     * @return array{0: ?float, 1: int}
     */
    private function calculateMedianResponseTime(int $advisorId, ?Carbon $dateStart, ?Carbon $dateEnd): array
    {
        $paciente = 'COALESCE(u.wa_sent_at, u.created_at)';
        $diferencia = DB::getDriverName() === 'sqlite'
            ? "CAST((julianday(a.created_at) - julianday(%s)) * 86400 AS INTEGER)"
            : "TIMESTAMPDIFF(SECOND, %s, a.created_at)";

        $esperaDesde = "(
            SELECT MIN({$paciente}) FROM messages u
            WHERE u.conversation_id = a.conversation_id
              AND u.is_from_user = 1
              AND u.is_hidden = 0
              AND {$paciente} < a.created_at
              AND {$paciente} > COALESCE((
                  SELECT MAX(p.created_at) FROM messages p
                  WHERE p.conversation_id = a.conversation_id
                    AND p.created_at < a.created_at
                    AND " . $this->respuestaHumanaSql('p') . "
              ), '1970-01-01 00:00:00')
        )";

        $responseTimes = DB::select("
            SELECT response_seconds FROM (
                SELECT " . sprintf($diferencia, $esperaDesde) . " AS response_seconds
                FROM messages a
                WHERE " . $this->respuestaHumanaSql('a') . "
                  AND a.sent_by = ?
                  " . ($dateStart && $dateEnd ? 'AND a.created_at BETWEEN ? AND ?' : '') . "
            ) response_data
            WHERE response_seconds IS NOT NULL AND response_seconds >= 0
            ORDER BY response_seconds
        ", array_merge(
            [$advisorId],
            $dateStart && $dateEnd ? [$dateStart, $dateEnd] : []
        ));

        $segundos = array_map('floatval', array_column($responseTimes, 'response_seconds'));
        $n = count($segundos);

        if ($n === 0) {
            return [null, 0];
        }

        // Vienen ya ordenados por la consulta.
        $medio = intdiv($n, 2);
        $mediana = $n % 2 === 1
            ? $segundos[$medio]
            : ($segundos[$medio - 1] + $segundos[$medio]) / 2;

        $mas24h = count(array_filter($segundos, fn ($s) => $s > 86400));

        return [round($mediana / 60, 1), $mas24h];
    }

    /**
     * Mensajes escritos por día de un asesor, en días de COLOMBIA (antes eran días UTC: lo enviado
     * de 19:00 a 23:59 caía en el día siguiente y «Hoy» salía con dos barras). Sin rango: los
     * últimos 7 días. Nunca se pintan días futuros. La etiqueta la arma la pantalla con su idioma.
     */
    private function getDailyActivity(int $advisorId, ?Carbon $dateStart, ?Carbon $dateEnd): array
    {
        $tz = self::BUSINESS_TZ;
        $hoy = now()->setTimezone($tz)->startOfDay();

        $desde = ($dateStart ? $dateStart->copy()->setTimezone($tz) : $hoy->copy()->subDays(6))->startOfDay();
        $hasta = ($dateEnd ? $dateEnd->copy()->setTimezone($tz) : $hoy->copy())->startOfDay();
        if ($hasta->greaterThan($hoy)) {
            $hasta = $hoy->copy();
        }

        $daily = $this->respuestaHumana(DB::table('messages'))
            ->where('sent_by', $advisorId)
            ->whereBetween('created_at', [$desde->copy()->utc(), $hasta->copy()->endOfDay()->utc()])
            ->selectRaw("DATE(CONVERT_TZ(created_at, '+00:00', '-05:00')) as date, COUNT(*) as count")
            ->groupBy('date')
            ->orderBy('date')
            ->pluck('count', 'date')
            ->toArray();

        $result = [];
        for ($dia = $desde->copy(); $dia->lte($hasta); $dia->addDay()) {
            $fecha = $dia->toDateString();
            $result[] = [
                'date' => $fecha,
                'count' => (int) ($daily[$fecha] ?? 0),
            ];
        }

        return $result;
    }
}
