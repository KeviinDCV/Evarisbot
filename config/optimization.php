<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Optimización de Memoria - Configuración
    |--------------------------------------------------------------------------
    |
    | Controla las tareas automáticas de optimización de memoria.
    | IMPORTANTE: Cambiar 'enabled' a true solo después de verificar en pruebas.
    |
    */

    // Activar/desactivar optimización automática (inicialmente false por seguridad)
    'enabled' => env('OPTIMIZATION_ENABLED', false),

    /*
    |--------------------------------------------------------------------------
    | Limpieza de Datos Antiguos
    |--------------------------------------------------------------------------
    */
    'cleanup_data' => [
        'enabled' => env('CLEANUP_DATA_ENABLED', false),
        'schedule' => env('CLEANUP_DATA_SCHEDULE', 'daily'), // daily, weekly
        'time' => env('CLEANUP_DATA_TIME', '03:00'), // Hora (formato 24h)
        'days' => (int) env('CLEANUP_DATA_DAYS', 30), // Días de antigüedad
        'dry_run' => env('CLEANUP_DATA_DRY_RUN', true), // Modo prueba por defecto
    ],

    /*
    |--------------------------------------------------------------------------
    | Limpieza de Logs
    |--------------------------------------------------------------------------
    */
    'cleanup_logs' => [
        'enabled' => env('CLEANUP_LOGS_ENABLED', false),
        'schedule' => env('CLEANUP_LOGS_SCHEDULE', 'daily'), // daily, weekly
        'time' => env('CLEANUP_LOGS_TIME', '03:30'), // Hora (formato 24h)
        'days' => (int) env('CLEANUP_LOGS_DAYS', 7), // Días de antigüedad
        'dry_run' => env('CLEANUP_LOGS_DRY_RUN', true), // Modo prueba por defecto
    ],

    /*
    |--------------------------------------------------------------------------
    | Optimización de Base de Datos
    |--------------------------------------------------------------------------
    */
    'optimize_database' => [
        'enabled' => env('OPTIMIZE_DB_ENABLED', false),
        'schedule' => env('OPTIMIZE_DB_SCHEDULE', 'weekly'), // weekly
        'day' => env('OPTIMIZE_DB_DAY', 'sunday'), // Día de la semana
        'time' => env('OPTIMIZE_DB_TIME', '04:00'), // Hora (formato 24h)
    ],

    /*
    |--------------------------------------------------------------------------
    | Reinicio Automático del Queue Worker
    |--------------------------------------------------------------------------
    */
    'queue_worker' => [
        'max_jobs' => (int) env('QUEUE_MAX_JOBS', 100), // Jobs antes de reiniciar
        'max_time' => (int) env('QUEUE_MAX_TIME', 3600), // Segundos (1 hora)
        'memory_limit' => (int) env('QUEUE_MEMORY_LIMIT', 512), // MB
        'timeout' => (int) env('QUEUE_TIMEOUT', 60), // Segundos por job
    ],

    /*
    |--------------------------------------------------------------------------
    | Notificaciones
    |--------------------------------------------------------------------------
    */
    'notifications' => [
        'enabled' => env('OPTIMIZATION_NOTIFICATIONS', true),
        'log_only' => env('OPTIMIZATION_LOG_ONLY', true), // Solo logs, sin emails
    ],
];
