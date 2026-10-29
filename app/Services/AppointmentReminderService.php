<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Setting;
use App\Models\Tag;
use App\Support\Recordatorios;
use App\Support\WhatsAppErrorTranslator;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;

class AppointmentReminderService
{
    protected WhatsAppService $whatsappService;

    public function __construct(WhatsAppService $whatsappService)
    {
        $this->whatsappService = $whatsappService;
    }

    /**
     * Procesa el envío de recordatorios para el día
     */
    public function processReminders(): array
    {
        // Verificar si los recordatorios están habilitados. (Antes decía «!Setting::get(...) === 'true'», que por la
        // precedencia de operadores nunca era cierto: el interruptor no apagaba nada.)
        if (Setting::get('reminder_enabled', 'true') !== 'true') {
            Log::info('Recordatorios deshabilitados en configuración');
            return ['sent' => 0, 'failed' => 0, 'skipped' => 0];
        }

        // Por defecto 2 días: si hoy es 12/11, busca citas para 14/11 (pasado mañana)
        $daysInAdvance = (int) Setting::get('reminder_days_in_advance', '2');
        $maxPerDay = (int) Setting::get('reminder_max_per_day', '500');
        
        // Obtener citas que necesitan recordatorio
        $appointments = $this->getAppointmentsNeedingReminder($daysInAdvance, $maxPerDay);
        
        $sent = 0;
        $failed = 0;
        $skipped = 0;

        foreach ($appointments as $appointment) {
            try {
                // Validar número de teléfono
                if (empty($appointment->pactel) && empty($appointment->pactel2)) {
                    Log::warning("Cita sin teléfono", ['appointment_id' => $appointment->id]);
                    $skipped++;
                    continue;
                }

                // Enviar recordatorio
                $result = $this->sendReminder($appointment);
                
                if ($result['success']) {
                    $sent++;
                    Log::info("Recordatorio enviado", [
                        'appointment_id' => $appointment->id,
                        'phone' => $appointment->pactel,
                        'message_id' => $result['message_id']
                    ]);
                } elseif (($result['alcance'] ?? 'cita') === 'lote') {
                    // Plantilla, cuenta o límite: el resto también fallaría. Se para sin marcar ninguna cita.
                    Log::error('Recordatorios detenidos: el problema no es de las citas', ['error' => $result['error']]);
                    break;
                } else {
                    $failed++;
                    $appointment->markReminderFailed($result['error']);
                    Log::error("Error enviando recordatorio", [
                        'appointment_id' => $appointment->id,
                        'error' => $result['error']
                    ]);
                }
            } catch (\Exception $e) {
                $failed++;
                $appointment->markReminderFailed($e->getMessage());
                Log::error("Excepción enviando recordatorio", [
                    'appointment_id' => $appointment->id,
                    'exception' => $e->getMessage()
                ]);
            }
        }

        Log::info("Proceso de recordatorios completado", [
            'sent' => $sent,
            'failed' => $failed,
            'skipped' => $skipped,
            'total' => count($appointments)
        ]);

        return compact('sent', 'failed', 'skipped');
    }

    /**
     * Obtiene citas que necesitan recordatorio
     */
    protected function getAppointmentsNeedingReminder(int $daysInAdvance, int $limit): \Illuminate\Database\Eloquent\Collection
    {
        // El mismo criterio que la pantalla Citas (sin canceladas ni confirmadas, errores reintentables incluidos).
        return Appointment::query()
            ->porRecordar(Recordatorios::dentroDe($daysInAdvance))
            ->orderBy('cithor')
            ->orderBy('id')
            ->limit($limit)
            ->get();
    }

