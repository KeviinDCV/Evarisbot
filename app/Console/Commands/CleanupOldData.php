<?php

namespace App\Console\Commands;

use App\Models\Message;
use App\Models\Conversation;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CleanupOldData extends Command
{
    protected $signature = 'cleanup:old-data
                            {--days=30 : Días de antigüedad para limpiar jobs, caché y lotes}
                            {--dry-run : Ver qué se eliminaría sin hacerlo}';

    protected $description = 'Limpia datos antiguos de la base de datos para liberar memoria';

    public function handle(): int
    {
        $days = (int) $this->option('days');
        $dryRun = $this->option('dry-run');

        $this->info("🧹 Iniciando limpieza de datos antiguos (> {$days} días)...");
        
        if ($dryRun) {
            $this->warn('⚠️  Modo DRY-RUN: No se eliminará nada');
        }

        $this->newLine();

        try {
            $cutoffDate = now()->subDays($days);
            
            // 1. Mensajes y conversaciones: ESTE COMANDO YA NO LOS TOCA. NUNCA.
            //
            // El historial clínico de una conversación no caduca: un paciente puede
            // escribir meses después y el asesor necesita ver todo lo anterior.
            //
            // Aquí había un borrado de mensajes de conversaciones resueltas con más de
            // {--days} días. Una sola ejecución (hacia el 24-jun-2026) se llevó 135.206
            // mensajes: todo lo anterior al 25-may. Las conversaciones seguían en la
            // lista pero vacías, y los asesores abrían chats sin saber de qué les
            // hablaba el paciente. Se recuperaron el 30-jul desde una copia del 18-jun,
            // pero solo porque esa copia existía de casualidad.
            //
            // Después se dejó tras un flag --incluir-mensajes. No basta: un flag es una
            // invitación. Se elimina la capacidad entera. Si algún día hiciera falta
            // purgar mensajes, que sea un comando nuevo, escrito a conciencia, con copia
            // de seguridad verificada ANTES de borrar nada.
            //
            // El resto de la limpieza (jobs, caché, sesiones, lotes) no destruye datos
            // de negocio y sigue igual.
            $this->line('⏭️  Mensajes y conversaciones: NO se tocan nunca (por diseño)');

            // 2. Limpiar jobs completados
            $completedJobsCount = DB::table('jobs')
                ->where('created_at', '<', $cutoffDate->timestamp)
                ->count();
            
            if (!$dryRun && $completedJobsCount > 0) {
                DB::table('jobs')
                    ->where('created_at', '<', $cutoffDate->timestamp)
                    ->delete();
                $this->info("✅ Eliminados {$completedJobsCount} jobs completados");
            } else {
                $this->line("📊 Se eliminarían {$completedJobsCount} jobs completados");
            }

            // 3. Limpiar failed jobs antiguos (mantener últimos 7 días para debugging)
            $failedJobsQuery = DB::table('failed_jobs')
                ->where('failed_at', '<', now()->subDays(7));
            
            $failedJobsCount = $failedJobsQuery->count();
            
            if (!$dryRun && $failedJobsCount > 0) {
                $failedJobsQuery->delete();
                $this->info("✅ Eliminados {$failedJobsCount} failed jobs antiguos");
            } else {
                $this->line("📊 Se eliminarían {$failedJobsCount} failed jobs antiguos");
            }

            // 4. Limpiar job_batches completados
            $batchesCount = DB::table('job_batches')
                ->where('created_at', '<', $cutoffDate->timestamp)
                ->whereNotNull('finished_at')
                ->count();
            
            if (!$dryRun && $batchesCount > 0) {
                DB::table('job_batches')
                    ->where('created_at', '<', $cutoffDate->timestamp)
                    ->whereNotNull('finished_at')
                    ->delete();
                $this->info("✅ Eliminados {$batchesCount} batches completados");
            } else {
                $this->line("📊 Se eliminarían {$batchesCount} batches completados");
            }

            // 5. Limpiar sesiones expiradas
            $sessionsCount = DB::table('sessions')
                ->where('last_activity', '<', now()->subHours(2)->timestamp)
                ->count();
            
            if (!$dryRun && $sessionsCount > 0) {
                DB::table('sessions')
                    ->where('last_activity', '<', now()->subHours(2)->timestamp)
                    ->delete();
                $this->info("✅ Eliminadas {$sessionsCount} sesiones expiradas");
            } else {
                $this->line("📊 Se eliminarían {$sessionsCount} sesiones expiradas");
            }

            // 6. Limpiar caché expirado
            if (!$dryRun) {
                DB::table('cache')
                    ->where('expiration', '<', now()->timestamp)
                    ->delete();
                $this->info("✅ Caché expirado limpiado");
            } else {
                $cacheCount = DB::table('cache')
                    ->where('expiration', '<', now()->timestamp)
                    ->count();
                $this->line("📊 Se limpiarían {$cacheCount} entradas de caché expiradas");
            }

            // 7. Optimizar base de datos
            if (!$dryRun) {
                $driver = DB::connection()->getDriverName();
                
                if ($driver === 'sqlite') {
                    DB::statement('VACUUM');
                    $this->info("✅ Base de datos optimizada (VACUUM ejecutado)");
                } elseif ($driver === 'mysql') {
                    // Para MySQL/MariaDB
                    DB::statement('OPTIMIZE TABLE messages, conversations, jobs, failed_jobs, sessions, cache');
                    $this->info("✅ Base de datos optimizada (OPTIMIZE TABLE ejecutado)");
                }
            }

            $this->newLine();
            $this->info('✅ Limpieza completada exitosamente');
            
            Log::info('Cleanup ejecutado', [
                'days' => $days,
                'dry_run' => $dryRun,
                'jobs' => $completedJobsCount,
                'failed_jobs' => $failedJobsCount,
                'batches' => $batchesCount,
                'sessions' => $sessionsCount,
            ]);

            return Command::SUCCESS;
        } catch (\Exception $e) {
            $this->error('❌ Error: ' . $e->getMessage());
            Log::error('Error en cleanup', ['error' => $e->getMessage()]);
            return Command::FAILURE;
        }
    }
}
