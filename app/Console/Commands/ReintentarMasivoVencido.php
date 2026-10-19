<?php

namespace App\Console\Commands;

use App\Jobs\SendBulkMessageJob;
use App\Models\BulkSend;
use App\Models\BulkSendRecipient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Vuelve a encolar, en el MISMO envío masivo, solo a los destinatarios que no se intentaron porque venció el plazo del
 * envío («…has been attempted too many times.» o «…venció el plazo del envío masivo…»). No toca los fallidos reales
 * (sin WhatsApp, número inválido…) ni los enviados. Salen con el worker automático, al ritmo de siempre (~15 por minuto),
 * y el avance se ve en la misma pantalla del envío.
 *
 * Uso:  php artisan masivo:reintentar-vencidos 288            → solo muestra cuántos son y cuánto tardarían
 *       php artisan masivo:reintentar-vencidos 288 --aplicar  → los vuelve a encolar
 */
class ReintentarMasivoVencido extends Command
{
    protected $signature = 'masivo:reintentar-vencidos
        {id : ID del envío masivo}
        {--aplicar : Volver a encolarlos (sin esto solo muestra cuántos son)}';

    protected $description = 'Reintenta, en el mismo envío masivo, los destinatarios que quedaron sin intentar por plazo vencido';

    public function handle(): int
    {
        $bulk = BulkSend::find((int) $this->argument('id'));
        if (!$bulk) {
            $this->error('No existe ese envío masivo.');
            return self::FAILURE;
        }

        $vencidos = fn () => BulkSendRecipient::where('bulk_send_id', $bulk->id)
            ->where('status', 'failed')
            ->where(fn ($q) => $q->where('error', 'like', '%has been attempted too many times%')
                ->orWhere('error', 'like', '%venció el plazo del envío masivo%'));
        $n = $vencidos()->count();

        $this->info("Envío #{$bulk->id} «{$bulk->name}» · estado: {$bulk->status}");
        $this->line("  Enviados {$bulk->sent_count} · fallidos {$bulk->failed_count} · total {$bulk->total_recipients}");
        $this->line("  Sin intentar por plazo vencido: {$n} (los demás fallidos no se tocan)");
        $this->line('  Tardarían unos ' . (int) ceil($n * 4 / 60) . ' minutos (≈4 s por mensaje)');

        if ($n === 0) {
            $this->info('No hay nada que reintentar.');
            return self::SUCCESS;
        }
        if ($bulk->status === 'processing') {
            $this->error('Este envío sigue en proceso: espere a que termine.');
            return self::FAILURE;
        }
        if (BulkSend::where('status', 'processing')->where('id', '!=', $bulk->id)->exists()) {
            $this->error('Hay otro envío masivo en proceso: espere a que termine.');
            return self::FAILURE;
        }
        if (!$this->option('aplicar')) {
            $this->warn('Sin --aplicar: no se envió nada.');
            return self::SUCCESS;
        }

        $ids = $vencidos()->pluck('id')->all();
        $bulkId = (int) $bulk->id;

        DB::transaction(function () use ($bulk, $ids) {
            foreach (array_chunk($ids, 500) as $lote) {
                BulkSendRecipient::whereIn('id', $lote)->update(['status' => 'pending', 'error' => null, 'updated_at' => now()]);
            }
            $bulk->update([
                'status' => 'processing',
                'sent_count' => $bulk->recipients()->where('status', 'sent')->count(),
                'failed_count' => $bulk->recipients()->where('status', 'failed')->count(),
            ]);
        });

        // Igual que BulkSendController::start: lote vacío primero, luego los trabajos de a 100; al terminar se
        // reconcilian los contadores desde los destinatarios reales.
        $batch = Bus::batch([])
            ->name('Reintento por plazo vencido: ' . ($bulk->name ?? $bulk->template_name))
            ->allowFailures()
            ->finally(function ($batch) use ($bulkId) {
                $bs = BulkSend::find($bulkId);
                if ($bs) {
                    $bs->update([
                        'status' => 'completed',
                        'sent_count' => $bs->recipients()->where('status', 'sent')->count(),
                        'failed_count' => $bs->recipients()->where('status', 'failed')->count(),
                    ]);
                }
                Log::info('Reintento de envío masivo completado', ['bulk_send_id' => $bulkId, 'batch_id' => $batch->id]);
            })
            ->dispatch();
        $bulk->update(['batch_id' => $batch->id]);

        foreach (array_chunk($ids, 100) as $lote) {
            $batch->add(array_map(fn ($id) => new SendBulkMessageJob((int) $id, $bulkId), $lote));
        }

        Log::info('Reintento de envío masivo (plazo vencido) encolado', ['bulk_send_id' => $bulkId, 'destinatarios' => count($ids)]);
        $this->info('Listo: ' . count($ids) . ' destinatarios en cola. Salen con el worker automático; el avance se ve en la pantalla del envío.');

        return self::SUCCESS;
    }
}
