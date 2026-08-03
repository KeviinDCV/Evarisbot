<?php

namespace App\Console\Commands;

use App\Models\Setting;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/**
 * Activa la plantilla saludo_asesor_v2 SOLO cuando Meta la haya aprobado.
 *
 * La v2 añade la llamada a responder ("Responda a este mensaje para poder continuar
 * con la gestión de su cita") y un botón de respuesta rápida. Con eso el paciente
 * abre la ventana de 24 h de un toque, y el asesor puede seguir escribiéndole gratis
 * en vez de depender de otra plantilla de pago.
 *
 * Además va como UTILITY, no MARKETING: no la frena el grupo de control de Meta
 * (error 130472) y cuesta 15 veces menos.
 *
 * Consulta el estado real en Meta, no la copia local. Mientras esté PENDING no hace
 * nada, así que se puede correr las veces que haga falta sin riesgo.
 */
class ActivateSaludoAsesorV2 extends Command
{
    protected $signature = 'templates:activate-saludo-asesor-v2 {--force : Activar aunque Meta no la dé por aprobada}';

    protected $description = 'Activa saludo_asesor_v2 y desactiva la anterior, una vez Meta la aprueba';

    public function handle(): int
    {
        $v2 = DB::table('whatsapp_templates')->where('meta_template_name', 'saludo_asesor_v2')->first();
        if (! $v2) {
            $this->error('No existe saludo_asesor_v2 en la BD local.');

            return 1;
        }

        $token = Setting::get('whatsapp_token');
        if (! $token || ! $v2->meta_template_id) {
            $this->error('Falta whatsapp_token o meta_template_id de la v2.');

            return 1;
        }

        // Estado autoritativo: preguntarle a Meta directamente por el id de la plantilla.
        $resp = Http::withToken($token)->get(
            "https://graph.facebook.com/v21.0/{$v2->meta_template_id}",
            ['fields' => 'name,status,category']
        );

        if (! $resp->successful()) {
            $this->error("Meta ({$resp->status()}): ".json_encode($resp->json(), JSON_UNESCAPED_UNICODE));

            return 1;
        }

        $status = $resp->json('status') ?? 'DESCONOCIDO';
        $category = $resp->json('category') ?? $v2->category;
        $this->line("Estado en Meta de saludo_asesor_v2: <info>{$status}</info> (categoría: <info>{$category}</info>)");

        // Reflejar el estado real en la copia local siempre.
        DB::table('whatsapp_templates')->where('id', $v2->id)
            ->update(['status' => $status, 'category' => $category, 'updated_at' => now()]);

        if ($status === 'REJECTED') {
            $this->error('Meta RECHAZÓ la plantilla. Revisa el texto en Meta Business Manager antes de reintentar.');

            return 1;
        }

        if ($status !== 'APPROVED' && ! $this->option('force')) {
            $this->warn('Todavía no está aprobada. Vuelve a correr este comando más tarde. Nada que cambiar.');

            return 0;
        }

        // Cambio atómico: activar v2, desactivar la anterior.
        DB::transaction(function () use ($v2) {
            DB::table('whatsapp_templates')->where('meta_template_name', 'saludo_asesor')->update(['is_active' => 0, 'updated_at' => now()]);
            DB::table('whatsapp_templates')->where('id', $v2->id)->update(['is_active' => 1, 'updated_at' => now()]);
        });

        $this->info('✓ saludo_asesor_v2 ACTIVADA. La anterior quedó desactivada.');
        $this->line('  El saludo del asesor ya pide al paciente que responda, y lleva botón "Continuar".');

        if ($category !== 'UTILITY') {
            $this->warn("  OJO: Meta la dejó como {$category}, no UTILITY. Sigue sujeta al grupo de control y a la tarifa alta.");
        }

        return 0;
    }
}
