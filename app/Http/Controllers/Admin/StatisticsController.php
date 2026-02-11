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

        // Cachear estadísticas por 5 minutos para mejorar rendimiento
        $statistics = Cache::remember($cacheKey, 300, function () use ($dateStart, $dateEnd, $period) {
            return [
                'messages' => $this->getMessageStatistics($dateStart, $dateEnd),
                'appointments' => $this->getAppointmentStatistics($dateStart, $dateEnd),
                'conversations' => $this->getConversationStatistics($dateStart, $dateEnd),
                'templates' => $this->getTemplateStatistics($dateStart, $dateEnd),
                'users' => $this->getUserStatistics(),
                'advisors' => $this->getAdvisorStatistics($dateStart, $dateEnd),
                'date_range' => [
                    'start' => $dateStart?->format('Y-m-d'),
                    'end' => $dateEnd?->format('Y-m-d'),
                    'period' => $period,
                ],
            ];
        });

        return Inertia::render('admin/statistics/index', [
            'statistics' => $statistics,
        ]);
    }

    /**
     * Calculate date range based on period or custom dates
     */
    private function calculateDateRange(?string $startDate, ?string $endDate, string $period): array
    {
        if ($startDate && $endDate) {
            return [
                \Carbon\Carbon::parse($startDate)->startOfDay(),
                \Carbon\Carbon::parse($endDate)->endOfDay(),
            ];
        }

        return match ($period) {
            'today' => [
                now()->startOfDay(),
                now()->endOfDay(),
            ],
            'week' => [
                now()->startOfWeek(),
                now()->endOfWeek(),
            ],
            'month' => [
                now()->startOfMonth(),
                now()->endOfMonth(),
            ],
            'year' => [
                now()->startOfYear(),
                now()->endOfYear(),
            ],
            default => [null, null], // All time
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
        // Una sola consulta para total, reminder_sent y estados
        $baseQuery = Appointment::query();
        if ($startDate && $endDate) {
            $baseQuery->whereBetween('created_at', [$startDate, $endDate]);
        }

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
        
        if ($startDate && $endDate) {
            $stats->whereBetween('created_at', [$startDate, $endDate]);
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
            'unread' => (int) ($result->unread ?? 0),
        ];
    }

    /**
     * Get template statistics - OPTIMIZADO
     */
    private function getTemplateStatistics(?\Carbon\Carbon $startDate, ?\Carbon\Carbon $endDate): array
    {
        // Una sola consulta para templates y sends
        $stats = DB::table('template_sends')
            ->selectRaw('
                SUM(successful_sends) as successful_sends,
                SUM(failed_sends) as failed_sends
            ');

        if ($startDate && $endDate) {
            $stats->whereBetween('created_at', [$startDate, $endDate]);
        }

        $result = $stats->first();
        $totalTemplates = Template::count();

        $successfulSends = (int) ($result->successful_sends ?? 0);
        $failedSends = (int) ($result->failed_sends ?? 0);

        return [
            'total' => $totalTemplates,
            'successful_sends' => $successfulSends,
            'failed_sends' => $failedSends,
            'total_sends' => $successfulSends + $failedSends,
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
     * Get advisor performance statistics
     */
    private function getAdvisorStatistics(?\Carbon\Carbon $startDate, ?\Carbon\Carbon $endDate): array
    {
        // Obtener estadísticas por asesor
        $advisorStats = DB::table('users as u')
            ->selectRaw('
                u.id,
                u.name,
                COUNT(DISTINCT c.id) as total_conversations,
                COUNT(DISTINCT CASE WHEN c.status IN ("resolved", "closed") THEN c.id END) as resolved_conversations,
                COUNT(DISTINCT CASE WHEN c.status = "active" THEN c.id END) as active_conversations,
                COUNT(DISTINCT CASE WHEN c.unread_count > 0 THEN c.id END) as conversations_with_unread,
                COUNT(m.id) as messages_sent,
                ROUND(
                    CASE 
                        WHEN COUNT(DISTINCT c.id) > 0 
                        THEN (COUNT(DISTINCT CASE WHEN c.status IN ("resolved", "closed") THEN c.id END) * 100.0 / COUNT(DISTINCT c.id))
                        ELSE 0 
                    END, 
                    2
                ) as resolution_rate
            ')
            ->leftJoin('conversations as c', 'u.id', '=', 'c.assigned_to')
            ->leftJoin('messages as m', function ($join) use ($startDate, $endDate) {
                $join->on('c.id', '=', 'm.conversation_id')
                     ->where('m.is_from_user', false)
                     ->where('m.sent_by', '=', DB::raw('u.id'));
            })
            ->where('u.role', 'advisor')
            ->groupBy('u.id', 'u.name')
            ->orderBy('resolved_conversations', 'desc');

        // Aplicar filtro de fechas si se especifica
        if ($startDate && $endDate) {
            $advisorStats->where(function ($query) use ($startDate, $endDate) {
                $query->whereNull('c.created_at')
                      ->orWhereBetween('c.created_at', [$startDate, $endDate]);
            });
        }

        $advisors = $advisorStats->get()->map(function ($advisor) {
            return [
                'id' => $advisor->id,
                'name' => $advisor->name,
                'total_conversations' => (int) $advisor->total_conversations,
                'resolved_conversations' => (int) $advisor->resolved_conversations,
                'active_conversations' => (int) $advisor->active_conversations,
                'conversations_with_unread' => (int) $advisor->conversations_with_unread,
                'messages_sent' => (int) $advisor->messages_sent,
                'resolution_rate' => (float) $advisor->resolution_rate,
            ];
        })->toArray();

        // Calcular totales y promedios
        $totalAdvisors = count($advisors);
        $totalConversations = array_sum(array_column($advisors, 'total_conversations'));
        $totalResolved = array_sum(array_column($advisors, 'resolved_conversations'));
        $totalActive = array_sum(array_column($advisors, 'active_conversations'));
        $totalUnread = array_sum(array_column($advisors, 'conversations_with_unread'));
        $totalMessages = array_sum(array_column($advisors, 'messages_sent'));
        
        $avgResolutionRate = $totalAdvisors > 0 
            ? round(array_sum(array_column($advisors, 'resolution_rate')) / $totalAdvisors, 2)
            : 0;

        // Encontrar al mejor asesor (mayor número de conversaciones resueltas)
        $topAdvisor = !empty($advisors) ? $advisors[0] : null;

        return [
            'total_advisors' => $totalAdvisors,
            'total_conversations' => $totalConversations,
            'total_resolved' => $totalResolved,
            'total_active' => $totalActive,
            'total_with_unread' => $totalUnread,
            'total_messages_sent' => $totalMessages,
            'avg_resolution_rate' => $avgResolutionRate,
            'top_performer' => $topAdvisor,
            'advisors' => $advisors,
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
            'users' => $this->getUserStatistics(),
            'advisors' => $this->getAdvisorStatistics($dateStart, $dateEnd),
        ];

        $dateRange = [
            'start' => $dateStart?->format('Y-m-d'),
            'end' => $dateEnd?->format('Y-m-d'),
            'period' => $period,
        ];

        $fileName = 'estadisticas_' . now()->format('Y-m-d_His') . '.xlsx';

        $export = new StatisticsExport($statistics, $dateRange);
        return $export->download($fileName);
    }
}

