<?php

namespace App\Http\Controllers\Admin;

use App\Exports\StatisticsExport;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Template;
use App\Models\TemplateSend;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class StatisticsController extends Controller
{
    /**
     * Display statistics page
     */
    public function index(Request $request)
    {
        $startDate = $request->get('start_date');
        $endDate = $request->get('end_date');
        $period = $request->get('period', 'all');

        // Calcular fechas según el período seleccionado
        [$dateStart, $dateEnd] = $this->calculateDateRange($startDate, $endDate, $period);

        // Generar clave de caché única basada en los parámetros
        $cacheKey = 'statistics_' . md5(serialize([
            'start' => $dateStart?->format('Y-m-d'),
            'end' => $dateEnd?->format('Y-m-d'),
            'period' => $period,
        ]));

        // El layout (sidebar/topbar) y el cascarón de la página se entregan de inmediato.
        // Las 6 agregaciones pesadas se DIFIEREN (Inertia v2 deferred props): viajan en
        // una segunda petición automática y el frontend muestra un skeleton mientras tanto.
        // Así el time-to-first-paint de la página ya no queda bloqueado por las consultas.
        return Inertia::render('admin/statistics/index', [
            'statistics' => Inertia::defer(function () use ($dateStart, $dateEnd, $period, $cacheKey) {
                // Cachear estadísticas por 5 minutos para mejorar rendimiento
                return Cache::remember($cacheKey, 300, function () use ($dateStart, $dateEnd, $period) {
                    return [
                        'messages' => $this->getMessageStatistics($dateStart, $dateEnd),
                        'appointments' => $this->getAppointmentStatistics($dateStart, $dateEnd),
                        'conversations' => $this->getConversationStatistics($dateStart, $dateEnd),
                        'templates' => $this->getTemplateStatistics($dateStart, $dateEnd),
                        'costs' => $this->getCostStatistics($dateStart, $dateEnd),
                        'users' => $this->getUserStatistics(),
                        'advisors' => $this->getAdvisorStatistics($dateStart, $dateEnd),
                        'flowDemand' => $this->getFlowDemandStatistics($dateStart, $dateEnd),
                        'date_range' => [
                            'start' => $dateStart?->format('Y-m-d'),
                            'end' => $dateEnd?->format('Y-m-d'),
                            'period' => $period,
                        ],
                    ];
                });
            }),
        ]);
    }

    /**
     * Demanda del menú de bienvenida: clasifica lo que pide cada usuario.
     * Lista para informes (servicio, EPS, régimen, autoservicio vs asesor, embudo).
     */
    private function getFlowDemandStatistics(?\Carbon\Carbon $dateStart, ?\Carbon\Carbon $dateEnd): array
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
     * Calculate date range based on period or custom dates
     */
    /**
     * Zona horaria del negocio. La app corre en UTC y las marcas de tiempo se guardan
     * en UTC, pero el hospital opera en Colombia (UTC-5).
     */
    private const BUSINESS_TZ = 'America/Bogota';

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
                \Carbon\Carbon::parse($startDate, $tz)->startOfDay()->utc(),
                \Carbon\Carbon::parse($endDate, $tz)->endOfDay()->utc(),
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
     * Get message statistics - OPTIMIZADO con una sola consulta agregada
     */
    private function getMessageStatistics(?\Carbon\Carbon $startDate, ?\Carbon\Carbon $endDate): array
    {
        // Una sola consulta agregada para obtener todos los conteos
        $stats = DB::table('messages')
            ->selectRaw('
                COUNT(*) as total,
                SUM(CASE WHEN is_from_user = 0 THEN 1 ELSE 0 END) as sent_by_system,
                SUM(CASE WHEN is_from_user = 1 THEN 1 ELSE 0 END) as received_from_users,
                SUM(CASE WHEN is_from_user = 0 AND status = "pending" THEN 1 ELSE 0 END) as status_pending,
                SUM(CASE WHEN is_from_user = 0 AND status = "sent" THEN 1 ELSE 0 END) as status_sent,
                SUM(CASE WHEN is_from_user = 0 AND status = "delivered" THEN 1 ELSE 0 END) as status_delivered,
                SUM(CASE WHEN is_from_user = 0 AND status = "read" THEN 1 ELSE 0 END) as status_read,
                SUM(CASE WHEN is_from_user = 0 AND status = "failed" THEN 1 ELSE 0 END) as status_failed
            ');

        if ($startDate && $endDate) {
            $stats->whereBetween('created_at', [$startDate, $endDate]);
        }

        $result = $stats->first();

        $statusPending = (int) ($result->status_pending ?? 0);
        $statusSent = (int) ($result->status_sent ?? 0);
        $statusDelivered = (int) ($result->status_delivered ?? 0);
        $statusRead = (int) ($result->status_read ?? 0);
        $statusFailed = (int) ($result->status_failed ?? 0);

        return [
            'total' => (int) ($result->total ?? 0),
            'sent_by_system' => (int) ($result->sent_by_system ?? 0),
            'received_from_users' => (int) ($result->received_from_users ?? 0),
            'delivery_status' => [
                'pending' => $statusPending,
                'sent' => $statusSent,
                'delivered' => $statusDelivered,
                'read' => $statusRead,
                'failed' => $statusFailed,
            ],
        ];
    }

    /**
     * Get appointment statistics - OPTIMIZADO con consultas agregadas
     */
    private function getAppointmentStatistics(?\Carbon\Carbon $startDate, ?\Carbon\Carbon $endDate): array
    {
        // Obtener todo en una sola consulta agregada
        $stats = DB::table('appointments')
            ->selectRaw('
                COUNT(*) as total,
                SUM(CASE WHEN reminder_sent = 1 THEN 1 ELSE 0 END) as reminder_sent,
                SUM(CASE WHEN reminder_status = "pending" THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN reminder_status = "sent" THEN 1 ELSE 0 END) as sent,
                SUM(CASE WHEN reminder_status = "delivered" THEN 1 ELSE 0 END) as delivered,
                SUM(CASE WHEN reminder_status = "read" THEN 1 ELSE 0 END) as read_status,
                SUM(CASE WHEN reminder_status = "failed" THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN reminder_status = "confirmed" THEN 1 ELSE 0 END) as confirmed,
                SUM(CASE WHEN reminder_status = "cancelled" THEN 1 ELSE 0 END) as cancelled
            ');
        
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

        $result = $stats->first();

        $byStatus = [
            'pending' => (int) ($result->pending ?? 0),
            'sent' => (int) ($result->sent ?? 0),
            'delivered' => (int) ($result->delivered ?? 0),
            'read' => (int) ($result->read_status ?? 0),
            'failed' => (int) ($result->failed ?? 0),
            'confirmed' => (int) ($result->confirmed ?? 0),
            'cancelled' => (int) ($result->cancelled ?? 0),
        ];

        return [
            'total' => (int) ($result->total ?? 0),
            'reminder_sent' => (int) ($result->reminder_sent ?? 0),
            'confirmed' => $byStatus['confirmed'],
            'cancelled' => $byStatus['cancelled'],
            'pending' => $byStatus['pending'],
            'failed' => $byStatus['failed'],
            // Recordatorio entregado y el paciente todavía no ha contestado.
            // confirmed + cancelled + awaiting_reply = reminder_sent.
            'awaiting_reply' => $byStatus['sent'] + $byStatus['delivered'] + $byStatus['read'],
            'by_status' => $byStatus,
        ];
    }

    /**
     * Get conversation statistics - OPTIMIZADO con consultas agregadas
     */
    private function getConversationStatistics(?\Carbon\Carbon $startDate, ?\Carbon\Carbon $endDate): array
    {
        // Una sola consulta para todos los conteos
        $stats = DB::table('conversations')
            ->selectRaw('
                COUNT(*) as total,
                SUM(CASE WHEN status = "active" THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN status = "pending" THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = "in_progress" THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN status = "resolved" THEN 1 ELSE 0 END) as resolved,
                SUM(CASE WHEN status = "closed" THEN 1 ELSE 0 END) as closed,
                SUM(CASE WHEN status = "scheduled" THEN 1 ELSE 0 END) as scheduled,
                SUM(CASE WHEN unread_count > 0 THEN 1 ELSE 0 END) as unread
            ');

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
    private function getTemplateStatistics(?\Carbon\Carbon $startDate, ?\Carbon\Carbon $endDate): array
    {
        // Los envíos salen de bulk_send_recipients, no de template_sends.
        //
        // template_sends la llena TemplateSendService (pantalla "enviar plantilla"), que
        // nunca se ha usado: 0 filas, así que el panel mostraba siempre "0 envíos". Los
        // envíos de plantillas que SÍ ocurren son los masivos, y los 94 lotes existentes
        // llevan todos template_name. Esta tabla además tiene created_at, así que respeta
        // el filtro de fechas (templates.usage_count no serviría: es un contador acumulado).
        $stats = DB::table('bulk_send_recipients')
            ->selectRaw('
                SUM(CASE WHEN status = "sent" THEN 1 ELSE 0 END) as successful_sends,
                SUM(CASE WHEN status = "failed" THEN 1 ELSE 0 END) as failed_sends
            ');

        if ($startDate && $endDate) {
            $stats->whereBetween('created_at', [$startDate, $endDate]);
        }

        $result = $stats->first();

        $successfulSends = (int) ($result->successful_sends ?? 0);
        $failedSends = (int) ($result->failed_sends ?? 0);

        return [
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
    private function getCostStatistics(?\Carbon\Carbon $startDate, ?\Carbon\Carbon $endDate): array
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
        foreach ($rows as $r) {
            $cat = $r->pricing_category;
            if (!isset($byCategory[$cat])) {
                $byCategory[$cat] = ['billable' => 0, 'free' => 0, 'rate' => (float) ($rates[$cat] ?? 0), 'cost' => 0.0];
            }
            $cnt = (int) $r->cnt;
            if ((int) $r->billable === 1) {
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

        // Cobertura: qué porción de los salientes tiene datos de facturación.
        $outbound = (int) (clone $base)->count();
        $withPricing = (int) (clone $base)->whereNotNull('pricing_category')->count();

        return [
            'currency' => $currency,
            'rates_as_of' => $ratesAsOf,
            'by_category' => $byCategory,
            'total_cost' => round($totalCost, 2),
            'billable_total' => $billableTotal,
            'free_total' => $freeTotal,
            'outbound_total' => $outbound,
            'with_pricing' => $withPricing,
            'without_pricing' => max(0, $outbound - $withPricing),
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
            ->selectRaw('
                COUNT(*) as total,
                SUM(CASE WHEN role = "admin" THEN 1 ELSE 0 END) as admins,
                SUM(CASE WHEN role = "advisor" THEN 1 ELSE 0 END) as advisors
            ')
            ->first();

        return [
            'total' => (int) ($stats->total ?? 0),
            'admins' => (int) ($stats->admins ?? 0),
            'advisors' => (int) ($stats->advisors ?? 0),
        ];
    }

    /**
     * Get advisor performance statistics - CORREGIDO para contar mensajes independientemente de la asignación actual
     */
    private function getAdvisorStatistics(?\Carbon\Carbon $startDate, ?\Carbon\Carbon $endDate): array
    {
        // Obtener todos los asesores
        $advisors = User::where('role', 'advisor')->get();

        // DOS consultas agrupadas para TODOS los asesores, en vez de 6 por cada uno.
        // Antes este map() disparaba 6 consultas por asesor: con 27 asesores eran ~162
        // consultas sólo en este bloque (189 en toda la vista). Ahora son 2.
        $convAgg = Conversation::selectRaw('
                assigned_to,
                COUNT(*) AS total,
                SUM(status IN ("resolved","closed")) AS resolved,
                SUM(status = "scheduled") AS scheduled,
                SUM(status = "active") AS active,
                SUM(unread_count > 0) AS with_unread
            ')
            ->whereNotNull('assigned_to')
            ->when($startDate && $endDate, fn ($q) => $q->whereBetween('created_at', [$startDate, $endDate]))
            ->groupBy('assigned_to')
            ->get()
            ->keyBy('assigned_to');

        $msgAgg = Message::selectRaw('sent_by, COUNT(*) AS sent')
            ->where('is_from_user', false)
            ->whereNotNull('sent_by')
            ->when($startDate && $endDate, fn ($q) => $q->whereBetween('created_at', [$startDate, $endDate]))
            ->groupBy('sent_by')
            ->pluck('sent', 'sent_by');

        $advisorStats = $advisors->map(function ($advisor) use ($convAgg, $msgAgg) {
            $c = $convAgg->get($advisor->id);

            $totalConversations = (int) ($c->total ?? 0);
            $resolvedConversations = (int) ($c->resolved ?? 0);
            $scheduledConversations = (int) ($c->scheduled ?? 0);
            $activeConversations = (int) ($c->active ?? 0);
            $conversationsWithUnread = (int) ($c->with_unread ?? 0);
            $messagesSent = (int) ($msgAgg[$advisor->id] ?? 0);

            // null (no 0) cuando no tiene conversaciones asignadas: "sin datos" y "resolvió
            // el 0%" son cosas distintas, y el frontend pintaba de rojo (bajo rendimiento)
            // a quien simplemente no tenía carga.
            $resolutionRate = $totalConversations > 0
                ? round(($resolvedConversations * 100.0) / $totalConversations, 2)
                : null;

            return [
                'id' => $advisor->id,
                'name' => $advisor->name,
                'total_conversations' => $totalConversations,
                'resolved_conversations' => $resolvedConversations,
                'scheduled_conversations' => $scheduledConversations,
                'active_conversations' => $activeConversations,
                'conversations_with_unread' => $conversationsWithUnread,
                'messages_sent' => $messagesSent,
                'resolution_rate' => $resolutionRate,
            ];
        })->sortByDesc('resolved_conversations')->values()->toArray();

        // Calcular totales y promedios para el resumen
        $totalAdvisors = count($advisorStats);
        $totalConversations = array_sum(array_column($advisorStats, 'total_conversations'));
        $totalResolved = array_sum(array_column($advisorStats, 'resolved_conversations'));
        $totalScheduled = array_sum(array_column($advisorStats, 'scheduled_conversations'));
        $totalActive = array_sum(array_column($advisorStats, 'active_conversations'));
        $totalUnread = array_sum(array_column($advisorStats, 'conversations_with_unread'));
        $totalMessages = array_sum(array_column($advisorStats, 'messages_sent'));
        
        // Tasa PONDERADA por volumen: resueltas / asignadas sobre el total real.
        //
        // Antes era la media aritmética de los porcentajes individuales dividida entre
        // TODOS los asesores, incluidos los que no tienen ninguna conversación (que
        // aportaban 0%). Con 10 de 27 asesores sin carga, el panel mostraba 62,12%
        // cuando el equipo resuelve de verdad el 91,03%.
        $avgResolutionRate = $totalConversations > 0
            ? round(($totalResolved * 100.0) / $totalConversations, 2)
            : 0;

        // Encontrar al mejor asesor (mayor número de conversaciones resueltas)
        $topAdvisor = !empty($advisorStats) ? $advisorStats[0] : null;

        return [
            'total_advisors' => $totalAdvisors,
            'total_conversations' => $totalConversations,
            'total_resolved' => $totalResolved,
            'total_scheduled' => $totalScheduled,
            'total_active' => $totalActive,
            'total_with_unread' => $totalUnread,
            'total_messages_sent' => $totalMessages,
            'avg_resolution_rate' => $avgResolutionRate,
            'top_performer' => $topAdvisor,
            'advisors' => $advisorStats,
        ];
    }

    /**
     * Export statistics to Excel
     */
    public function export(Request $request)
    {
        $startDate = $request->get('start_date');
        $endDate = $request->get('end_date');
        $period = $request->get('period', 'all');

        // Calcular fechas según el período seleccionado
        [$dateStart, $dateEnd] = $this->calculateDateRange($startDate, $endDate, $period);

        $statistics = [
            'messages' => $this->getMessageStatistics($dateStart, $dateEnd),
            'appointments' => $this->getAppointmentStatistics($dateStart, $dateEnd),
            'conversations' => $this->getConversationStatistics($dateStart, $dateEnd),
            'templates' => $this->getTemplateStatistics($dateStart, $dateEnd),
            'costs' => $this->getCostStatistics($dateStart, $dateEnd),
            'users' => $this->getUserStatistics(),
            'advisors' => $this->getAdvisorStatistics($dateStart, $dateEnd),
        ];

        $dateRange = [
            'start' => $dateStart?->format('Y-m-d'),
            'end' => $dateEnd?->format('Y-m-d'),
            'period' => $period,
        ];

        // Hora de Colombia: con now() (UTC) un archivo bajado a las 15:00 salía marcado
        // como las 20:00, y los de la tarde aparecían fechados al día siguiente.
        $fileName = 'estadisticas_' . now()->setTimezone(self::BUSINESS_TZ)->format('Y-m-d_His') . '.xlsx';

        $export = new StatisticsExport($statistics, $dateRange);
        return $export->download($fileName);
    }

    /**
     * Get detailed statistics for a specific advisor
     */
    public function advisorDetail(Request $request, User $user)
    {
        $startDate = $request->get('start_date');
        $endDate = $request->get('end_date');
        $period = $request->get('period', 'all');

        [$dateStart, $dateEnd] = $this->calculateDateRange($startDate, $endDate, $period);

        // Messages sent by this advisor
        $msgQuery = Message::where('sent_by', $user->id)->where('is_from_user', false);
        if ($dateStart && $dateEnd) {
            $msgQuery->whereBetween('created_at', [$dateStart, $dateEnd]);
        }
        $messagesSent = $msgQuery->count();

        // Conversations assigned
        $convQuery = Conversation::where('assigned_to', $user->id);
        if ($dateStart && $dateEnd) {
            $convQuery->whereBetween('created_at', [$dateStart, $dateEnd]);
        }

        $totalConversations = (clone $convQuery)->count();
        $resolvedConversations = (clone $convQuery)->whereIn('status', ['resolved', 'closed'])->count();
        $scheduledConversations = (clone $convQuery)->where('status', 'scheduled')->count();
        $activeConversations = (clone $convQuery)->where('status', 'active')->count();
        $pendingConversations = (clone $convQuery)->where('status', 'pending')->count();

        // Average response time: time between a user message and the next advisor reply in conversations assigned to this advisor
        $medianResponseTime = $this->calculateMedianResponseTime($user->id, $dateStart, $dateEnd);

        // Daily message counts (last 7 days or within range)
        $dailyActivity = $this->getDailyActivity($user->id, $dateStart, $dateEnd);

        // Hourly distribution
        $hourlyDistribution = DB::table('messages')
            ->where('sent_by', $user->id)
            ->where('is_from_user', false)
            ->when($dateStart && $dateEnd, fn($q) => $q->whereBetween('created_at', [$dateStart, $dateEnd]))
            // created_at está en UTC; la gráfica rotula las barras como hora local, así que
            // hay que restar las 5 horas de Colombia. Sin esto la jornada salía corrida:
            // un asesor que trabaja de 06:00 a 16:00 aparecía trabajando de 11:00 a 21:00.
            ->selectRaw('HOUR(CONVERT_TZ(created_at, "+00:00", "-05:00")) as hour, COUNT(*) as count')
            ->groupBy('hour')
            ->orderBy('hour')
            ->pluck('count', 'hour')
            ->toArray();

        // Fill all 24 hours
        $hourly = [];
        for ($h = 0; $h < 24; $h++) {
            $hourly[] = [
                'hour' => sprintf('%02d:00', $h),
                'count' => $hourlyDistribution[$h] ?? 0,
            ];
        }

        // Message types sent
        $messageTypes = DB::table('messages')
            ->where('sent_by', $user->id)
            ->where('is_from_user', false)
            ->when($dateStart && $dateEnd, fn($q) => $q->whereBetween('created_at', [$dateStart, $dateEnd]))
            ->selectRaw('message_type, COUNT(*) as count')
            ->groupBy('message_type')
            ->pluck('count', 'message_type')
            ->toArray();

        return response()->json([
            'advisor' => [
                'id' => $user->id,
                'name' => $user->name,
            ],
            'summary' => [
                'messages_sent' => $messagesSent,
                'total_conversations' => $totalConversations,
                'resolved_conversations' => $resolvedConversations,
                'scheduled_conversations' => $scheduledConversations,
                'active_conversations' => $activeConversations,
                'pending_conversations' => $pendingConversations,
                'resolution_rate' => $totalConversations > 0
                    ? round(($resolvedConversations * 100.0) / $totalConversations, 2)
                    : 0,
                'median_response_time_minutes' => $medianResponseTime,
            ],
            'daily_activity' => $dailyActivity,
            'hourly_distribution' => $hourly,
            'message_types' => $messageTypes,
        ]);
    }

    /**
     * Tiempo de respuesta TÍPICO (mediana), en minutos, de un asesor.
     *
     * Se usa la mediana y no la media porque la distribución tiene una cola muy larga:
     * medido sobre datos reales, una asesora con mediana de 24 min (y un 30% de respuestas
     * en menos de 5 min) salía con una media de 3h52m por culpa del 10% de casos que
     * tardan más de 16 h. La media hacía parecer al equipo diez veces más lento de lo que es.
     */
    private function calculateMedianResponseTime(int $advisorId, ?\Carbon\Carbon $dateStart, ?\Carbon\Carbon $dateEnd): ?float
    {
        // Get conversations where this advisor has sent messages
        $conversationIds = Message::where('sent_by', $advisorId)
            ->where('is_from_user', false)
            ->when($dateStart && $dateEnd, fn($q) => $q->whereBetween('created_at', [$dateStart, $dateEnd]))
            ->distinct()
            ->pluck('conversation_id');

        if ($conversationIds->isEmpty()) {
            return null;
        }

        // Se empareja POR RESPUESTA DEL ASESOR, no por mensaje del paciente.
        //
        // Antes se recorría cada mensaje entrante buscando "la siguiente respuesta": si el
        // paciente escribía 5 mensajes seguidos, los 5 se emparejaban con la MISMA respuesta
        // (se contaba 4,5 veces de media) y al más antiguo se le imputaba la espera entera.
        //
        // Ahora, para cada respuesta se mide desde que el paciente empezó a esperar: el primer
        // mensaje suyo posterior a la última respuesta de CUALQUIER agente en esa conversación.
        // Cada respuesta cuenta una sola vez y el número es la espera real del paciente.
        $responseTimes = DB::select("
            SELECT response_seconds FROM (
                SELECT TIMESTAMPDIFF(
                    SECOND,
                    (
                        SELECT MIN(u.created_at) FROM messages u
                        WHERE u.conversation_id = a.conversation_id
                          AND u.is_from_user = 1
                          AND u.created_at < a.created_at
                          AND u.created_at > COALESCE((
                              SELECT MAX(p.created_at) FROM messages p
                              WHERE p.conversation_id = a.conversation_id
                                AND p.is_from_user = 0
                                AND p.created_at < a.created_at
                          ), '1970-01-01 00:00:00')
                    ),
                    a.created_at
                ) as response_seconds
                FROM messages a
                WHERE a.is_from_user = 0
                  AND a.sent_by = ?
                  AND a.conversation_id IN (" . implode(',', $conversationIds->toArray()) . ")
                  " . ($dateStart && $dateEnd ? "AND a.created_at BETWEEN ? AND ?" : "") . "
                HAVING response_seconds BETWEEN 0 AND 86400
            ) as response_data
            ORDER BY response_seconds
        ", array_merge(
            [$advisorId],
            $dateStart && $dateEnd ? [$dateStart, $dateEnd] : []
        ));

        $segundos = array_column($responseTimes, 'response_seconds');
        $n = count($segundos);

        if ($n === 0) {
            return null;
        }

        // Vienen ya ordenados por la consulta.
        $medio = intdiv($n, 2);
        $mediana = $n % 2 === 1
            ? (float) $segundos[$medio]
            : ((float) $segundos[$medio - 1] + (float) $segundos[$medio]) / 2;

        return round($mediana / 60, 1);
    }

    /**
     * Get daily message activity for an advisor
     */
    private function getDailyActivity(int $advisorId, ?\Carbon\Carbon $dateStart, ?\Carbon\Carbon $dateEnd): array
    {
        // Default to last 7 days if no range
        $start = $dateStart ?? now()->subDays(6)->startOfDay();
        $end = $dateEnd ?? now()->endOfDay();

        $daily = DB::table('messages')
            ->where('sent_by', $advisorId)
            ->where('is_from_user', false)
            ->whereBetween('created_at', [$start, $end])
            ->selectRaw('DATE(created_at) as date, COUNT(*) as count')
            ->groupBy('date')
            ->orderBy('date')
            ->pluck('count', 'date')
            ->toArray();

        // Fill in missing dates
        $result = [];
        $current = $start->copy()->startOfDay();
        $endDate = $end->copy()->startOfDay();

        while ($current->lte($endDate)) {
            $dateStr = $current->format('Y-m-d');
            $result[] = [
                'date' => $dateStr,
                'label' => $current->translatedFormat('D d'),
                'count' => $daily[$dateStr] ?? 0,
            ];
            $current->addDay();
        }

        return $result;
    }
}
