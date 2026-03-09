<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Cambiar svc_asesor para que vaya directo a __complete_assign_advisor__
        // en vez de pasar por asesor_cedula (el usuario ya dio su documento antes)
        $step = DB::table('welcome_flow_steps')
            ->where('step_key', 'service_menu')
            ->first();

        if ($step && $step->next_steps) {
            $nextSteps = json_decode($step->next_steps, true);
            if (isset($nextSteps['svc_asesor'])) {
                $nextSteps['svc_asesor'] = '__complete_assign_advisor__';
                DB::table('welcome_flow_steps')
                    ->where('id', $step->id)
                    ->update(['next_steps' => json_encode($nextSteps)]);
            }
        }
    }

    public function down(): void
    {
        $step = DB::table('welcome_flow_steps')
            ->where('step_key', 'service_menu')
            ->first();

        if ($step && $step->next_steps) {
            $nextSteps = json_decode($step->next_steps, true);
            if (isset($nextSteps['svc_asesor'])) {
                $nextSteps['svc_asesor'] = 'asesor_cedula';
                DB::table('welcome_flow_steps')
                    ->where('id', $step->id)
                    ->update(['next_steps' => json_encode($nextSteps)]);
            }
        }
    }
};
