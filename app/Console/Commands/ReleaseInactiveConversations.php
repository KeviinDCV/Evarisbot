<?php

namespace App\Console\Commands;

use App\Services\InactiveConversationReleaser;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Libera a mano las conversaciones cuyo asesor no respondió a tiempo (ver
 * InactiveConversationReleaser). En el día a día lo dispara solo la aplicación; este comando
 * sirve para revisar qué pasaría (--dry-run) o para forzar una pasada.
 */
class ReleaseInactiveConversations extends Command
{
    protected $signature = 'conversations:release-inactive
                            {--minutes= : Tiempo de espera en minutos (por defecto, el de Configuración)}
                            {--dry-run : Solo mostrar qué se liberaría, sin tocar nada}';

    protected $description = 'Desasigna las conversaciones en las que el paciente escribió y el asesor no respondió a tiempo';

    public function handle(InactiveConversationReleaser $releaser): int
    {
        $config = InactiveConversationReleaser::settings();
        $minutes = $this->option('minutes') !== null
            ? InactiveConversationReleaser::clampMinutes((int) $this->option('minutes'))
            : $config['minutes'];
        $dryRun = (bool) $this->option('dry-run');

        if (! $dryRun && ! $config['enabled'] && $this->option('minutes') === null) {
            $this->warn('La liberación automática está desactivada en Configuración. Usa --dry-run para ver qué haría.');

            return self::SUCCESS;
        }

        $candidates = $releaser->candidates($minutes);
        $this->info(sprintf('Tiempo de espera: %d min · %d conversación(es) %s.', $minutes, $candidates->count(), $dryRun ? 'se liberarían' : 'por liberar'));

        if ($dryRun) {
            $this->table(
                ['Conversación', 'Asesor (id)', 'Esperando desde (Bogotá)', 'Espera'],
                $candidates->take(50)->map(fn ($c) => [
                    $c->id,
                    $c->assigned_to,
                    Carbon::parse($c->waiting_since)->setTimezone('America/Bogota')->format('Y-m-d H:i'),
                    Carbon::parse($c->waiting_since)->diffForHumans(null, true),
                ])->all()
            );

            return self::SUCCESS;
        }

        $released = $releaser->release($minutes);
        $this->info("Liberadas: {$released}.");

        return self::SUCCESS;
    }
}
