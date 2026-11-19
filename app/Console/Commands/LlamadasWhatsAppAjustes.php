<?php

namespace App\Console\Commands;

use App\Models\Setting;
use App\Models\User;
use App\Services\LlamadasWhatsApp;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * Ajustes de llamadas del número en Meta (Calling API). Sin --aplicar solo muestra lo que haría: activar las llamadas
 * cambia lo que ven TODOS los pacientes (aparece el botón de llamar), así que se hace a mano y con permiso.
 *
 *   php artisan whatsapp:llamadas                                  → ver cómo está
 *   php artisan whatsapp:llamadas --subir-anuncio=buzon.ogg --aplicar → sube el audio del buzón (ogg/opus, < 60 s)
 *   php artisan whatsapp:llamadas --activar --anuncio=ID [--espera=25] [--aplicar]
 *   php artisan whatsapp:llamadas --desactivar [--aplicar]
 *
 * Ensayo con el número real sin que se enteren los pacientes ni les suene a los asesores:
 *   php artisan whatsapp:llamadas --activar --oculto --solo=30 --aplicar → botón de llamar oculto; solo le timbra al 30
 *   php artisan whatsapp:llamadas --boton=573001234567 --aplicar          → le manda un botón «Llamar» a ese número
 *   php artisan whatsapp:llamadas --solo=todos --aplicar                  → quita la restricción del timbre
 *
 * El horario lo controla Evarisbot (ver App\Services\LlamadasWhatsApp): en Meta el horario va APAGADO porque su buzón
 * de voz no funciona con él.
 */
class LlamadasWhatsAppAjustes extends Command
{
    protected $signature = 'whatsapp:llamadas
        {--activar : Activa las llamadas entrantes con buzón de voz}
        {--desactivar : Apaga las llamadas}
        {--anuncio= : ID del audio del buzón ya subido (use_case call_voicemail_announcement)}
        {--espera=25 : Segundos que timbra antes de pasar al buzón (0-30)}
        {--oculto : Al activar: los pacientes NO ven el botón de llamar; solo sirve el botón que se envía con --boton}
        {--solo= : Ensayo: ids de usuarios (separados por coma) a los que les timbra; «todos» quita la restricción}
        {--boton= : Envía a este número un botón «Llamar» (tuvo que escribir al hospital en las últimas 24 h)}
        {--subir-anuncio= : Ruta de un .ogg (opus, menos de 60 s) para el anuncio del buzón}
        {--aplicar : Hacerlo de verdad (sin esto solo se muestra)}';

    protected $description = 'Ver o cambiar los ajustes de llamadas de WhatsApp del número en Meta';

    private const API = LlamadasWhatsApp::API;

