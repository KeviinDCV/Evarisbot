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

        // ==========================================
        // 1. Cambiar document_number → full_name (en vez de eps_selection)
        // ==========================================
        DB::table('welcome_flow_steps')
            ->where('step_key', 'document_number')
            ->where('welcome_flow_id', $flow->id)
            ->update(['next_step_on_text' => 'full_name']);

        // ==========================================
        // 2. Crear los 3 nuevos pasos: full_name, phone_number, email
        // ==========================================
        $newSteps = [
            [
                'welcome_flow_id' => $flow->id,
                'step_key' => 'full_name',
                'order' => 6,
                'message' => 'Ingresa tu *nombre completo*:',
                'message_type' => 'wait_response',
                'next_step_on_text' => 'phone_number',
                'is_entry_point' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'welcome_flow_id' => $flow->id,
                'step_key' => 'phone_number',
                'order' => 7,
                'message' => 'Ingresa tu *número de contacto telefónico*:',
                'message_type' => 'wait_response',
                'next_step_on_text' => 'email',
                'is_entry_point' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'welcome_flow_id' => $flow->id,
                'step_key' => 'email',
                'order' => 8,
                'message' => 'Ingresa tu *correo electrónico*:',
                'message_type' => 'wait_response',
                'next_step_on_text' => 'eps_selection',
                'is_entry_point' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ];

        foreach ($newSteps as $step) {
            $exists = DB::table('welcome_flow_steps')
                ->where('step_key', $step['step_key'])
                ->where('welcome_flow_id', $flow->id)
                ->exists();

            if (!$exists) {
                DB::table('welcome_flow_steps')->insert($step);
            }
        }

        // ==========================================
        // 3. Actualizar agendamiento_info: ya no completa, sino lleva a sub-menú
        // ==========================================
        DB::table('welcome_flow_steps')
            ->where('step_key', 'agendamiento_info')
            ->where('welcome_flow_id', $flow->id)
            ->update([
                'message' => "📅 *AGENDAMIENTO DE CITA*\n\nPara agendar o reprogramar cita por favor suministre la siguiente información:\n\n📄 Documento de identidad del paciente\n📋 Autorización Vigente\n📝 Orden Médica\n🏥 Historia Clínica\n👤 Nombre de quien solicita y parentesco\n\n⚠️ *ENVIAR EN UN SOLO PDF TODA LA INFORMACIÓN COMPLETA*",
                'next_step_on_text' => 'agendamiento_submenu',
            ]);

        // ==========================================
        // 4. Crear sub-menú de agendamiento (8 opciones)
        // ==========================================
        $exists = DB::table('welcome_flow_steps')
            ->where('step_key', 'agendamiento_submenu')
            ->where('welcome_flow_id', $flow->id)
            ->exists();

        if (!$exists) {
            DB::table('welcome_flow_steps')->insert([
                'welcome_flow_id' => $flow->id,
                'step_key' => 'agendamiento_submenu',
                'order' => 15,
                'message' => 'Por favor seleccione la opción asociada al servicio:',
                'message_type' => 'interactive_list',
                'options' => json_encode([
                    'button_text' => 'Ver servicios',
                    'sections' => [
                        [
                            'title' => 'Servicios de agendamiento',
                            'rows' => [
                                ['id' => 'agenda_especializada', 'title' => 'Medicina especializada'],
                                ['id' => 'agenda_anestesia', 'title' => 'Cita de anestesia'],
                                ['id' => 'agenda_colposcopia', 'title' => 'Colposcopia/conización'],
                                ['id' => 'agenda_cistoscopia', 'title' => 'Cistoscopia/urodinamia'],
                                ['id' => 'agenda_cirugia', 'title' => 'Programación de cirugía'],
                                ['id' => 'agenda_particular', 'title' => 'Cita particular'],
                                ['id' => 'agenda_recordatorio', 'title' => 'Recordatorios de citas'],
                                ['id' => 'agenda_cancelacion', 'title' => 'Cancelación de servicios'],
                            ],
                        ],
                    ],
                ]),
                'next_steps' => json_encode([
                    'agenda_especializada' => '__complete_assign_advisor__',
                    'agenda_anestesia' => '__complete_assign_advisor__',
                    'agenda_colposcopia' => '__complete_assign_advisor__',
                    'agenda_cistoscopia' => '__complete_assign_advisor__',
                    'agenda_cirugia' => '__complete_assign_advisor__',
                    'agenda_particular' => '__complete_assign_advisor__',
                    'agenda_recordatorio' => '__complete_assign_advisor__',
                    'agenda_cancelacion' => '__complete_assign_advisor__',
                ]),
                'fallback_message' => 'Por favor, selecciona una opción del menú de servicios.',
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

        // Revertir document_number → eps_selection
        DB::table('welcome_flow_steps')
            ->where('step_key', 'document_number')
            ->where('welcome_flow_id', $flow->id)
            ->update(['next_step_on_text' => 'eps_selection']);

        // Eliminar nuevos pasos
        DB::table('welcome_flow_steps')
            ->where('welcome_flow_id', $flow->id)
            ->whereIn('step_key', ['full_name', 'phone_number', 'email', 'agendamiento_submenu'])
            ->delete();

        // Revertir agendamiento_info
        DB::table('welcome_flow_steps')
            ->where('step_key', 'agendamiento_info')
            ->where('welcome_flow_id', $flow->id)
            ->update([
                'message' => "📅 *AGENDAMIENTO DE CITA*\n\nPara agendar o reprogramar cita por favor suministre la siguiente información:\n\n📄 Documento de identidad del paciente\n📋 Autorización Vigente\n📝 Orden Médica\n🏥 Historia Clínica\n👤 Nombre de quien solicita y parentesco\n\n⚠️ *ENVIAR EN UN SOLO PDF TODA LA INFORMACIÓN COMPLETA*\n\nPuede enviar sus documentos a continuación:",
                'next_step_on_text' => '__complete__',
            ]);
    }
};
