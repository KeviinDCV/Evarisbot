<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Conversation extends Model
{
    protected $fillable = [
        'phone_number',
        'contact_name',
        'profile_picture_url',
        'status',
        'assigned_to',
        'assigned_at',
        // Equipo aparte de la línea general (Teleconsulta…); null = línea general. Ver App\Models\Equipo.
        'equipo_id',
        'resolved_by',
        'resolved_at',
        'last_message_at',
        'unread_count',
        'notes',
        'specialty',
        'is_pinned',
        'pinned_at',
        'is_blocked',
        'blocked_at',
        'blocked_by',
        'welcome_flow_step',
        'welcome_flow_completed',
        'welcome_flow_data',
    ];

    protected $casts = [
        'last_message_at' => 'datetime',
        'assigned_at' => 'datetime',
        'resolved_at' => 'datetime',
        'pinned_at' => 'datetime',
        'is_pinned' => 'boolean',
        'is_blocked' => 'boolean',
        'blocked_at' => 'datetime',
        'welcome_flow_completed' => 'boolean',
        'welcome_flow_data' => 'array',
    ];

    /**
     * Cada vez que cambia el asesor se anota cuándo (lo usa la liberación automática por
     * inactividad: el reloj no arranca antes de la asignación). Reabrir un chat cerrado que
     * conserva su asesor cuenta como asignación nueva por la misma razón. Cubre todas las
     * rutas que usan Eloquent; las que hacen update() directo sobre la consulta ponen
     * assigned_at a mano (ConversationController: respuesta del asesor, asignación, cambio
     * de estado y limpieza masivas).
     */
    protected static function booted(): void
    {
        static::saving(function (Conversation $conversation) {
            $abiertos = \App\Services\InactiveConversationReleaser::OPEN_STATUSES;

            if ($conversation->isDirty('assigned_to')) {
                $conversation->assigned_at = $conversation->assigned_to ? now() : null;
            } elseif (
                $conversation->assigned_to
                && $conversation->isDirty('status')
                && in_array($conversation->status, $abiertos, true)
                && ! in_array($conversation->getOriginal('status'), $abiertos, true)
            ) {
                $conversation->assigned_at = now();
            }
        });
    }

    /**
     * Relación con los mensajes
     */
    public function messages(): HasMany
    {
        return $this->hasMany(Message::class)->orderBy('created_at', 'asc');
    }

    /**
     * Último mensaje de la conversación: el más reciente, INCLUIDAS las respuestas
     * automáticas de cita (confirmar/cancelar). Así el preview de la lista muestra el
     * mensaje real y coincide con la hora por la que se ordena.
     * Que las confirmaciones no cuenten como no-leídas ni como trabajo del asesor se
     * maneja aparte (unread_count no se incrementa, assigned_to/resolved_by en null).
     */
    public function lastMessage()
    {
        return $this->hasOne(Message::class)->ofMany(['created_at' => 'max', 'id' => 'max']);
    }

    /**
     * Último mensaje VISIBLE (excluye las respuestas automáticas de cita ocultas).
     * Se usa como preview en la lista cuando hay no-leídos: así el asesor ve el mensaje
     * REAL del paciente y no una confirmación del sistema (ver preview en el frontend).
     */
    public function lastVisibleMessage()
    {
        return $this->hasOne(Message::class)->ofMany(
            ['created_at' => 'max', 'id' => 'max'],
            fn ($query) => $query->where('is_hidden', false)
        );
    }

    /**
     * Usuario (asesor) asignado
     */
    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    /**
     * Usuario que resolvió la conversación
     */
    public function resolvedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    /**
     * Usuario que bloqueó la conversación
     */
    public function blockedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'blocked_by');
    }

    /**
     * Historial de actividades
     */
    public function activities(): HasMany
    {
        return $this->hasMany(ConversationActivity::class);
    }

    /**
     * Marcar mensajes como leídos
     */
    public function markAsRead(): void
    {
        // Último entrante pendiente ANTES de marcarlos: es el que se envía a Meta para que
        // el paciente vea el doble check azul (marcar uno marca todos los anteriores).
        // reorder() porque la relación messages() ya viene ordenada ascendente.
        $ultimoEntrante = $this->messages()
            ->where('is_from_user', true)
            ->where('status', '!=', 'read')
            ->whereNotNull('whatsapp_message_id')
            ->reorder('created_at', 'desc')
            ->value('whatsapp_message_id');

        $this->update(['unread_count' => 0]);

        $this->messages()
            ->where('is_from_user', true)
            ->where('status', '!=', 'read')
            ->update(['status' => 'read']);

        // Acuse de recibo hacia el paciente. Hasta ahora sólo se marcaba leído por dentro:
        // el paciente se quedaba con el check gris aunque el asesor ya hubiera leído.
        // Es "mejor esfuerzo": si Meta no responde, el chat se abre igual.
        if ($ultimoEntrante) {
            try {
                app(\App\Services\WhatsAppService::class)->markAsRead($ultimoEntrante);
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('No se pudo enviar el acuse de lectura', [
                    'conversation_id' => $this->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    /**
     * Incrementar contador de no leídos
     */
    public function incrementUnread(): void
    {
        $this->increment('unread_count');
    }

    /**
     * ¿La conversación está dentro de la ventana de atención de 24h de WhatsApp?
     *
     * La ventana se abre con cada mensaje ENTRANTE del paciente (is_from_user=true) y
     * dura 24h desde ese último entrante. Dentro de la ventana se pueden enviar mensajes
     * de texto libres (sesión), que NO están sujetos al tope de plantillas de marketing
     * de Meta (evita el error 131049). Fuera de la ventana solo se pueden enviar plantillas.
     *
     * OJO: no se usa last_message_at porque ese campo también se actualiza con mensajes
     * SALIENTES (respuestas del asesor, recordatorios), así que no refleja el último
     * entrante. Se consulta el created_at del mensaje entrante más reciente. El reorder()
     * es necesario porque la relación messages() trae orderBy('created_at','asc').
     */
    public function isWithinServiceWindow(): bool
    {
        // Preferimos wa_sent_at (hora real de WhatsApp) sobre created_at (cuando nuestro
        // webhook lo procesó): es contra la primera que Meta cuenta las 24 h. Los mensajes
        // antiguos no la tienen, de ahí el COALESCE.
        $last = $this->messages()
            ->where('is_from_user', true)
            ->reorder(\DB::raw('COALESCE(wa_sent_at, created_at)'), 'desc')
            ->first(['wa_sent_at', 'created_at']);

        $lastInboundAt = $last?->wa_sent_at ?? $last?->created_at;

        // 23 h, no 24: Meta cierra la ventana ANTES que nuestro reloj (su cuenta arranca
        // cuando ELLA recibe el mensaje, no cuando lo procesa nuestro webhook). Medido en
        // producción: rechazos con error 131047 a las 23,32 h — 15 de 39 fallos ocurrieron
        // por debajo de las 24 h. El margen evita enviar texto libre que se perdería.
        return $lastInboundAt !== null
            && $lastInboundAt->greaterThan(now()->subHours(23));
    }

    /**
     * Scopes para filtrar conversaciones
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeAssignedTo($query, $userId)
    {
        return $query->where('assigned_to', $userId);
    }

    public function scopeUnassigned($query)
    {
        return $query->whereNull('assigned_to');
    }

    public function scopeWithUnread($query)
    {
        return $query->where('unread_count', '>', 0);
    }

    /**
     * Palabras de un mensaje de cortesía: si al quitarlas no queda ninguna letra, el mensaje no pide nada («gracias»,
     * «ok, muchas gracias 🙏», «Dios le pague»). De la más larga a la más corta: la alternancia toma la primera que
     * encaja («buenas» antes que «buena» y «buen»).
     */
    private const CORTESIA_PALABRAS = 'muchísimas|muchisimas|muchas|mucha|mucho|gracias|grasias|graxias|gracia|grax|okey|okay|oki|ok|vale|listos|listo|lista|perfecto|perfecta|entendido|entendida|acuerdo|confirmadas|confirmados|confirmada|confirmado|confirmamos|confirmar|confirmo|asistencia|asistiremos|asistiré|asistire|asistir|estaremos|estaré|estare|bendigan|bendiga|bendiciones|bendición|bendicion|pague|amén|amen|igualmente|excelente|atención|atencion|amables|amable|señorita|señora|señor|doctora|doctor|saludos|gusto|claro|buenas|buenos|buena|bueno|buen|bien|hola|dios|siempre|primero|también|tambien|todos|todo|ahí|ahi|allí|alli|allá|alla|hay|que|por|muy|mil|del|de|con|sus|su|mi|la|los|lo|les|le|cita|ya|sí|si|y|días|dias|día|dia|tardes|tarde|noches|noche';

    /** Y debe traer al menos una de estas: «buenas tardes» u «hola» solos SÍ son para un asesor. */
    private const CORTESIA_NUCLEO = 'gracias|grasias|graxias|gracia|grax|ok|vale|listo|lista|perfect|entendid|acuerdo|bendig|bendici|pague|amén|amen|confirm|asist|estar';

    /**
     * Confirmar con palabras («confirmo», «asistiré», «allá estaré», el botón «Confirmar») solo es cortesía si la cita
     * YA quedó confirmada y no está respondiendo a un envío masivo posterior al recordatorio. Si no, el sistema no lo
     * aplicó (el bot preguntó con botones, la cita estaba cancelada, falló la respuesta, o es el botón de un masivo,
     * que el sistema no procesa) y lo dejó a la vista a propósito: lo tiene que ver un asesor.
     */
    private const CORTESIA_CONFIRMA = 'confirm|asist|estar';

    /**
     * Emojis que solos son cortesía (👍, 🙏, ❤️…), con sus tonos de piel. Se quitan con REPLACE, que compara byte a byte:
     * con REGEXP o con «=» en utf8mb4_unicode_ci todos los emojis valen lo mismo («👎» = «👍»).
     */
    private const CORTESIA_EMOJIS = ['👍', '🙏', '✅', '👌', '🙂', '😊', '☺', '❤', '♥', '💙', '💚', '💜', '💛', '🧡', '🤝', '👏', '🌹', '🌸', '🌺', '💐',
        '😀', '😃', '😄', '😁', '🤗', '🥰', '😍', '😘', '✔', '✌', '🫶', '💪', '😇', '⭐', '🌟', '✨',
        '🏻', '🏼', '🏽', '🏾', '🏿', "\u{FE0F}", "\u{200D}", '!', '.', ','];

    /**
     * Cancelar escrito o con el botón de un masivo («Cancelar», «no puedo asistir»…), el mensaje entero. En un masivo el
     * sistema no cancela nada: solo se esconde del asesor, como pidió el usuario (18/11/2026).
     */
    private const CANCELA_EXACTO = '^(cancelar|cancelo|cancelada|cancelado|cancelar la cita|cancelar mi cita|cancelo la cita|cancelo mi cita|no puedo asistir|no podré asistir|no podre asistir|no asistiré|no asistire|no voy a poder asistir)[ .!]*$';

    /** El mensaje del paciente no cita nada o cita un envío masivo (el botón de una plantilla cita su mensaje). */
    private const RESPONDE_A_MASIVO = "(m.reply_to_id IS NULL OR EXISTS (SELECT 1 FROM messages q WHERE q.id = m.reply_to_id AND q.content LIKE '[Env_o masivo:%'))";

    /** Horas antes del recordatorio en las que una pregunta del paciente sin respuesta todavía cuenta como pendiente. */
    private const HORAS_PENDIENTE_ANTES = 48;

    /**
     * Condición SQL sobre un mensaje del paciente «m»: ¿es solo cortesía (o confirmar/cancelar, en un masivo)? Ver
     * CORTESIA_PALABRAS, CORTESIA_NUCLEO, CORTESIA_CONFIRMA y CORTESIA_EMOJIS. Puede dar NULL (texto nulo): quien la use,
     * con IFNULL.
     *  - 'cita' (recordatorio del módulo Citas, cita «a»): confirmar con palabras solo si la cita ya está confirmada y
     *    no responde a un masivo posterior; cancelar nunca (eso lo resuelve el sistema y queda oculto).
     *  - 'masivo': confirmar y cancelar (botón o escrito) también, si no cita otro mensaje que no sea un masivo.
     */
    private static function sqlCortesia(string $modo = 'cita'): string
    {
        $letras = '[a-zñáéíóúü]';
        $sinEmojis = 'm.content';
        foreach (self::CORTESIA_EMOJIS as $e) {
            $sinEmojis = "REPLACE({$sinEmojis}, '{$e}', '')";
        }
        if ($modo === 'masivo') {
            $confirma = self::RESPONDE_A_MASIVO;
            $cancela = " OR (" . self::RESPONDE_A_MASIVO . " AND LOWER(TRIM(m.content)) REGEXP '" . self::CANCELA_EXACTO . "')";
        } else {
            $confirma = "(a.reminder_status = 'confirmed' AND NOT EXISTS (SELECT 1 FROM messages b WHERE b.conversation_id = m.conversation_id"
                . " AND b.is_from_user = 0 AND b.sent_by IS NOT NULL AND b.created_at >= a.reminder_sent_at AND b.created_at <= m.created_at"
                . " AND b.content LIKE '[Env_o masivo%'))";
            $cancela = '';
        }

        return "(m.message_type = 'sticker' OR (m.message_type = 'text' AND CHAR_LENGTH(TRIM(m.content)) BETWEEN 1 AND 80"
            . " AND INSTR(m.content, '?') = 0 AND INSTR(m.content, '¿') = 0 AND m.content NOT REGEXP '[0-9]'"
            . " AND ("
            . "(REGEXP_REPLACE(LOWER(m.content), '" . self::CORTESIA_PALABRAS . "', '') NOT REGEXP '{$letras}'"
            . " AND LOWER(m.content) REGEXP '" . self::CORTESIA_NUCLEO . "'"
            . " AND (LOWER(m.content) NOT REGEXP '" . self::CORTESIA_CONFIRMA . "' OR {$confirma}))"
            . $cancela
            . " OR TRIM({$sinEmojis}) = '')))";
    }

    /**
     * Condición SQL: chat SIN asignar con un recordatorio de cita (módulo Citas) o un envío masivo después del cual no
     * pasó nada que necesite a un asesor. Abajo, la parte de Citas; la del masivo, en sqlMasivoSinNovedad.
     *
     * Después del recordatorio solo hubo el recordatorio, las respuestas de cita que resuelve el sistema (botones o
     * textos exactos, que quedan ocultos) y, si acaso, cortesía del paciente («gracias», «ok», 👍, stickers; «confirmo»
     * solo si la cita ya está confirmada). Deja de cumplirse en cuanto:
     *  - el paciente escribe otra cosa (una pregunta, una foto, un audio, «hola», «👎»…);
     *  - le escribe un asesor (un envío masivo no cuenta: es otro mensaje saliente; pero lo que el paciente responda a
     *    un masivo con palabras de confirmar, como su botón «Confirmar», sí lo devuelve);
     *  - se le asigna a alguien (un chat asignado es trabajo en curso de ese asesor y no se le esconde).
     *
     * Lo que el paciente escribió ANTES del recordatorio no lo devuelve, salvo una pregunta de las 48 h anteriores que
     * nadie había contestado: esa sigue pendiente y el chat no se esconde.
     *
     * Notas:
     *  - Basta con que lo cumpla algún recordatorio: lo que pasó después del último también pasó después de los
     *    anteriores, así que en la práctica decide el último.
     *  - No cuentan los recordatorios fallidos (el paciente no los recibió) ni las citas gemelas, que no tienen
     *    mensaje propio (reminder_whatsapp_message_id nulo) y no se enteran si el de su cita falla.
     *  - En MariaDB las funciones REGEXP pasan el texto a utf8 de 3 bytes y cada emoji llega como «?»: por eso las
     *    preguntas se buscan con INSTR y no con REGEXP, y los emojis sueltos con REPLACE.
     *  - IFNULL: un mensaje sin texto nunca pasa por cortesía.
     *  - Fechas: todas son TIMESTAMP escritas por la app; se comparan entre sí, sin NOW() de SQL.
     */
    public static function sqlRecordatorioSinNovedad(): string
    {
        return '(' . self::sqlCitaSinNovedad() . ' OR ' . self::sqlMasivoSinNovedad() . ')';
    }

    /**
     * Lo mismo después de un ENVÍO MASIVO (cualquier plantilla; los recordatorios de Cartago salen por aquí, con botones
     * «Confirmar» y «Cancelar» que el sistema no procesa): fuera si después el paciente solo confirmó, canceló (botón o
     * escrito) o dio las gracias, o no respondió; vuelve si escribe otra cosa o le escribe un asesor. Un masivo que Meta
     * no entregó (status 'failed') no cuenta. Misma ventana de 48 h para una pregunta sin responder de antes.
     */
    private static function sqlMasivoSinNovedad(): string
    {
        $cortesia = self::sqlCortesia('masivo');
        $horas = self::HORAS_PENDIENTE_ANTES;

        return "EXISTS (SELECT 1 FROM messages k WHERE k.conversation_id = conversations.id"
            . " AND conversations.assigned_to IS NULL"
            . " AND k.is_from_user = 0 AND k.content LIKE '[Env_o masivo:%' AND IFNULL(k.status, '') <> 'failed'"
            . " AND NOT EXISTS (SELECT 1 FROM messages s WHERE s.conversation_id = conversations.id"
            . " AND s.created_at >= k.created_at AND s.is_from_user = 0 AND s.sent_by IS NOT NULL"
            . " AND IFNULL(s.content, '') NOT LIKE '[Env_o masivo%')"
            . " AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = conversations.id"
            . " AND m.created_at >= k.created_at - INTERVAL {$horas} HOUR"
            . " AND m.is_from_user = 1 AND m.is_hidden = 0 AND NOT IFNULL({$cortesia}, 0)"
            . " AND (m.created_at >= k.created_at OR NOT EXISTS (SELECT 1 FROM messages r"
            . " WHERE r.conversation_id = conversations.id AND r.created_at > m.created_at AND r.is_from_user = 0"
            . " AND r.sent_by IS NOT NULL AND IFNULL(r.content, '') NOT LIKE '[Env_o masivo%'))))";
    }

    /** La parte del recordatorio del módulo Citas (ver sqlRecordatorioSinNovedad). */
    private static function sqlCitaSinNovedad(): string
    {
        $cortesia = self::sqlCortesia('cita');
        $horas = self::HORAS_PENDIENTE_ANTES;

        return "EXISTS (SELECT 1 FROM appointments a"
            . " WHERE a.conversation_id = conversations.id"
            . " AND conversations.assigned_to IS NULL"
            . " AND a.reminder_sent = 1 AND a.reminder_sent_at IS NOT NULL AND a.reminder_whatsapp_message_id IS NOT NULL"
            . " AND (a.reminder_status IS NULL OR a.reminder_status <> 'failed')"
            // Ningún asesor le escribió después (un envío masivo no cuenta: es otro mensaje saliente sin novedad).
            . " AND NOT EXISTS (SELECT 1 FROM messages s WHERE s.conversation_id = conversations.id"
            . " AND s.created_at >= a.reminder_sent_at AND s.is_from_user = 0 AND s.sent_by IS NOT NULL"
            . " AND IFNULL(s.content, '') NOT LIKE '[Env_o masivo%')"
            // Ningún mensaje del paciente que pida algo: después del recordatorio, o en las 48 h antes y sin respuesta.
            . " AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = conversations.id"
            . " AND m.created_at >= a.reminder_sent_at - INTERVAL {$horas} HOUR"
            . " AND m.is_from_user = 1 AND m.is_hidden = 0 AND NOT IFNULL({$cortesia}, 0)"
            . " AND (m.created_at >= a.reminder_sent_at OR NOT EXISTS (SELECT 1 FROM messages r"
            . " WHERE r.conversation_id = conversations.id AND r.created_at > m.created_at AND r.is_from_user = 0"
            . " AND r.sent_by IS NOT NULL AND IFNULL(r.content, '') NOT LIKE '[Env_o masivo%'))))";
    }

    /** Clave de caché del conjunto de chats de recordatorio sin novedad (ver recordatoriosSinNovedad). */
    private const CACHE_RECORDATORIOS = 'chat:recordatorios-sin-novedad';

    /**
     * Chats de recordatorio o masivo sin novedad, calculados una vez cada 30 s para todas las bandejas: la condición
     * cuesta ~0,3-0,8 s sobre los miles de chats abiertos, y la lista, sus contadores y el contador de no leídos de cada
     * asesor se piden a cada rato. Devuelve ['t' => instante del cálculo (UTC, tomado ANTES de consultar), 'ids' => [...]]
     * o null si no se pudo calcular (entonces se evalúa la condición en cada consulta, como respaldo).
     */
    public static function recordatoriosSinNovedad(): ?array
    {
        try {
            return \Illuminate\Support\Facades\Cache::remember(self::CACHE_RECORDATORIOS, 30, function () {
                // Un segundo antes: un mensaje de este mismo segundo pudo no verse en la consulta y se evalúa en el momento.
                $t = now()->subSecond()->format('Y-m-d H:i:s');
                $ids = \Illuminate\Support\Facades\DB::table('conversations')
                    ->whereNull('assigned_to')
                    ->where(fn ($q) => $q->whereIn('status', ['active', 'pending'])->orWhere('unread_count', '>', 0))
                    // Solo los que podrían salir en una lista (no leídos o algún mensaje visible del paciente): los masivos
                    // sin respuesta ya los saca «solo salientes» y harían la lista diez veces más larga (~2.000 frente a ~15.000).
                    ->where(fn ($q) => $q->where('unread_count', '>', 0)->orWhereExists(fn ($e) => $e->selectRaw('1')->from('messages as v')
                        ->whereColumn('v.conversation_id', 'conversations.id')->where('v.is_from_user', 1)->where('v.is_hidden', 0)))
                    ->whereRaw(self::sqlRecordatorioSinNovedad())
                    ->pluck('id')->map(fn ($id) => (int) $id)->all();

                return ['t' => $t, 'ids' => $ids];
            });
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Chats de recordatorio sin novedad: no se pudo calcular el conjunto', ['error' => $e->getMessage()]);

            return null;
        }
    }

    /**
     * Bandejas de los ASESORES («Todos», «Sin leer», el contador de no leídos): fuera los chats de recordatorio sin
     * novedad (ver sqlRecordatorioSinNovedad). Pedido del 18/11/2026: los recordatorios no deben llenar la bandeja;
     * el chat aparece solo si el paciente vuelve y escribe algo distinto de confirmar o cancelar. A los administradores
     * no se les aplica (siguen viendo todos los chats en «Todos»), y por búsqueda se encuentran siempre.
     *
     * Con el conjunto guardado (recordatoriosSinNovedad): los chats sin movimiento desde el cálculo se deciden por la
     * lista; los que tuvieron movimiento después (un mensaje nuevo cambia last_message_at) se evalúan en el momento,
     * así que un mensaje real del paciente lo devuelve enseguida. Uno asignado nunca se esconde.
     */
    public function scopeOcultarRecordatoriosSinNovedad($query)
    {
        $regla = self::sqlRecordatorioSinNovedad();
        $conjunto = self::recordatoriosSinNovedad();
        if ($conjunto === null) {
            return $query->whereRaw('NOT ' . $regla);
        }

        return $query->where(function ($q) use ($conjunto, $regla) {
            $q->whereNotNull('conversations.assigned_to')
                ->orWhere(function ($q) use ($conjunto) {
                    $q->where('conversations.last_message_at', '<=', $conjunto['t']);
                    if ($conjunto['ids'] !== []) {
                        $q->whereIntegerNotInRaw('conversations.id', $conjunto['ids']);
                    }
                })
                ->orWhere(function ($q) use ($conjunto, $regla) {
                    $q->where(fn ($q) => $q->where('conversations.last_message_at', '>', $conjunto['t'])->orWhereNull('conversations.last_message_at'))
                        ->whereRaw('NOT ' . $regla);
                });
        });
    }

    /**
     * Etiquetas de la conversación
     */
    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class, 'conversation_tag')->withTimestamps();
    }

    /**
     * Frontera entre equipos: ¿la conversación es de la misma «bandeja» que el usuario? Un administrador, siempre; un
     * asesor, si es de su equipo o si los dos son de la línea general (equipo_id null). Es lo único que se exige para
     * responder, reaccionar, fijar o etiquetar: dentro de la línea general sigue la regla de siempre.
     */
    public function mismoEquipoQue(User $user): bool
    {
        if (!$user->isAdvisor()) {
            return true;
        }

        return (int) $this->equipo_id === (int) ($user->equipo_id ?? 0);
    }

    /**
     * ¿Puede abrirla (y ver sus mensajes y archivos)? Equipo: todas las de su equipo. Línea general: nada de un equipo;
     * las suyas y, si está de turno, las sin asignar.
     */
    public function visiblePara(User $user): bool
    {
        if (!$user->isAdvisor()) {
            return true;
        }
        if (!$this->mismoEquipoQue($user)) {
            return false;
        }
        if ($user->equipo_id) {
            return true;
        }
        $mia = !is_null($this->assigned_to) && (int) $this->assigned_to === (int) $user->id;

        return $mia || (is_null($this->assigned_to) && $user->isOnDuty());
    }
}
