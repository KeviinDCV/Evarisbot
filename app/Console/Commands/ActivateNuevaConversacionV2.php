<?php

namespace App\Console\Commands;

use App\Models\Setting;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/**
 * Activa la plantilla nueva_conversacion_v2 SOLO cuando Meta la haya aprobado.
 *
 * Consulta el estado real en Meta (no confía en la copia local). Si está APPROVED,
 * activa la v2 y desactiva la anterior en una transacción — el cambio en el selector
 * de "Nueva conversación" es atómico. Mientras Meta la tenga PENDING, no hace nada,
 * así que se puede correr las veces que haga falta sin riesgo.
 */
class ActivateNuevaConversacionV2 extends Command
{
    protected $signature = 'templates:activate-nueva-conversacion-v2 {--force : Activar aunque el estado local no sea APPROVED (usa el estado de Meta de todas formas)}';

    protected $description = 'Activa nueva_conversacion_v2 y desactiva la anterior, una vez Meta la aprueba';

    public function handle(): int
    {
        $v2 = DB::table('whatsapp_templates')->where('meta_template_name', 'nueva_conversacion_v2')->first();
        if (!$v2) {
            $this->error('No existe nueva_conversacion_v2 en la BD local.');
            return 1;
        }

        $token = Setting::get('whatsapp_token');
        if (!$token || !$v2->meta_template_id) {
            $this->error('Falta whatsapp_token o meta_template_id de la v2.');
            return 1;
        }

        // Estado autoritativo: preguntarle a Meta directamente por el id de la plantilla.
        $resp = Http::withToken($token)->get(
            "https://graph.facebook.com/v21.0/{$v2->meta_template_id}",
            ['fields' => 'name,status,category']
        );

        if (!$resp->successful()) {
            $this->error("Meta ({$resp->status()}): " . json_encode($resp->json(), JSON_UNESCAPED_UNICODE));
            return 1;
        }

        $status = $resp->json('status') ?? 'DESCONOCIDO';
        $this->line("Estado en Meta de nueva_conversacion_v2: <info>{$status}</info>");

        // Reflejar el estado real en la copia local siempre.
        DB::table('whatsapp_templates')->where('id', $v2->id)->update(['status' => $status, 'updated_at' => now()]);

        if ($status === 'REJECTED') {
            $this->error('Meta RECHAZÓ la plantilla. Revisa el texto en Meta Business Manager antes de reintentar.');
            return 1;
        }

        if ($status !== 'APPROVED' && !$this->option('force')) {
            $this->warn('Todavía no está aprobada. Vuelve a correr este comando más tarde. Nada que cambiar.');
            return 0;
        }

        // Cambio atómico: activar v2, desactivar la anterior.
        DB::transaction(function () use ($v2) {
            DB::table('whatsapp_templates')->where('meta_template_name', 'nueva_conversacion')->update(['is_active' => 0, 'updated_at' => now()]);
            DB::table('whatsapp_templates')->where('id', $v2->id)->update(['is_active' => 1, 'updated_at' => now()]);
        });

        $this->info('✓ nueva_conversacion_v2 ACTIVADA. La anterior quedó desactivada.');
        $this->line('  A partir de ahora, "Nueva conversación" usa el texto nuevo.');
        return 0;
    }
}
