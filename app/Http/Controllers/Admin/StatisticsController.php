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

        $statistics = [
            'messages' => $this->getMessageStatistics($dateStart, $dateEnd),
            'appointments' => $this->getAppointmentStatistics($dateStart, $dateEnd),
            'conversations' => $this->getConversationStatistics($dateStart, $dateEnd),
            'templates' => $this->getTemplateStatistics($dateStart, $dateEnd),
            'users' => $this->getUserStatistics(),
            'date_range' => [
                'start' => $dateStart?->format('Y-m-d'),
                'end' => $dateEnd?->format('Y-m-d'),
                'period' => $period,
            ],
        ];

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
     * Get message statistics
     */
    private function getMessageStatistics(?\Carbon\Carbon $startDate, ?\Carbon\Carbon $endDate): array
    {
        $query = Message::query();

        if ($startDate && $endDate) {
            $query->whereBetween('created_at', [$startDate, $endDate]);
        }

        // Mensajes enviados por el sistema
        $sentQuery = clone $query;
        $sent = $sentQuery->where('is_from_user', false)->count();

        // Mensajes contestados: usuarios que respondieron después de recibir un mensaje del sistema
        // Esto se cuenta como las conversaciones donde hubo interacción del usuario
        $answered = $this->getAnsweredMessagesCount($startDate, $endDate);

        // Mensajes por estado
        $byStatus = [];
        foreach (['pending', 'sent', 'delivered', 'read', 'failed'] as $status) {
            $statusQuery = clone $query;
            $byStatus[$status] = $statusQuery->where('status', $status)->count();
        }

        // Confirmados, cancelados (basados en appointments)
        // Estos son los clics en los botones de respuesta
        $confirmed = Appointment::where('reminder_status', 'confirmed');
        $cancelled = Appointment::where('reminder_status', 'cancelled');

        if ($startDate && $endDate) {
            $confirmed->whereBetween('updated_at', [$startDate, $endDate]);
            $cancelled->whereBetween('updated_at', [$startDate, $endDate]);
        }

        return [
            'sent' => $sent,
            'answered' => $answered,
            'confirmed' => $confirmed->count(),
            'cancelled' => $cancelled->count(),
            'by_status' => $byStatus,
        ];
    }

    /**
     * Get count of answered messages (users who responded after receiving a system message)
     */
    private function getAnsweredMessagesCount(?\Carbon\Carbon $startDate, ?\Carbon\Carbon $endDate): int
    {
        // Contar conversaciones únicas donde el usuario respondió después de recibir un mensaje del sistema
        $query = DB::table('messages as user_msg')
            ->select('user_msg.conversation_id')
            ->join('messages as system_msg', function ($join) {
                $join->on('user_msg.conversation_id', '=', 'system_msg.conversation_id')
                    ->where('system_msg.is_from_user', '=', false)
                    ->whereColumn('user_msg.created_at', '>', 'system_msg.created_at');
            })
            ->where('user_msg.is_from_user', true);

        if ($startDate && $endDate) {
            $query->whereBetween('user_msg.created_at', [$startDate, $endDate]);
        }

        // Usar groupBy y count para obtener conversaciones únicas
        return $query->groupBy('user_msg.conversation_id')->get()->count();
    }

    /**
     * Get appointment statistics
     */
    private function getAppointmentStatistics(?\Carbon\Carbon $startDate, ?\Carbon\Carbon $endDate): array
    {
        $query = Appointment::query();

        if ($startDate && $endDate) {
            $query->whereBetween('created_at', [$startDate, $endDate]);
        }

        $total = $query->count();

        // Citas con recordatorio enviado
        $reminderSentQuery = clone $query;
        $reminderSent = $reminderSentQuery->where('reminder_sent', true)->count();

        // Por estado de recordatorio
        $byStatus = [];
        foreach (['pending', 'sent', 'delivered', 'read', 'failed', 'confirmed', 'cancelled'] as $status) {
            $statusQuery = clone $query;
            $byStatus[$status] = $statusQuery->where('reminder_status', $status)->count();
        }

        return [
            'total' => $total,
            'reminder_sent' => $reminderSent,
            'confirmed' => $byStatus['confirmed'],
            'cancelled' => $byStatus['cancelled'],
            'pending' => $byStatus['pending'],
            'failed' => $byStatus['failed'],
            'by_status' => $byStatus,
        ];
    }

    /**
     * Get conversation statistics
     */
    private function getConversationStatistics(?\Carbon\Carbon $startDate, ?\Carbon\Carbon $endDate): array
    {
        $query = Conversation::query();

        if ($startDate && $endDate) {
            $query->whereBetween('created_at', [$startDate, $endDate]);
        }

        $total = $query->count();

        // Por estado
        $byStatus = [];
        foreach (['active', 'pending', 'in_progress', 'resolved', 'closed'] as $status) {
            $statusQuery = clone $query;
            $byStatus[$status] = $statusQuery->where('status', $status)->count();
        }

        // Con mensajes sin leer
        $unreadQuery = clone $query;
        $unread = $unreadQuery->where('unread_count', '>', 0)->count();

        return [
            'total' => $total,
            'active' => $byStatus['active'],
            'pending' => $byStatus['pending'],
            'closed' => $byStatus['closed'],
            'unread' => $unread,
            'by_status' => $byStatus,
        ];
    }

    /**
     * Get template statistics
     */
    private function getTemplateStatistics(?\Carbon\Carbon $startDate, ?\Carbon\Carbon $endDate): array
    {
        $totalTemplates = Template::count();

        $query = TemplateSend::query();

        if ($startDate && $endDate) {
            $query->whereBetween('created_at', [$startDate, $endDate]);
        }

        $successfulSends = $query->sum('successful_sends');
        $failedSends = $query->sum('failed_sends');
        $totalSends = $successfulSends + $failedSends;

        return [
            'total' => $totalTemplates,
            'successful_sends' => $successfulSends,
            'failed_sends' => $failedSends,
            'total_sends' => $totalSends,
        ];
    }

    /**
     * Get user statistics
     */
    private function getUserStatistics(): array
    {
        $total = User::count();
        $admins = User::where('role', 'admin')->count();
        $advisors = User::where('role', 'advisor')->count();

        return [
            'total' => $total,
            'admins' => $admins,
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

