<?php

namespace App\Console\Commands;

use App\Models\Setting;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/**
 * Activa cualquier plantilla de WhatsApp, comprobando antes en Meta que esté aprobada.
 *
 * Hace falta porque la sincronización solo puede APAGAR plantillas (para no resucitar
 * las que se retiraron a propósito, como hello_world o la cancelacion_de_cita rota) y
 * la interfaz no tiene interruptor. Sin esto, una plantilla nueva se quedaría aprobada
 * en Meta pero invisible para los asesores.
 *
 *   php artisan templates:activate cancelacion_de_cita_v2
 *   php artisan templates:activate cancelacion_de_cita_v2 --reemplaza=cancelacion_de_cita
 */
class ActivateTemplate extends Command
{
    protected $signature = 'templates:activate
                            {nombre : meta_template_name de la plantilla a activar}
                            {--reemplaza= : meta_template_name de la plantilla a desactivar en el mismo movimiento}';

    protected $description = 'Activa una plantilla de WhatsApp si Meta la tiene aprobada';

    public function handle(): int
    {
        $nombre = $this->argument('nombre');
        $tpl = DB::table('whatsapp_templates')->where('meta_template_name', $nombre)->first();

        if (! $tpl) {
            $this->error("No existe '{$nombre}' en whatsapp_templates.");
            $this->line('  Disponibles: '.DB::table('whatsapp_templates')->orderBy('meta_template_name')->pluck('meta_template_name')->implode(', '));

            return 1;
        }

        $token = Setting::get('whatsapp_token');
        if (! $token || ! $tpl->meta_template_id) {
            $this->error('Falta whatsapp_token o meta_template_id.');

            return 1;
        }

        // El estado que manda es el de Meta, no la copia local.
        $resp = Http::withToken($token)->get(
            "https://graph.facebook.com/v21.0/{$tpl->meta_template_id}",
            ['fields' => 'name,status,category']
        );

        if (! $resp->successful()) {
            $this->error("Meta ({$resp->status()}): ".json_encode($resp->json(), JSON_UNESCAPED_UNICODE));

            return 1;
        }

        $status = $resp->json('status') ?? 'DESCONOCIDO';
        $category = $resp->json('category') ?? $tpl->category;
        $this->line("Estado en Meta de {$nombre}: <info>{$status}</info> (categoría: <info>{$category}</info>)");

        DB::table('whatsapp_templates')->where('id', $tpl->id)
            ->update(['status' => $status, 'category' => $category, 'updated_at' => now()]);

        if ($status !== 'APPROVED') {
            $this->warn("No está aprobada ({$status}). No se activa nada. Vuelve a intentarlo más tarde.");

            return $status === 'REJECTED' ? 1 : 0;
        }

        $reemplaza = $this->option('reemplaza');

        DB::transaction(function () use ($tpl, $reemplaza) {
            if ($reemplaza) {
                DB::table('whatsapp_templates')->where('meta_template_name', $reemplaza)
                    ->update(['is_active' => 0, 'updated_at' => now()]);
            }
            DB::table('whatsapp_templates')->where('id', $tpl->id)
                ->update(['is_active' => 1, 'updated_at' => now()]);
        });

        $this->info("✓ {$nombre} ACTIVADA.");
        if ($reemplaza) {
            $this->line("  {$reemplaza} quedó desactivada.");
        }

        return 0;
    }
}