    public function handle(): int
    {
        $token = (string) Setting::get('whatsapp_token');
        $id = (string) Setting::get('whatsapp_phone_id');
        if ($token === '' || $id === '') {
            $this->error('Falta el token o el número de WhatsApp en Configuración.');

            return self::FAILURE;
        }
        $aplicar = (bool) $this->option('aplicar');

        if ($ruta = $this->option('subir-anuncio')) {
            if (! is_file($ruta)) {
                $this->error("No existe el archivo $ruta");

                return self::FAILURE;
            }
            if (! $aplicar) {
                $this->line("Se subiría $ruta como anuncio del buzón (añada --aplicar).");

                return self::SUCCESS;
            }
            $r = Http::withToken($token)->timeout(60)
                ->attach('file', file_get_contents($ruta), basename($ruta), ['Content-Type' => 'audio/ogg'])
                ->post(self::API."/$id/media", [
                    'messaging_product' => 'whatsapp',
                    'type' => 'audio/ogg',
                    'use_case' => 'call_voicemail_announcement',
                    'description' => 'Buzón de voz (español)',
                ]);
            $this->line('Respuesta de Meta ('.$r->status().'): '.json_encode($r->json(), JSON_UNESCAPED_UNICODE));

            return $r->successful() ? self::SUCCESS : self::FAILURE;
        }

        if (($numero = $this->option('boton')) !== null) {
            return $this->enviarBoton((string) $numero, $token, $id, $aplicar);
        }

        // --solo: null = no se pidió; [] = «todos» (sin restricción); [ids] = ensayo.
        $solo = null;
        if (($opcion = $this->option('solo')) !== null) {
            $solo = $this->leerSolo((string) $opcion);
            if ($solo === false) {
                return self::FAILURE;
            }
        }

        if ($this->option('activar') || $this->option('desactivar')) {
            if ($this->option('activar')) {
                // Sin App Secret no se puede comprobar que los avisos de llamada vengan de Meta, y el webhook los ignora.
                $secreto = Setting::get(\App\Http\Middleware\VerifyMetaSignature::KEY_SECRET);
                if (! is_string($secreto) || $secreto === '') {
                    $this->error('Primero guarde el App Secret de la app de Meta (php artisan whatsapp:firma --guardar): sin firma, Evarisbot ignora los avisos de llamada.');

                    return self::FAILURE;
                }
                $anuncio = (string) $this->option('anuncio');
                $espera = max(0, min(30, (int) $this->option('espera')));
                $icono = $this->option('oculto') ? 'DISABLE_ALL' : 'DEFAULT';
                $calling = [
                    'status' => 'ENABLED',
                    'call_icon_visibility' => $icono,
                    'call_hours' => LlamadasWhatsApp::horarioMetaApagado(),
                ];
                if ($anuncio !== '') {
                    $calling['voicemail'] = [
                        'status' => 'ENABLED',
                        'triggers' => ['REJECT', 'TIMEOUT'],
                        'audio' => ['default' => ['announcement_media_id' => $anuncio, 'timeout_seconds' => $espera]],
                    ];
                } else {
                    $this->warn('Sin --anuncio: se activa SIN buzón de voz (si nadie contesta, el paciente ve «no contestó»).');
                }
                $this->line($icono === 'DISABLE_ALL'
                    ? 'Botón de llamar OCULTO para los pacientes: solo se puede llamar con el botón que se envía con --boton.'
                    : 'Botón de llamar VISIBLE para todos los pacientes en el chat del hospital.');
                $this->line($solo
                    ? 'Ensayo: solo les timbrará a '.$this->nombres($solo).'.'
                    : 'Timbrará según los ajustes de la pantalla Llamadas (asesores de turno y administradores).');
            } else {
                $calling = ['status' => 'DISABLED'];
            }
            $cuerpo = ['calling' => $calling];
            $this->line('Se enviaría a Meta: '.json_encode($cuerpo, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
            if (! $aplicar) {
                $this->line('(sin --aplicar: no se cambió nada)');

                return self::SUCCESS;
            }
            $r = Http::withToken($token)->timeout(20)->post(self::API."/$id/settings", $cuerpo);
            $this->line('Respuesta de Meta ('.$r->status().'): '.json_encode($r->json(), JSON_UNESCAPED_UNICODE));
            if (! $r->successful()) {
                return self::FAILURE;
            }
            // El interruptor de Evarisbot (el timbre en las pantallas) sigue a Meta, y el timbre dura lo que la espera del buzón.
            $activas = (bool) $this->option('activar');
            // Primero la restricción del ensayo y después el interruptor: que no timbre a todos ni un instante.
            Setting::set(LlamadasWhatsApp::AJUSTE_ENSAYO, json_encode($activas ? ($solo ?: []) : []), 'Ensayo de llamadas: ids de usuarios a los que SOLO les timbra ([] = sin restricción)');
            if (! ($activas && $solo)) {
                Setting::set(LlamadasWhatsApp::AJUSTE_ENSAYO_NUMEROS, '[]', 'Ensayo de llamadas: números que pueden llamar (los demás se rechazan)');
            }
            Setting::set(LlamadasWhatsApp::AJUSTE_ICONO, $activas && $this->option('oculto') ? 'DISABLE_ALL' : 'DEFAULT', 'Botón de llamar en el chat del hospital (DEFAULT visible, DISABLE_ALL oculto)');
            Setting::set(LlamadasWhatsApp::AJUSTE_ACTIVAS, $activas ? 'true' : 'false', 'Llamadas de WhatsApp entrantes activadas (timbre en Evarisbot)');
            if ($activas) {
                Setting::set(LlamadasWhatsApp::AJUSTE_ESPERA, (string) ((string) $this->option('anuncio') !== '' ? max(0, min(30, (int) $this->option('espera'))) : 0), 'Segundos antes del buzón de voz de Meta (0 = sin buzón)');
                // El id del anuncio queda guardado: la pantalla «Llamadas» lo reutiliza si cambian la espera del buzón.
                Setting::set(LlamadasWhatsApp::AJUSTE_ANUNCIO, (string) $this->option('anuncio'), 'Id del audio del buzón de voz en Meta');
            }
            $this->info('Evarisbot: llamadas '.($activas ? 'ACTIVADAS ('.($solo ? 'ensayo: solo '.$this->nombres($solo) : 'timbra a los asesores de turno').')' : 'apagadas').'.');
        } elseif ($solo !== null) {
            // Solo cambiar a quién le timbra (sin tocar Meta).
            if (! $aplicar) {
                $this->line(($solo ? 'Solo les timbraría a '.$this->nombres($solo) : 'Quitaría la restricción del ensayo').' (añada --aplicar).');

                return self::SUCCESS;
            }
            Setting::set(LlamadasWhatsApp::AJUSTE_ENSAYO, json_encode($solo), 'Ensayo de llamadas: ids de usuarios a los que SOLO les timbra ([] = sin restricción)');
            if (! $solo) {
                Setting::set(LlamadasWhatsApp::AJUSTE_ENSAYO_NUMEROS, '[]', 'Ensayo de llamadas: números que pueden llamar (los demás se rechazan)');
            }
            $this->info($solo ? 'Ensayo: ahora solo les timbra a '.$this->nombres($solo).'.' : 'Sin restricción: timbra según los ajustes de la pantalla Llamadas.');
        }

        $s = Http::withToken($token)->timeout(20)->get(self::API."/$id/settings");
        $this->line('Ajustes de llamadas en Meta: '.json_encode($s->json('calling') ?? $s->json(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        $ensayo = LlamadasWhatsApp::usuariosEnsayo();
        $this->line('Evarisbot: '.(LlamadasWhatsApp::activas() ? 'activas' : 'apagadas')
            .($ensayo ? ' · ensayo: solo '.$this->nombres($ensayo).' · pueden llamar: '.(LlamadasWhatsApp::numerosEnsayo() ? implode(', ', array_map(fn ($n) => '···'.substr($n, -4), LlamadasWhatsApp::numerosEnsayo())) : 'nadie (envíe --boton)') : '')
            .' · botón '.(LlamadasWhatsApp::iconoLlamar() === 'DISABLE_ALL' ? 'oculto' : 'visible')
            .' · '.(LlamadasWhatsApp::enHorario() ? 'en horario' : 'fuera de horario'));

        return self::SUCCESS;
    }

    /** @return int[]|false */
    private function leerSolo(string $opcion): array|false
    {
        if (strtolower(trim($opcion)) === 'todos') {
            return [];
        }
        $ids = array_values(array_unique(array_filter(array_map('intval', explode(',', $opcion)), fn ($i) => $i > 0)));
        $existen = User::whereIn('id', $ids)->pluck('id')->map(fn ($i) => (int) $i)->all();
        $faltan = array_diff($ids, $existen);
        if ($ids === [] || $faltan !== []) {
            $this->error('--solo: '.($ids === [] ? 'ponga ids de usuarios separados por coma, o «todos»' : 'no existen los usuarios '.implode(', ', $faltan)).'. No se cambió nada.');

            return false;
        }

        return $ids;
    }

    private function nombres(array $ids): string
    {
        return User::whereIn('id', $ids)->orderBy('id')->get(['id', 'name'])->map(fn ($u) => "#$u->id $u->name")->implode(', ');
    }

    /**
     * Mensaje con el botón «Llamar» (interactive voice_call): sirve aunque el botón del chat esté oculto (--oculto). Meta
     * solo lo entrega si esa persona le escribió al hospital en las últimas 24 h. No queda en la bandeja de Evarisbot.
     */
    private function enviarBoton(string $numero, string $token, string $id, bool $aplicar): int
    {
        $numero = preg_replace('/\D/', '', $numero);
        if (! preg_match('/^\d{10,15}$/', $numero)) {
            $this->error('--boton: número no válido (con indicativo, p. ej. 573001234567).');

            return self::FAILURE;
        }
        $cuerpo = [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $numero,
            'type' => 'interactive',
            'interactive' => [
                'type' => 'voice_call',
                'body' => ['text' => 'Prueba de llamadas de WhatsApp del hospital. Toque «Llamar» para hacer la llamada de prueba.'],
                'action' => ['name' => 'voice_call', 'parameters' => ['display_text' => 'Llamar', 'ttl_minutes' => 120]],
            ],
        ];
        $this->line('Se enviaría a ···'.substr($numero, -4).': '.json_encode($cuerpo['interactive'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        if (! $aplicar) {
            $this->line('(sin --aplicar: no se envió nada)');

            return self::SUCCESS;
        }
        // En ensayo, el número invitado queda en la lista de los que pueden llamar (antes de enviar: puede tocar «Llamar» al instante).
        if (LlamadasWhatsApp::usuariosEnsayo() !== []) {
            $numeros = array_values(array_unique([...LlamadasWhatsApp::numerosEnsayo(), $numero]));
            Setting::set(LlamadasWhatsApp::AJUSTE_ENSAYO_NUMEROS, json_encode($numeros), 'Ensayo de llamadas: números que pueden llamar (los demás se rechazan)');
            $this->line('Ensayo: ···'.substr($numero, -4).' puede llamar.');
        }
        $r = Http::withToken($token)->timeout(20)->post(self::API."/$id/messages", $cuerpo);
        $this->line('Respuesta de Meta ('.$r->status().'): '.json_encode($r->successful() ? ['ok' => true, 'id' => $r->json('messages.0.id')] : $r->json('error'), JSON_UNESCAPED_UNICODE));

        return $r->successful() ? self::SUCCESS : self::FAILURE;
    }
}
