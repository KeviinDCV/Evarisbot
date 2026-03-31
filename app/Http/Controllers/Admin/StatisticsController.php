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
     * Get advisor performance statistics - CORREGIDO para contar mensajes independientemente de la asignación actual
     */
    private function getAdvisorStatistics(?\Carbon\Carbon $startDate, ?\Carbon\Carbon $endDate): array
    {
        // Obtener todos los asesores
        $advisors = User::where('role', 'advisor')->get();

        $advisorStats = $advisors->map(function ($advisor) use ($startDate, $endDate) {
            // 1. Estadísticas de Conversaciones (basadas en asignación actual)
            $convQuery = Conversation::where('assigned_to', $advisor->id);
            
            // Si hay filtro de fecha, aplicarlo a la fecha de creación de la conversación
            if ($startDate && $endDate) {
                $convQuery->whereBetween('created_at', [$startDate, $endDate]);
            }

            // Clonar queries para diferentes conteos
            $totalConversations = (clone $convQuery)->count();
            $resolvedConversations = (clone $convQuery)->whereIn('status', ['resolved', 'closed'])->count();
            $activeConversations = (clone $convQuery)->where('status', 'active')->count();
            $conversationsWithUnread = (clone $convQuery)->where('unread_count', '>', 0)->count();

            // 2. Estadísticas de Mensajes Enviados (independiente de la asignación actual)
            // Se cuenta cualquier mensaje enviado por este asesor en el rango de fechas
            $msgQuery = Message::where('sent_by', $advisor->id)
                ->where('is_from_user', false);
            
            if ($startDate && $endDate) {
                $msgQuery->whereBetween('created_at', [$startDate, $endDate]);
            }
            
            $messagesSent = $msgQuery->count();

            // Calcular tasa de resolución
            $resolutionRate = $totalConversations > 0 
                ? round(($resolvedConversations * 100.0) / $totalConversations, 2) 
                : 0;

            return [
                'id' => $advisor->id,
                'name' => $advisor->name,
                'total_conversations' => $totalConversations,
                'resolved_conversations' => $resolvedConversations,
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
        $totalActive = array_sum(array_column($advisorStats, 'active_conversations'));
        $totalUnread = array_sum(array_column($advisorStats, 'conversations_with_unread'));
        $totalMessages = array_sum(array_column($advisorStats, 'messages_sent'));
        
        $avgResolutionRate = $totalAdvisors > 0 
            ? round(array_sum(array_column($advisorStats, 'resolution_rate')) / $totalAdvisors, 2)
            : 0;

        // Encontrar al mejor asesor (mayor número de conversaciones resueltas)
        $topAdvisor = !empty($advisorStats) ? $advisorStats[0] : null;

        return [
            'total_advisors' => $totalAdvisors,
            'total_conversations' => $totalConversations,
            'total_resolved' => $totalResolved,
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
        $activeConversations = (clone $convQuery)->where('status', 'active')->count();
        $pendingConversations = (clone $convQuery)->where('status', 'pending')->count();

        // Average response time: time between a user message and the next advisor reply in conversations assigned to this advisor
        $avgResponseTime = $this->calculateAvgResponseTime($user->id, $dateStart, $dateEnd);

        // Daily message counts (last 7 days or within range)
        $dailyActivity = $this->getDailyActivity($user->id, $dateStart, $dateEnd);

        // Hourly distribution
        $hourlyDistribution = DB::table('messages')
            ->where('sent_by', $user->id)
            ->where('is_from_user', false)
            ->when($dateStart && $dateEnd, fn($q) => $q->whereBetween('created_at', [$dateStart, $dateEnd]))
            ->selectRaw('HOUR(created_at) as hour, COUNT(*) as count')
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
                'active_conversations' => $activeConversations,
                'pending_conversations' => $pendingConversations,
                'resolution_rate' => $totalConversations > 0
                    ? round(($resolvedConversations * 100.0) / $totalConversations, 2)
                    : 0,
                'avg_response_time_minutes' => $avgResponseTime,
            ],
            'daily_activity' => $dailyActivity,
            'hourly_distribution' => $hourly,
            'message_types' => $messageTypes,
        ]);
    }

    /**
     * Calculate average response time in minutes for an advisor
     */
    private function calculateAvgResponseTime(int $advisorId, ?\Carbon\Carbon $dateStart, ?\Carbon\Carbon $dateEnd): ?float
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

        // For each conversation, find pairs: user message -> next advisor reply
        // Use a raw query for efficiency
        $responseTimes = DB::select("
            SELECT AVG(response_seconds) as avg_seconds FROM (
                SELECT TIMESTAMPDIFF(SECOND, user_msg.created_at, advisor_msg.created_at) as response_seconds
                FROM messages user_msg
                INNER JOIN messages advisor_msg ON advisor_msg.conversation_id = user_msg.conversation_id
                    AND advisor_msg.is_from_user = 0
                    AND advisor_msg.sent_by = ?
                    AND advisor_msg.created_at > user_msg.created_at
                    AND advisor_msg.id = (
                        SELECT MIN(m2.id) FROM messages m2
                        WHERE m2.conversation_id = user_msg.conversation_id
                        AND m2.is_from_user = 0
                        AND m2.sent_by = ?
                        AND m2.created_at > user_msg.created_at
                    )
                WHERE user_msg.is_from_user = 1
                    AND user_msg.conversation_id IN (" . implode(',', $conversationIds->toArray()) . ")
                    " . ($dateStart && $dateEnd ? "AND user_msg.created_at BETWEEN ? AND ?" : "") . "
                HAVING response_seconds BETWEEN 0 AND 86400
            ) as response_data
        ", array_merge(
            [$advisorId, $advisorId],
            $dateStart && $dateEnd ? [$dateStart, $dateEnd] : []
        ));

        $avgSeconds = $responseTimes[0]->avg_seconds ?? null;
        return $avgSeconds !== null ? round($avgSeconds / 60, 1) : null;
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