    /**
     * Envía recordatorio de cita individual
     */
    public function sendReminder(Appointment $appointment): array
    {
        Log::info('Iniciando envío de recordatorio', [
            'appointment_id' => $appointment->id,
            'phone' => $appointment->pactel,
            'patient' => $appointment->nom_paciente
        ]);

        // Sede: las citas de Cartago se identifican porque su código citcon empieza por "W".
        // Usan su propia plantilla (con la dirección de Cartago); el resto, la de Cali.
        $templateName = $this->isCartago($appointment)
            ? Setting::get('reminder_template_name_cartago', 'appointment_reminder_cartago')
            : Setting::get('reminder_template_name', 'appointment_reminder');

        // Todas las plantillas de recordatorio incluyen la línea "Ubicación" (parámetro {{6}}
        // = "connom - Consultorio citcon"), por lo que siempre se envían 6 parámetros.
        $includeConsultorio = true;

        // Celulares a los que se puede mandar: el principal y, de respaldo, el segundo (pactel2, o un segundo celular
        // escrito en el mismo campo). El mismo normalizador que usan las cifras de la pantalla (Recordatorios).
        // Fijos (60X…), incompletos o sin número → error permanente; el texto conserva «Número de teléfono inválido».
        $numeros = Recordatorios::celularesCita($appointment->pactel, $appointment->pactel2);

        if ($numeros === []) {
            $errorMsg = Recordatorios::error('telefono', 'Número de teléfono inválido: no es un celular', trim($appointment->pactel.' '.$appointment->pactel2));
            Log::warning('Número de teléfono inválido para recordatorio', ['appointment_id' => $appointment->id]);
            $appointment->markReminderFailed($errorMsg);

            return ['success' => false, 'error' => $errorMsg, 'motivo' => 'telefono', 'codigo' => null, 'alcance' => 'cita'];
        }

        $resultado = $this->enviarA($appointment, $numeros[0], 1, $templateName, $includeConsultorio);

        // El primer número no sirve (sin WhatsApp, no válido, WhatsApp no lo entrega): se prueba el segundo de una vez.
        if (!$resultado['success'] && in_array($resultado['motivo'] ?? null, Recordatorios::MOTIVOS_DEL_NUMERO, true) && isset($numeros[1])) {
            Log::info('Recordatorio: el primer número falló, se envía al segundo', [
                'appointment_id' => $appointment->id,
                'motivo' => $resultado['motivo'],
            ]);
            $segundo = $this->enviarA($appointment, $numeros[1], 2, $templateName, $includeConsultorio);
            if ($segundo['success']) {
                $this->anotarSegundo($appointment, $resultado['motivo']);
            } elseif (in_array($segundo['motivo'] ?? null, Recordatorios::MOTIVOS_DEL_NUMERO, true)) {
                $segundo['error'] = Recordatorios::error($segundo['motivo'], 'Ninguno de los dos números recibió el recordatorio', 'Teléfono: '.$resultado['error'].' · Teléfono 2: '.$segundo['error']);
            }

            return $segundo;
        }

        return $resultado;
    }

    /**
     * Reenvío al SEGUNDO número cuando Meta avisó después (webhook) que el primero no se entregó. Lo llama
     * App\Jobs\RecordatorioSegundoNumeroJob. null si no hay segundo número o ya se usó.
     */
    public function enviarAlSegundo(Appointment $appointment, string $motivoDelPrimero): ?array
    {
        $numeros = Recordatorios::celularesCita($appointment->pactel, $appointment->pactel2);
        if (!isset($numeros[1]) || (int) $appointment->reminder_numero === 2) {
            return null;
        }

        $templateName = $this->isCartago($appointment)
            ? Setting::get('reminder_template_name_cartago', 'appointment_reminder_cartago')
            : Setting::get('reminder_template_name', 'appointment_reminder');

        $resultado = $this->enviarA($appointment, $numeros[1], 2, $templateName, true);
        if ($resultado['success']) {
            $this->anotarSegundo($appointment, $motivoDelPrimero);
        }

        return $resultado;
    }

    /** Nota en la cita: el recordatorio salió al segundo número y por qué (sin el número completo). */
    protected function anotarSegundo(Appointment $appointment, string $motivo): void
    {
        $etiqueta = Recordatorios::ETIQUETAS_MOTIVO[$motivo] ?? $motivo;
        Appointment::whereKey($appointment->id)->update([
            'reminder_error' => null,
            'notes' => trim(($appointment->notes ?? '')."\n[".now(Recordatorios::ZONA)->format('Y-m-d H:i')."] Recordatorio enviado al teléfono 2 (el principal: {$etiqueta})"),
        ]);
        $appointment->refresh();
    }

