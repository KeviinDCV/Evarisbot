<?php

namespace App\Console\Commands;

use App\Models\Setting;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Copia de seguridad de la base `evarisbot` (mysqldump comprimido con gzip).
 *
 * - --single-transaction: no bloquea las tablas (todas son InnoDB); la app sigue atendiendo.
 * - Usa el usuario de base de datos de la app (evarisbot_app); las credenciales van en un archivo
 *   temporal que se borra al terminar, nunca en la línea de comandos.
 * - Guarda en la carpeta "Respaldos Evarisbot" (acceso solo para el sistema y el usuario del servidor),
 *   con su huella SHA-256, y conserva 7 copias diarias, 4 semanales (domingos) y 12 mensuales (día 1).
 * - Lo programa una tarea de Windows cada noche. Llevar las copias FUERA del servidor (USB/NAS de TI)
 *   sigue pendiente: si el disco falla, estas copias se pierden con él.
 *
 * Restaurar (en otro equipo o en una base nueva):
 *   gzip -dc evarisbot-AAAA-MM-DD.sql.gz | mysql -u root nombre_de_base_nueva
 */
class RespaldoBase extends Command
{
    public const KEY_FOLDER = 'respaldo_carpeta';

    public const KEY_LAST_OK = 'respaldo:ultimo_ok';

    private const DEFAULT_FOLDER = 'C:\\Users\\Kechavarro\\Documents\\Respaldos Evarisbot';

    private const MYSQLDUMP = 'C:\\xampp\\mysql\\bin\\mysqldump.exe';

    protected $signature = 'respaldo:base {--sin-rotar : No borrar copias viejas}';

    protected $description = 'Copia de seguridad comprimida de la base de datos (no bloquea la app)';

    public function handle(): int
    {
        $folder = rtrim((string) (Setting::get(self::KEY_FOLDER) ?: self::DEFAULT_FOLDER), '\\/');
        if (! is_dir($folder) && ! @mkdir($folder, 0700, true)) {
            return $this->fail_("No existe ni se pudo crear la carpeta de respaldos: {$folder}");
        }

        $db = config('database.connections.'.config('database.default'));
        $date = now('America/Bogota')->format('Y-m-d');
        $final = "{$folder}\\evarisbot-{$date}.sql.gz";
        $partial = $final.'.parcial';

        // Credenciales en un archivo temporal (no en la línea de comandos, que la ve cualquier proceso).
        $cnf = tempnam(storage_path('app/private'), 'cnf');
        file_put_contents($cnf, "[client]\nuser=\"{$db['username']}\"\npassword=\"{$db['password']}\"\nhost=\"{$db['host']}\"\nport={$db['port']}\n");

        $started = microtime(true);
        try {
            $cmd = '"'.self::MYSQLDUMP.'" --defaults-extra-file="'.$cnf.'" --single-transaction --quick --no-tablespaces'
                .' --routines --triggers --events --default-character-set=utf8mb4 --databases '.escapeshellarg($db['database']);

            $proc = proc_open($cmd, [1 => ['pipe', 'wb'], 2 => ['pipe', 'w']], $pipes);
            if (! is_resource($proc)) {
                return $this->fail_('No se pudo iniciar mysqldump.');
            }

            $gz = gzopen($partial, 'wb6');
            $tail = '';
            $bytes = 0;
            while (! feof($pipes[1])) {
                $chunk = fread($pipes[1], 1 << 20);
                if ($chunk === false || $chunk === '') {
                    continue;
                }
                gzwrite($gz, $chunk);
                $bytes += strlen($chunk);
                $tail = substr($tail.$chunk, -300);
            }
            gzclose($gz);
            $stderr = stream_get_contents($pipes[2]);
            fclose($pipes[1]);
            fclose($pipes[2]);
            $exit = proc_close($proc);
        } finally {
            @unlink($cnf);
        }

        if ($exit !== 0 || ! str_contains($tail, 'Dump completed')) {
            @unlink($partial);

            return $this->fail_('mysqldump terminó con error (código '.$exit.'): '.trim(substr((string) $stderr, 0, 300)));
        }

        // Comprobar que el comprimido se puede leer entero antes de darlo por bueno.
        $check = gzopen($partial, 'rb');
        while (! gzeof($check)) {
            if (gzread($check, 1 << 20) === false) {
                gzclose($check);
                @unlink($partial);

                return $this->fail_('El archivo comprimido quedó dañado.');
            }
        }
        gzclose($check);

        @unlink($final);
        rename($partial, $final);
        $hash = hash_file('sha256', $final);
        file_put_contents($final.'.sha256', $hash.'  '.basename($final)."\n");

        $info = [
            'archivo' => basename($final),
            'sql_mb' => round($bytes / 1048576, 1),
            'gz_mb' => round(filesize($final) / 1048576, 1),
            'segundos' => round(microtime(true) - $started, 1),
            'sha256' => substr($hash, 0, 16),
        ];
        Cache::forever(self::KEY_LAST_OK, now()->toIso8601String());
        $this->log()->info('Respaldo correcto', $info);
        $this->info('Respaldo correcto: '.json_encode($info, JSON_UNESCAPED_UNICODE));

        if (! $this->option('sin-rotar')) {
            $this->rotate($folder);
        }

        return self::SUCCESS;
    }

    /** Conserva 7 diarias, 4 semanales (domingo) y 12 mensuales (día 1); nunca borra la de hoy. */
    private function rotate(string $folder): void
    {
        $files = glob($folder.'\\evarisbot-*.sql.gz') ?: [];
        $byDate = [];
        foreach ($files as $f) {
            if (preg_match('/evarisbot-(\d{4}-\d{2}-\d{2})\.sql\.gz$/', $f, $m)) {
                $byDate[$m[1]] = $f;
            }
        }
        krsort($byDate);

        $keep = [];
        $daily = $weekly = $monthly = 0;
        foreach ($byDate as $date => $f) {
            $d = Carbon::parse($date);
            if ($daily < 7) {
                $keep[$date] = true;
                $daily++;
            }
            if ($d->isSunday() && $weekly < 4) {
                $keep[$date] = true;
                $weekly++;
            }
            if ($d->day === 1 && $monthly < 12) {
                $keep[$date] = true;
                $monthly++;
            }
        }

        foreach ($byDate as $date => $f) {
            if (! isset($keep[$date])) {
                @unlink($f);
                @unlink($f.'.sha256');
                $this->log()->info('Respaldo viejo eliminado por rotación', ['archivo' => basename($f)]);
            }
        }
    }

    private function fail_(string $message): int
    {
        $this->log()->error('Respaldo FALLIDO: '.$message);
        Log::critical('Respaldo de la base FALLIDO: '.$message);
        $this->error($message);

        return self::FAILURE;
    }

    private function log()
    {
        return Log::build(['driver' => 'daily', 'path' => storage_path('logs/respaldos.log'), 'days' => 90]);
    }
}
