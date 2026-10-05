<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <meta name="robots" content="noindex, nofollow">

        <title inertia>{{ config('app.name', 'Evarisbot') }}</title>

        <link rel="icon" href="/images/favicon.png" type="image/png">
        <link rel="apple-touch-icon" href="/images/favicon.png">

        {{-- Fuente auto-hospedada en /public/fonts (declarada en app.css); precargamos la principal --}}
        <link rel="preload" href="/fonts/instrument-sans-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>

        {{-- Aplicar tema antes de que se cargue el contenido para evitar flash --}}
        <script>
            (function() {
                const saved = localStorage.getItem('appearance');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                // Por defecto usar 'light' si no hay preferencia guardada
                const isDark = saved === 'dark' || (saved === 'system' && prefersDark);
                
                if (isDark) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.style.colorScheme = 'dark';
                } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.style.colorScheme = 'light';
                }
            })();
        </script>

        @viteReactRefresh
        @vite(['resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