    /**
     * Envía el recordatorio a UN número ($numero = 1 principal, 2 segundo). Con éxito marca la cita como enviada (con
     * ese número) y la deja en la conversación de ese número; si no, devuelve el fallo sin marcar nada (lo decide quien
     * llama).
     */
    protected function enviarA(Appointment $appointment, string $phoneNumber, int $numero, string $templateName, bool $includeConsultorio): array
    {
        // Preparar parámetros del template
        $parameters = $this->prepareTemplateParameters($appointment, $includeConsultorio);

        Log::info('Parámetros del template preparados', [
            'template_name' => $templateName,
            'parameters_count' => count($parameters)
        ]);

        try {
            $response = $this->sendTemplateMessage($phoneNumber, $templateName, $parameters);
        } catch (ConnectionException $e) {
            // Sin respuesta de Meta. Si ni siquiera se conectó, el mensaje no salió: se puede reintentar. Si se
            // conectó y no respondió («Operation timed out»), pudo haber salido: no se reenvía solo (sería duplicado).
            $texto = $e->getMessage();
            $noConecto = (bool) preg_match('/Connection timed out|Resolving timed out|Could not resolve|Failed to connect|Connection refused|cURL error (6|7):/i', $texto);
            Log::error('Sin respuesta de WhatsApp al enviar recordatorio', [
                'appointment_id' => $appointment->id,
                'conecto' => !$noConecto,
                'error' => $texto,
            ]);

            return $noConecto
                ? $this->fallo('temporal', 'Falla temporal de WhatsApp: no se pudo conectar', null, $texto)
                : $this->fallo('sin_respuesta', 'WhatsApp no respondió: revise el chat antes de reenviar', null, $texto);
        } catch (\Throwable $e) {
            Log::error('Error de WhatsApp al enviar recordatorio', [
                'appointment_id' => $appointment->id,
                'error' => $e->getMessage(),
            ]);

            return $this->falloDeMeta($e);
        }

        Log::info('Respuesta de WhatsApp API recibida', [
            'response' => $response
        ]);

        if (!isset($response['messages'][0]['id'])) {
            Log::warning('No se recibió ID de mensaje en la respuesta', [
                'response' => $response
            ]);

            return $this->fallo('sin_respuesta', 'WhatsApp no devolvió el número del mensaje: revise el chat antes de reenviar', null, json_encode($response));
        }

        $messageId = $response['messages'][0]['id'];

        // Marcar como enviada JUSTO al recibir el id de Meta: si algo de lo que sigue falla, la cita ya no se
        // reintenta (antes se marcaba al final y un fallo al crear la conversación reenviaba el WhatsApp).
        $appointment->markReminderSent($messageId, $numero);

        Log::info('Mensaje enviado exitosamente', [
            'message_id' => $messageId,
            'appointment_id' => $appointment->id,
            'message_status' => $response['messages'][0]['message_status'] ?? 'unknown',
        ]);

        try {
            // Buscar o crear conversación (con formato internacional +57...)
            $conversation = Conversation::firstOrCreate(
                ['phone_number' => '+' . $phoneNumber],
                [
                    'contact_name' => $appointment->nom_paciente,
                    // Recordatorio saliente: la conversación nace "agendada" (oculta de "Todos").
                    // Si el paciente responde, la reactivación automática la pasa a "active" y aparece.
                    'status' => 'scheduled',
                    'last_message_at' => now()
                ]
            );

            // Crear mensaje en la conversación
            Message::create([
                'conversation_id' => $conversation->id,
                'content' => $this->generateReminderText($appointment, $includeConsultorio),
                'message_type' => 'text',
                'is_from_user' => false,
                'whatsapp_message_id' => $messageId,
                'status' => 'sent',
                'sent_by' => null // Sistema automático
            ]);

            // Auto-etiquetar conversaciones de oncología
            if ($appointment->service === 'oncology') {
                $tag = Tag::firstOrCreate(
                    ['name' => 'Oncología'],
                    ['color' => '#9333ea']
                );
                $conversation->tags()->syncWithoutDetaching([$tag->id]);
            }

            Appointment::whereKey($appointment->id)->update(['conversation_id' => $conversation->id]);
            $appointment->conversation_id = $conversation->id;
        } catch (\Throwable $e) {
            // El WhatsApp ya salió y la cita ya está marcada: un fallo aquí solo se registra.
            Log::error('Recordatorio enviado, pero no se pudo guardar en el chat', [
                'appointment_id' => $appointment->id,
                'message_id' => $messageId,
                'error' => $e->getMessage(),
            ]);
        }

        return ['success' => true, 'message_id' => $messageId];
    }

