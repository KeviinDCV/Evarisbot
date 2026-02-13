<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Agregar índices para mejorar rendimiento de consultas de estadísticas
     */
    public function up(): void
    {
        // Helper para agregar índice solo si la tabla y el índice no existen
        $addIndexIfNotExists = function($table, $columns, $name = null) {
            if (!Schema::hasTable($table)) {
                return; // Skip if table doesn't exist yet
            }

            $columns = is_array($columns) ? $columns : [$columns];
            $indexName = $name ?? $table . '_' . implode('_', $columns) . '_index';
            
            $exists = DB::select("SHOW INDEX FROM {$table} WHERE Key_name = ?", [$indexName]);
            
            if (empty($exists)) {
                Schema::table($table, function (Blueprint $blueprint) use ($columns, $indexName) {
                    $blueprint->index($columns, $indexName);
                });
            }
        };

        // Índices para messages
        $addIndexIfNotExists('messages', 'status');
        $addIndexIfNotExists('messages', ['status', 'created_at'], 'messages_status_created_at_idx');

        // Índices para appointments
        $addIndexIfNotExists('appointments', 'reminder_status');
        $addIndexIfNotExists('appointments', 'reminder_sent');
        $addIndexIfNotExists('appointments', ['reminder_status', 'created_at'], 'appointments_reminder_status_created_idx');

        // Índices para conversations  
        $addIndexIfNotExists('conversations', 'status');
        $addIndexIfNotExists('conversations', 'unread_count');
        $addIndexIfNotExists('conversations', ['status', 'created_at'], 'conversations_status_created_at_idx');

        // Índices para users
        $addIndexIfNotExists('users', 'role');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No eliminamos índices en rollback para evitar problemas
    }
};
