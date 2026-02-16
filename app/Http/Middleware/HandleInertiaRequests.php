<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        [$message, $author] = str(Inspiring::quotes()->random())->explode('-');

        // Contar conversaciones con mensajes no leídos
        $unreadConversationsCount = 0;
        if ($request->user()) {
            // Si el usuario es asesor, solo contar las asignadas a él
            if ($request->user()->role === 'advisor') {
                $unreadConversationsCount = \App\Models\Conversation::where('assigned_to', $request->user()->id)
                    ->whereIn('status', ['active', 'pending'])
                    ->where('unread_count', '>', 0)
                    ->count();
            } else {
                // Si es admin, contar todas las conversaciones con mensajes no leídos (excluir resueltas)
                $unreadConversationsCount = \App\Models\Conversation::whereIn('status', ['active', 'pending'])
                    ->where('unread_count', '>', 0)
                    ->count();
            }
        }

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'quote' => ['message' => trim($message), 'author' => trim($author)],
            'auth' => [
                'user' => $request->user(),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            'unreadConversationsCount' => $unreadConversationsCount,
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
        ];
    }
}