    /** Resultado de un envío fallido, con el texto etiquetado que se guarda y lo que el trabajo debe hacer. */
    protected function fallo(string $motivo, string $texto, ?int $codigo = null, ?string $detalle = null): array
    {
        return [
            'success' => false,
            'error' => Recordatorios::error($motivo, $texto, $detalle),
            'motivo' => $motivo,
            'codigo' => $codigo,
            'alcance' => Recordatorios::ALCANCE[$motivo] ?? 'cita',
        ];
    }

    /** Clasifica la excepción de sendTemplateMessage (código de Meta y estado HTTP) en un motivo. */
    protected function falloDeMeta(\Throwable $e): array
    {
        $mensaje = $e->getMessage();
        $codigo = $e->getCode() ? (int) $e->getCode() : null;
        $status = preg_match('/Status: (\d{3})/', $mensaje, $m) ? (int) $m[1] : null;

        if (str_contains($mensaje, 'WhatsApp no configurado')) {
            return $this->fallo('cuenta', 'WhatsApp no está configurado en el servidor', null, $mensaje);
        }

        $llave = strpos($mensaje, '{');
        $cuerpo = $llave === false ? null : json_decode(substr($mensaje, $llave), true);

        $motivo = Recordatorios::motivoDeCodigo($codigo);
        if ($codigo === 100 && (int) data_get($cuerpo, 'error.error_subcode') === 33) {
            // «(#100) Object with ID … does not exist»: el número del hospital (phone_number_id) no existe o no hay
            // permiso. Es de la cuenta: se corta el lote en vez de marcar cada cita como «dato que no sirve».
            $motivo = 'cuenta';
        }
        if ($motivo === null) {
            $motivo = match (true) {
                in_array($status, [401, 403], true) => 'cuenta',
                $status === 429 => 'limite',
                $status !== null && $status >= 500 => 'temporal',
                default => 'otro',
            };
        }

        $titulo = data_get($cuerpo, 'error.message');
        $detalleMeta = data_get($cuerpo, 'error.error_data.details');
        $texto = $codigo !== null && Recordatorios::motivoDeCodigo($codigo) !== null
            ? WhatsAppErrorTranslator::human($codigo, $titulo, $detalleMeta)
            : Recordatorios::ETIQUETAS_MOTIVO[$motivo];
        $detalle = trim(($codigo !== null ? 'Meta '.$codigo : ($status !== null ? 'HTTP '.$status : '')).($titulo ? ': '.$titulo : ''));

        return $this->fallo($motivo, rtrim($texto, '.'), $codigo, $detalle !== '' ? $detalle : $mensaje);
    }

    /**
     * Limpia texto para cumplir requisitos de Meta WhatsApp
     * - Sin saltos de línea
     * - Sin tabs
     * - Máximo 4 espacios consecutivos
     */
    protected function cleanTextForWhatsApp(string $text): string
    {
        // Eliminar saltos de línea y tabs
        $text = str_replace(["\n", "\r", "\t"], ' ', $text);
        
        // Reducir múltiples espacios a máximo 2 (para ser conservadores)
        $text = preg_replace('/\s{3,}/', '  ', $text);
        
        // Trim espacios al inicio y final
        $text = trim($text);
        
        return $text;
    }

    /** Dirección de cada sede (la del mensaje real proviene de la plantilla de Meta). */
    private const DIRECCION_CALI = 'Calle 5 #36-08, barrio San Fernando.';
    private const DIRECCION_CARTAGO = 'Carrera 3b # 1a - 163, barrio Collarejo, Cartago.';

