<?php

namespace App\Console\Commands;

use App\Jobs\SendBulkMessageJob;
use App\Models\BulkSend;
use App\Models\BulkSendRecipient;
use App\Models\WhatsappTemplate;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ResendBulkSend extends Command
{
    protected $signature = 'bulksend:resend
        {id? : ID del envío masivo a reenviar}
        {--date-col=citfci : Columna de params para la fecha ({{2}})}
        {--time-col=cithor : Columna de params para la hora ({{3}})}
        {--dry-run : Mostrar qué se enviaría sin enviar nada}';

    protected $description = 'Reenvía un envío masivo con el mapeo de parámetros corregido (nombre, fecha, hora)';

    public function handle(): int
    {
        $id = $this->argument('id');

        if (!$id) {
            $this->listRecentSends();
            return self::SUCCESS;
        }

        $source = BulkSend::find($id);
        if (!$source) {
            $this->error("No se encontró el envío masivo con ID {$id}.");
            return self::FAILURE;
        }

        $dateCol = $this->option('date-col');
        $timeCol = $this->option('time-col');
        $dryRun = (bool) $this->option('dry-run');

        $recipients = $source->recipients()->get();
        if ($recipients->isEmpty()) {
            $this->error('Este envío no tiene destinatarios guardados.');
            return self::FAILURE;
        }

        $template = WhatsappTemplate::where('meta_template_name', $source->template_name)->first();
        $previewText = $template?->preview_text ?? '';

        // El comando arma un mapeo de 3 parámetros; abortar si la plantilla no encaja.
        preg_match_all('/\{\{(\d+)\}\}/', $previewText, $m);
        $placeholderCount = !empty($m[1]) ? count(array_unique($m[1])) : 0;
        if ($placeholderCount !== 3) {
            $this->error("La plantilla '{$source->template_name}' tiene {$placeholderCount} parámetro(s) detectado(s).");
            $this->error('Este comando solo reenvía plantillas de 3 parámetros: {{1}}=nombre, {{2}}=fecha, {{3}}=hora.');
            $this->line('Si la plantilla no está sincronizada, sincronícela desde Envío Masivo y reintente.');
            return self::FAILURE;
        }

        $this->info("Envío origen:  #{$source->id} — {$source->name}");
        $this->info("Plantilla:     {$source->template_name} ({$source->template_language})");
        $this->info("Destinatarios: {$recipients->count()}");
        $this->info("Mapeo:         {{1}}=nombre   {{2}}={$dateCol}   {{3}}={$timeCol}");
        $this->newLine();

        $rows = [];
        $missing = 0;
        foreach ($recipients as $r) {
            $params = $r->params ?? [];
            $date = trim((string) ($params[$dateCol] ?? ''));
            $time = trim((string) ($params[$timeCol] ?? ''));
            if ($date === '' || $time === '') {
                $missing++;
            }
            $rows[] = [
                $r->phone_number,
                $r->contact_name ?: '—',
                $date !== '' ? $date : '⚠ vacío',
                $time !== '' ? $time : '⚠ vacío',
            ];
        }

        $this->table(['Teléfono', 'Nombre {{1}}', "Fecha {{2}} ({$dateCol})", "Hora {{3}} ({$timeCol})"], $rows);

        if ($missing > 0) {
            $this->warn("{$missing} destinatario(s) tienen fecha u hora vacía. Verifique --date-col / --time-col.");
        }

        $first = $recipients->first();
        $fp = $first->params ?? [];
        $rendered = str_replace(
            ['{{1}}', '{{2}}', '{{3}}'],
            [$first->contact_name ?? '', $fp[$dateCol] ?? '', $fp[$timeCol] ?? ''],
            $previewText
        );
        $this->newLine();
        $this->info('Vista previa del mensaje (primer destinatario):');
        $this->line('────────────────────────────────────────');
        $this->line($rendered);
        $this->line('────────────────────────────────────────');
        $this->newLine();

        if ($dryRun) {
            $this->info('— Modo dry-run: no se envió ningún mensaje. —');
            return self::SUCCESS;
        }

        if (!$this->confirm("¿Reenviar {$recipients->count()} mensajes ahora con este mapeo?", false)) {
            $this->info('Cancelado. No se envió nada.');
            return self::SUCCESS;
        }

        // Nuevo envío masivo con el mapeo correcto; el job lee column_mapping y arma los params bien.
        $new = BulkSend::create([
            'name' => 'Reenvío corregido — ' . ($source->name ?? $source->template_name),
            'template_name' => $source->template_name,
            'template_params' => null,
            'column_mapping' => [
                '1' => ['source' => 'nombre'],
                '2' => ['source' => 'column', 'column' => $dateCol],
                '3' => ['source' => 'column', 'column' => $timeCol],
            ],
            'template_language' => $source->template_language ?? 'es_CO',
            'status' => 'processing',
            'total_recipients' => $recipients->count(),
            'sent_count' => 0,
            'failed_count' => 0,
            'created_by' => $source->created_by,
        ]);

        $newRecipientIds = [];
        foreach ($recipients as $r) {
            $newRecipientIds[] = BulkSendRecipient::create([
                'bulk_send_id' => $new->id,
                'phone_number' => $r->phone_number,
                'contact_name' => $r->contact_name,
                'params' => $r->params,
                'status' => 'pending',
            ])->id;
        }

        $this->info("Nuevo envío #{$new->id} creado. Enviando (≈3s por mensaje)...");
        $this->newLine();

        $total = count($newRecipientIds);
        $sent = 0;
        $failed = 0;

        foreach ($newRecipientIds as $i => $rid) {
            DB::reconnect();
            // Se ejecuta el job de envío en forma síncrona: reutiliza la lógica ya probada
            // (envío a Meta, registro en la conversación, control de estado).
            try {
                (new SendBulkMessageJob($rid, $new->id))->handle();
            } catch (\Throwable $e) {
                // El job ya marcó al destinatario como fallido antes de relanzar.
            }

            $r = BulkSendRecipient::find($rid);
            $label = $r->contact_name ?: $r->phone_number;
            $n = $i + 1;
            if ($r->status === 'sent') {
                $sent++;
                $this->line("  <fg=green>✓</> [{$n}/{$total}] {$label}");
            } else {
                $failed++;
                $this->line("  <fg=red>✗</> [{$n}/{$total}] {$label} — " . ($r->error ?: 'error desconocido'));
            }
        }

        $new->update([
            'status' => 'completed',
            'sent_count' => $new->recipients()->where('status', 'sent')->count(),
            'failed_count' => $new->recipients()->where('status', 'failed')->count(),
        ]);

        $this->newLine();
        $this->info("Reenvío completado: {$sent} enviados, {$failed} fallidos.");
        $this->info("Detalle en Envío Masivo → /admin/bulk-sends/{$new->id}");

        return self::SUCCESS;
    }

    private function listRecentSends(): void
    {
        $sends = BulkSend::orderByDesc('created_at')->limit(15)->get();
        if ($sends->isEmpty()) {
            $this->warn('No hay envíos masivos registrados.');
            return;
        }

        $this->info('Indique el ID del envío a reenviar. Envíos recientes:');
        $this->table(
            ['ID', 'Nombre', 'Plantilla', 'Total', 'Enviados', 'Fallidos', 'Fecha'],
            $sends->map(fn ($s) => [
                $s->id,
                $s->name,
                $s->template_name,
                $s->total_recipients,
                $s->sent_count,
                $s->failed_count,
                $s->created_at->format('Y-m-d H:i'),
            ])->toArray()
        );
        $this->newLine();
        $this->line('  php artisan bulksend:resend <ID> --dry-run   → previsualizar sin enviar');
        $this->line('  php artisan bulksend:resend <ID>             → reenviar');
    }
}
