<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $flow = DB::table('welcome_flows')->where('name', 'Menú de Bienvenida HUV')->first();
        if (!$flow) {
            return;
        }

        // 1. Documento tipo "Otro" → preguntar cuál
        // Actualizar next_steps del paso document_type
        DB::table('welcome_flow_steps')
            ->where('step_key', 'document_type')
            ->where('welcome_flow_id', $flow->id)
            ->update([
                'next_steps' => json_encode([
                    'doc_cc' => 'document_number',
                    'doc_ti' => 'document_number',
                    'doc_other' => 'document_type_other',
                ]),
            ]);

        // Crear paso intermedio para tipo de documento "Otro"
        $exists = DB::table('welcome_flow_steps')
            ->where('step_key', 'document_type_other')
            ->where('welcome_flow_id', $flow->id)
            ->exists();

        if (!$exists) {
            DB::table('welcome_flow_steps')->insert([
                'welcome_flow_id' => $flow->id,
                'step_key' => 'document_type_other',
                'order' => 4,
                'message' => '¿Cuál es el tipo de documento? Escríbelo por favor:',
                'message_type' => 'wait_response',
                'next_step_on_text' => 'document_number',
                'is_entry_point' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // 2. EPS "Otro" → preguntar cuál
        // Actualizar next_steps del paso eps_selection
        $epsStep = DB::table('welcome_flow_steps')
            ->where('step_key', 'eps_selection')
            ->where('welcome_flow_id', $flow->id)
            ->first();

        if ($epsStep) {
            $nextSteps = json_decode($epsStep->next_steps, true) ?? [];
            $nextSteps['eps_otro'] = 'eps_other';
            DB::table('welcome_flow_steps')
                ->where('id', $epsStep->id)
                ->update(['next_steps' => json_encode($nextSteps)]);
        }

        // Crear paso intermedio para EPS "Otro"
        $exists = DB::table('welcome_flow_steps')
            ->where('step_key', 'eps_other')
            ->where('welcome_flow_id', $flow->id)
            ->exists();

        if (!$exists) {
            DB::table('welcome_flow_steps')->insert([
                'welcome_flow_id' => $flow->id,
                'step_key' => 'eps_other',
                'order' => 7,
                'message' => '¿Cuál es tu EPS? Escríbela por favor:',
                'message_type' => 'wait_response',
                'next_step_on_text' => 'regimen',
                'is_entry_point' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        $flow = DB::table('welcome_flows')->where('name', 'Menú de Bienvenida HUV')->first();
        if (!$flow) {
            return;
        }

        // Restaurar document_type
        DB::table('welcome_flow_steps')
            ->where('step_key', 'document_type')
            ->where('welcome_flow_id', $flow->id)
            ->update([
                'next_steps' => json_encode([
                    'doc_cc' => 'document_number',
                    'doc_ti' => 'document_number',
                    'doc_other' => 'document_number',
                ]),
            ]);

        // Restaurar eps_selection
        $epsStep = DB::table('welcome_flow_steps')
            ->where('step_key', 'eps_selection')
            ->where('welcome_flow_id', $flow->id)
            ->first();

        if ($epsStep) {
            $nextSteps = json_decode($epsStep->next_steps, true) ?? [];
            $nextSteps['eps_otro'] = 'regimen';
            DB::table('welcome_flow_steps')
                ->where('id', $epsStep->id)
                ->update(['next_steps' => json_encode($nextSteps)]);
        }

        // Eliminar pasos intermedios
        DB::table('welcome_flow_steps')
            ->where('welcome_flow_id', $flow->id)
            ->whereIn('step_key', ['document_type_other', 'eps_other'])
            ->delete();
    }
};