    /**
     * Una cita es de la sede CARTAGO si su código `citcon` empieza por "W".
     * Todas las demás son de Cali.
     */
    protected function isCartago(Appointment $appointment): bool
    {
        return str_starts_with(strtoupper(ltrim((string) ($appointment->citcon ?? ''))), 'W');
    }

    /** Dirección de la sede según el código citcon. */
    protected function sedeAddress(Appointment $appointment): string
    {
        return $this->isCartago($appointment) ? self::DIRECCION_CARTAGO : self::DIRECCION_CALI;
    }

    /**
     * Prepara parámetros para el template
     */
    protected function prepareTemplateParameters(Appointment $appointment, bool $includeConsultorio = false): array
    {
        // Formatear fecha
        $fecha = $appointment->citfc ? $appointment->citfc->locale('es')->isoFormat('dddd D [de] MMMM [de] YYYY') : 'No especificada';

        // Formatear hora usando el método centralizado
        $hora = $this->formatHora($appointment->cithor);

        // Limpiar todos los textos para cumplir requisitos de Meta
        $paciente = $this->cleanTextForWhatsApp($appointment->nom_paciente ?? 'Paciente');
        $medico = $this->cleanTextForWhatsApp($appointment->mednom ?? 'No especificado');
        $especialidad = $this->cleanTextForWhatsApp($appointment->espnom ?? 'No especificada');

        $parameters = [
            ['type' => 'text', 'text' => $paciente],
            ['type' => 'text', 'text' => $fecha],
            ['type' => 'text', 'text' => $hora],
            ['type' => 'text', 'text' => $medico],
            ['type' => 'text', 'text' => $especialidad],
        ];

        // Plantillas v2: parámetro {{6}} = consultorio ("citcon - connom").
        if ($includeConsultorio) {
            $parameters[] = ['type' => 'text', 'text' => $this->consultorioLabel($appointment)];
        }

        return [
            [
                'type' => 'body',
                'parameters' => $parameters,
            ]
        ];
    }

    /**
     * Etiqueta de ubicación para el recordatorio: "connom - Consultorio citcon"
     * (ej. "UROLOGIA GENERAL - Consultorio U01").
     * Nunca devuelve vacío (Meta rechaza parámetros vacíos): usa respaldos.
     */
    protected function consultorioLabel(Appointment $appointment): string
    {
        $citcon = trim((string) ($appointment->citcon ?? ''));
        $connom = trim((string) ($appointment->connom ?? ''));

        if ($citcon !== '' && $connom !== '') {
            $label = $connom . ' - Consultorio ' . $citcon;
        } elseif ($connom !== '') {
            $label = $connom;
        } elseif ($citcon !== '') {
            $label = 'Consultorio ' . $citcon;
        } else {
            $label = 'No especificado';
        }

        return $this->cleanTextForWhatsApp($label);
    }

    /**
     * Genera texto del recordatorio para guardar en BD
     * Este texto debe coincidir con la plantilla aprobada por Meta
     */
    protected function generateReminderText(Appointment $appointment, bool $includeConsultorio = false): string
    {
        $fecha = $appointment->citfc ? $appointment->citfc->locale('es')->isoFormat('dddd D [de] MMMM [de] YYYY') : 'No especificada';

        // Formatear hora usando el mismo método
        $hora = $this->formatHora($appointment->cithor);

        // Línea de ubicación (idéntica a la de la plantilla de Meta).
        $consultorioLinea = $includeConsultorio
            ? "Ubicación: " . $this->consultorioLabel($appointment) . "\n"
            : "";

        return "Hospital Universitario del Valle\n\n" .
               "Estimado(a) {$appointment->nom_paciente}\n" .
               "Reciba un cordial saludo.\n\n" .
               "Le recordamos que tiene una cita médica programada en el Hospital Universitario del Valle, con los siguientes detalles:\n\n" .
               "Fecha: {$fecha}\n" .
               "Hora: {$hora}\n" .
               "Médico: {$appointment->mednom}\n" .
               "Especialidad: {$appointment->espnom}\n" .
               $consultorioLinea . "\n" .
               "Dirección: " . $this->sedeAddress($appointment) . "\n\n" .
               "Le solicitamos presentarse con 40 minutos de anticipación y portar su documento de identificación, autorización de la eps, orden médica e historia clínica.\n\n" .
               "Para cualquier inquietud o si necesita reprogramar su cita, por favor comuníquese con nosotros.\n\n" .
               "Recomendación: Si tiene alguna duda al ingresar a nuestras instalaciones, por favor consulte con nuestro personal de orientación. Con gusto le guiaremos hasta su consultorio\n\n" .
               "Atentamente,\n" .
               "Hospital Universitario del Valle\n" .
               "70 años latiendo juntos.";
    }
    
