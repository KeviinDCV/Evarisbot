<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Actualizar el paso 'rejected' para que resetee el flujo en vez de completarlo
        DB::table('welcome_flow_steps')
            ->where('step_key', 'rejected')
            ->update([
                'next_step_on_text' => '__reset__',
                'message' => "Entendemos tu decisión. Sin la aceptación de la política de tratamiento de datos no podemos continuar con el servicio.\n\nSi cambias de opinión o necesitas algo, vuelve a escribirnos y con gusto te atenderemos. 😊\n\n_HUV - Evaristo García_ 💙",
            ]);

        // Resetear conversaciones que quedaron atrapadas en el paso 'rejected'
        // para que al escribir de nuevo, inicien el flujo desde 0
        DB::table('conversations')
            ->where('welcome_flow_step', 'rejected')
            ->update([
                'welcome_flow_step' => null,
                'welcome_flow_completed' => false,
                'welcome_flow_data' => null,
            ]);
    }

    public function down(): void
    {
        DB::table('welcome_flow_steps')
            ->where('step_key', 'rejected')
            ->update([
                'next_step_on_text' => '__complete__',
                'message' => "Entendemos tu decisión. Sin la aceptación de la política de tratamiento de datos no podemos continuar con el servicio.\n\nSi cambias de opinión, puedes escribirnos nuevamente.\n\n_HUV - Evaristo García_ 💙",
            ]);
    }
};
