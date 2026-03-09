<?php

namespace Database\Seeders;

use App\Models\WelcomeFlow;
use App\Models\WelcomeFlowStep;
use Illuminate\Database\Seeder;

class WelcomeFlowSeeder extends Seeder
{
    public function run(): void
    {
        // Limpiar datos existentes
        WelcomeFlowStep::query()->delete();
        WelcomeFlow::query()->delete();

        // Crear el flujo principal
        $flow = WelcomeFlow::create([
            'name' => 'Menú de Bienvenida HUV',
            'message' => "¡HOLA! 👋, Soy *Evarisbot* asistente virtual del *Hospital Universitario del Valle* 70 años latiendo juntos.",
            'buttons' => null,
            'responses' => null,
            'is_active' => false,
            'trigger_type' => 'first_contact',
        ]);

        // =============================================
        // PASO 1: Mensaje de bienvenida con política de datos
        // =============================================
        WelcomeFlowStep::create([
            'welcome_flow_id' => $flow->id,
            'step_key' => 'welcome',
            'order' => 1,
            'message' => "¡HOLA! 👋, Soy *Evarisbot* asistente virtual del *Hospital Universitario del Valle* 70 años latiendo juntos. Te doy la bienvenida a nuestro canal digital, gracias por contactarte con nosotros.\n\nDe acuerdo al cumplimiento de la Ley estatutaria 1581 de 2012 de protección de datos. El HUV te informa que los datos serán tratados de acuerdo a nuestras políticas de tratamiento de datos, recuerda que puedes consultar tus derechos como titular ingresando aquí: https://www.huv.gov.co/politicas/\n\nPara continuar elige:",
            'message_type' => 'interactive_buttons',
            'buttons' => [
                ['id' => 'accept_privacy', 'title' => '✅ Acepto'],
                ['id' => 'reject_privacy', 'title' => '❌ No acepto'],
            ],
            'next_steps' => [
                'accept_privacy' => 'document_type',
                'reject_privacy' => 'rejected',
            ],
            'fallback_message' => 'Por favor, selecciona una de las opciones disponibles: *✅ Acepto* o *❌ No acepto*.',
            'is_entry_point' => true,
        ]);

        // =============================================
        // PASO 1B: Rechazo de política (resetea el flujo)
        // Al escribir nuevamente, el flujo inicia desde 0
        // =============================================
        WelcomeFlowStep::create([
            'welcome_flow_id' => $flow->id,
            'step_key' => 'rejected',
            'order' => 2,
            'message' => "Entendemos tu decisión. Sin la aceptación de la política de tratamiento de datos no podemos continuar con el servicio.\n\nSi cambias de opinión o necesitas algo, vuelve a escribirnos y con gusto te atenderemos. 😊\n\n_HUV - Evaristo García_ 💙",
            'message_type' => 'text',
            'next_step_on_text' => '__reset__',
            'is_entry_point' => false,
        ]);

        // =============================================
        // PASO 2: Selección de tipo de documento
        // =============================================
        WelcomeFlowStep::create([
            'welcome_flow_id' => $flow->id,
            'step_key' => 'document_type',
            'order' => 3,
            'message' => "Selecciona el tipo de documento del usuario que necesita el servicio:",
            'message_type' => 'interactive_buttons',
            'buttons' => [
                ['id' => 'doc_cc', 'title' => '🪪 Cédula'],
                ['id' => 'doc_ti', 'title' => '📋 Tarjeta Identidad'],
                ['id' => 'doc_other', 'title' => '📄 Otro'],
            ],
            'next_steps' => [
                'doc_cc' => 'document_number',
                'doc_ti' => 'document_number',
                'doc_other' => 'document_type_other',
            ],
            'fallback_message' => 'Por favor, selecciona el tipo de documento usando los botones disponibles.',
            'is_entry_point' => false,
        ]);

        // =============================================
        // PASO 2B: Tipo de documento "Otro" - ¿Cuál?
        // =============================================
        WelcomeFlowStep::create([
            'welcome_flow_id' => $flow->id,
            'step_key' => 'document_type_other',
            'order' => 4,
            'message' => "¿Cuál es el tipo de documento? Escríbelo por favor:",
            'message_type' => 'wait_response',
            'next_step_on_text' => 'document_number',
            'is_entry_point' => false,
        ]);

        // =============================================
        // PASO 3: Ingresar número de documento (texto libre)
        // =============================================
        WelcomeFlowStep::create([
            'welcome_flow_id' => $flow->id,
            'step_key' => 'document_number',
            'order' => 5,
            'message' => "Por favor ingresa el número de documento de identificación *sin puntos, comas o cualquier otro carácter*:",
            'message_type' => 'wait_response',
            'next_step_on_text' => 'full_name',
            'is_entry_point' => false,
        ]);

        // =============================================
        // PASO 4: Nombre completo
        // =============================================
        WelcomeFlowStep::create([
            'welcome_flow_id' => $flow->id,
            'step_key' => 'full_name',
            'order' => 6,
            'message' => "Ingresa tu *nombre completo*:",
            'message_type' => 'wait_response',
            'next_step_on_text' => 'phone_number',
            'is_entry_point' => false,
        ]);

        // =============================================
        // PASO 5: Número de contacto telefónico
        // =============================================
        WelcomeFlowStep::create([
            'welcome_flow_id' => $flow->id,
            'step_key' => 'phone_number',
            'order' => 7,
            'message' => "Ingresa tu *número de contacto telefónico*:",
            'message_type' => 'wait_response',
            'next_step_on_text' => 'email',
            'is_entry_point' => false,
        ]);

        // =============================================
        // PASO 6: Correo electrónico
        // =============================================
        WelcomeFlowStep::create([
            'welcome_flow_id' => $flow->id,
            'step_key' => 'email',
            'order' => 8,
            'message' => "Ingresa tu *correo electrónico*:",
            'message_type' => 'wait_response',
            'next_step_on_text' => 'eps_selection',
            'is_entry_point' => false,
        ]);

        // =============================================
        // PASO 7: Selección de EPS (lista interactiva)
        // =============================================
        WelcomeFlowStep::create([
            'welcome_flow_id' => $flow->id,
            'step_key' => 'eps_selection',
            'order' => 9,
            'message' => "Elige la Opción de EPS:",
            'message_type' => 'interactive_list',
            'options' => [
                'button_text' => 'Seleccionar EPS',
                'sections' => [
                    [
                        'title' => 'EPS Disponibles',
                        'rows' => [
                            ['id' => 'eps_nueva_eps', 'title' => 'NUEVA EPS'],
                            ['id' => 'eps_coosalud', 'title' => 'COOSALUD'],
                            ['id' => 'eps_emssanar', 'title' => 'EMSSANAR'],
                            ['id' => 'eps_sura', 'title' => 'SURA'],
                            ['id' => 'eps_sanitas', 'title' => 'SANITAS'],
                            ['id' => 'eps_salud_total', 'title' => 'SALUD TOTAL'],
                            ['id' => 'eps_comfenalco', 'title' => 'COMFENALCO'],
                            ['id' => 'eps_famisanar', 'title' => 'FAMISANAR'],
                            ['id' => 'eps_sos', 'title' => 'SOS'],
                            ['id' => 'eps_otro', 'title' => 'Otro'],
                        ],
                    ],
                ],
            ],
            'next_steps' => [
                'eps_nueva_eps' => 'regimen',
                'eps_coosalud' => 'regimen',
                'eps_emssanar' => 'regimen',
                'eps_sura' => 'regimen',
                'eps_sanitas' => 'regimen',
                'eps_salud_total' => 'regimen',
                'eps_comfenalco' => 'regimen',
                'eps_famisanar' => 'regimen',
                'eps_sos' => 'regimen',
                'eps_otro' => 'eps_other',
            ],
            'fallback_message' => 'Por favor, selecciona tu EPS de la lista disponible.',
            'is_entry_point' => false,
        ]);

        // =============================================
        // PASO 7B: EPS "Otro" - ¿Cuál?
        // =============================================
        WelcomeFlowStep::create([
            'welcome_flow_id' => $flow->id,
            'step_key' => 'eps_other',
            'order' => 10,
            'message' => "¿Cuál es tu EPS? Escríbela por favor:",
            'message_type' => 'wait_response',
            'next_step_on_text' => 'regimen',
            'is_entry_point' => false,
        ]);

        // =============================================
        // PASO 8: Régimen
        // =============================================
        WelcomeFlowStep::create([
            'welcome_flow_id' => $flow->id,
            'step_key' => 'regimen',
            'order' => 11,
            'message' => "Régimen\n\nElige la Opción:",
            'message_type' => 'interactive_buttons',
            'buttons' => [
                ['id' => 'regimen_subsidiado', 'title' => 'Subsidiado'],
                ['id' => 'regimen_contributivo', 'title' => 'Contributivo'],
            ],
            'next_steps' => [
                'regimen_subsidiado' => 'service_menu',
                'regimen_contributivo' => 'service_menu',
            ],
            'fallback_message' => 'Por favor, selecciona el régimen usando los botones disponibles.',
            'is_entry_point' => false,
        ]);

        // =============================================
        // PASO 9: Menú de servicios (lista interactiva - 4 opciones)
        // =============================================
        WelcomeFlowStep::create([
            'welcome_flow_id' => $flow->id,
            'step_key' => 'service_menu',
            'order' => 12,
            'message' => "¿En qué podemos ayudarte? Selecciona una opción:",
            'message_type' => 'interactive_list',
            'options' => [
                'button_text' => 'Ver opciones',
                'sections' => [
                    [
                        'title' => 'Servicios disponibles',
                        'rows' => [
                            ['id' => 'svc_agendamiento', 'title' => '📅 Agendamiento de cita', 'description' => 'Agendar o reprogramar cita'],
                            ['id' => 'svc_cancelacion', 'title' => '❌ Cancelación de cita', 'description' => 'Cancelar cita existente'],
                            ['id' => 'svc_informacion', 'title' => 'ℹ️ Información', 'description' => 'Consultas e información general'],
                            ['id' => 'svc_asesor', 'title' => '👤 Hablar con un asesor', 'description' => 'Comunicarse con un agente'],
                        ],
                    ],
                ],
            ],
            'next_steps' => [
                'svc_agendamiento' => 'agendamiento_info',
                'svc_cancelacion' => 'cancelacion_info',
                'svc_informacion' => 'informacion_menu',
                'svc_asesor' => '__complete_assign_advisor__',
            ],
            'fallback_message' => 'Por favor, selecciona una opción del menú disponible.',
            'is_entry_point' => false,
        ]);

        // =============================================
        // PASO 10A: Agendamiento de cita - Info requisitos
        // =============================================
        WelcomeFlowStep::create([
            'welcome_flow_id' => $flow->id,
            'step_key' => 'agendamiento_info',
            'order' => 13,
            'message' => "📅 *AGENDAMIENTO DE CITA*\n\nPara agendar o reprogramar cita por favor suministre la siguiente información:\n\n📄 Documento de identidad del paciente\n📋 Autorización Vigente\n📝 Orden Médica\n🏥 Historia Clínica\n👤 Nombre de quien solicita y parentesco\n\n⚠️ *ENVIAR EN UN SOLO PDF TODA LA INFORMACIÓN COMPLETA*",
            'message_type' => 'text',
            'next_step_on_text' => 'agendamiento_submenu',
            'is_entry_point' => false,
        ]);

        // =============================================
        // PASO 10A-2: Sub-menú de agendamiento (8 opciones)
        // =============================================
        WelcomeFlowStep::create([
            'welcome_flow_id' => $flow->id,
            'step_key' => 'agendamiento_submenu',
            'order' => 14,
            'message' => "Por favor seleccione la opción asociada al servicio:",
            'message_type' => 'interactive_list',
            'options' => [
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
            ],
            'next_steps' => [
                'agenda_especializada' => '__complete_assign_advisor__',
                'agenda_anestesia' => '__complete_assign_advisor__',
                'agenda_colposcopia' => '__complete_assign_advisor__',
                'agenda_cistoscopia' => '__complete_assign_advisor__',
                'agenda_cirugia' => '__complete_assign_advisor__',
                'agenda_particular' => '__complete_assign_advisor__',
                'agenda_recordatorio' => '__complete_assign_advisor__',
                'agenda_cancelacion' => '__complete_assign_advisor__',
            ],
            'fallback_message' => 'Por favor, selecciona una opción del menú de servicios.',
            'is_entry_point' => false,
        ]);

        // =============================================
        // PASO 9B: Cancelación de cita - Info y requisitos
        // =============================================
        WelcomeFlowStep::create([
            'welcome_flow_id' => $flow->id,
            'step_key' => 'cancelacion_info',
            'order' => 15,
            'message' => "❌ *CANCELACIÓN DE CITA*\n\nPara la cancelación de cita por favor suministre la siguiente información:\n\n📄 Documento de identidad del paciente\n🏥 Especialidad de la cita a cancelar\n👤 Nombre Completo de quien cancela la cita\n📝 Motivo de cancelación\n👨‍👩‍👧 Parentesco\n\nPuede enviar la información a continuación:",
            'message_type' => 'text',
            'next_step_on_text' => '__complete__',
            'is_entry_point' => false,
        ]);

        // =============================================
        // PASO 9C: Información - Submenú
        // =============================================
        WelcomeFlowStep::create([
            'welcome_flow_id' => $flow->id,
            'step_key' => 'informacion_menu',
            'order' => 16,
            'message' => "ℹ️ *INFORMACIÓN*\n\nSelecciona el tipo de información que necesitas:",
            'message_type' => 'interactive_list',
            'options' => [
                'button_text' => 'Ver opciones',
                'sections' => [
                    [
                        'title' => 'Tipos de información',
                        'rows' => [
                            ['id' => 'info_recordatorio', 'title' => '🔔 Recordatorio de cita', 'description' => 'Consultar próximas citas'],
                            ['id' => 'info_resultados', 'title' => '📊 Resultados', 'description' => 'Consultar resultados médicos'],
                            ['id' => 'info_general', 'title' => '📋 Información general', 'description' => 'Otros servicios e información'],
                        ],
                    ],
                ],
            ],
            'next_steps' => [
                'info_recordatorio' => '__complete__',
                'info_resultados' => '__complete__',
                'info_general' => '__complete__',
            ],
            'fallback_message' => 'Por favor, selecciona una opción del menú de información.',
            'is_entry_point' => false,
        ]);

        // =============================================
        // PASO 9D: Hablar con un asesor - Pedir cédula
        // =============================================
        WelcomeFlowStep::create([
            'welcome_flow_id' => $flow->id,
            'step_key' => 'asesor_cedula',
            'order' => 17,
            'message' => "👤 *HABLAR CON UN ASESOR*\n\nPor favor digita tu número de cédula para conectarte con un asesor:",
            'message_type' => 'wait_response',
            'next_step_on_text' => '__complete_assign_advisor__',
            'is_entry_point' => false,
        ]);

        $stepCount = $flow->steps()->count();
        $this->command->info("✅ Flujo de bienvenida creado con {$stepCount} pasos.");
        $this->command->info("⚠️  El flujo está DESACTIVADO por defecto. Actívalo desde la sección de Plantillas cuando estés listo.");
    }
}