    /**
     * Formatea la hora de 24h a 12h con AM/PM
     */
    protected function formatHora($cithor): string
    {
        if (!$cithor) {
            return 'No especificada';
        }
        
        try {
            // Intentar parsear como Carbon si es datetime
            if ($cithor instanceof \Carbon\Carbon) {
                return $cithor->format('h:i A');
            } else {
                // Es string, convertir de 24h a 12h con AM/PM
                $timeParts = explode(':', $cithor);
                if (count($timeParts) >= 2) {
                    $hours = (int)$timeParts[0];
                    $minutes = $timeParts[1];
                    $ampm = $hours >= 12 ? 'PM' : 'AM';
                    $hours12 = $hours % 12;
                    if ($hours12 === 0) $hours12 = 12;
                    return sprintf('%02d:%s %s', $hours12, $minutes, $ampm);
                }
            }
        } catch (\Exception $e) {
            // Si falla, usar el valor original
            return $cithor;
        }
        
        return 'No especificada';
    }

    /**
     * Envía mensaje usando template de WhatsApp
     */
    protected function sendTemplateMessage(string $to, string $templateName, array $components): array
    {
        $token = Setting::get('whatsapp_token');
        $phoneNumberId = Setting::get('whatsapp_phone_number_id');
        
        Log::info('Verificando configuración de WhatsApp', [
            'has_token' => !empty($token),
            'has_phone_number_id' => !empty($phoneNumberId),
            'phone_number_id' => $phoneNumberId
        ]);
        
        if (!$token || !$phoneNumberId) {
            throw new \Exception('WhatsApp no configurado. Token: ' . (!empty($token) ? 'Sí' : 'No') . ', Phone Number ID: ' . (!empty($phoneNumberId) ? 'Sí' : 'No'));
        }
        
        $url = "https://graph.facebook.com/v18.0/{$phoneNumberId}/messages";
        
        $payload = [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $to,
            'type' => 'template',
            'template' => [
                'name' => $templateName,
                'language' => ['code' => 'es_CO'],
                'components' => $components
            ]
        ];
        
        Log::info('Enviando request a WhatsApp API', [
            'url' => $url,
            'to' => $to,
            'template' => $templateName,
            'payload' => $payload
        ]);
        
        // Tiempos propios: 5 s para conectar y 20 s en total. Sin ellos eran 30 s y un «sin respuesta» se reintentaba
        // y reenviaba el mensaje (ver sendReminder: sin_respuesta no se reintenta).
        $response = Http::withToken($token)
            ->connectTimeout(5)
            ->timeout(20)
            ->post($url, $payload);
        
        Log::info('Respuesta HTTP recibida', [
            'status' => $response->status(),
            'successful' => $response->successful(),
            'body' => $response->body()
        ]);
        
        if (!$response->successful()) {
            $errorBody = $response->body();
            Log::error('Error en API de WhatsApp', [
                'status' => $response->status(),
                'body' => $errorBody
            ]);
            // El código de Meta (error.code) viaja como código de la excepción; el estado HTTP, en el texto.
            throw new \RuntimeException('Error en API de WhatsApp (Status: ' . $response->status() . '): ' . $errorBody, (int) data_get($response->json(), 'error.code', 0));
        }
        
        $jsonResponse = $response->json();
        Log::info('Respuesta JSON parseada', ['response' => $jsonResponse]);
        
        return $jsonResponse;
    }
}
