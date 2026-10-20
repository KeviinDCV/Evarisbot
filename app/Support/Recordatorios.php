<?php

namespace App\Support;

use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

/**
 * Reglas de las citas y de sus recordatorios, en un solo sitio.
 *
 * Las usan la pantalla Citas (panel, lista y Excel), el inicio del envío, el trabajo de la cola, el servicio que
 * llama a Meta y el webhook de estados. Antes cada uno tenía su versión (el conteo «Por enviar» exigía solo un
 * teléfono no vacío, el envío otra cosa, el Excel otra) y la pantalla prometía cifras que no eran las que salían.
 *
 * La app corre en UTC, pero citfc y cithor ya están en hora de Colombia: «hoy» y las horas que se muestran se
 * calculan siempre en America/Bogota.
 */
class Recordatorios
{
    public const ZONA = 'America/Bogota';

    /** La nota que deja AppointmentCancellationSync (la misma que usa StatisticsController::NOTA_CANCELADA_HOSPITAL). */
    public const NOTA_CANCELADA_HOSPITAL = 'Cancelada al enviar la plantilla';

    /** Estados con los que la cita ya quedó resuelta: no se les manda recordatorio. */
    public const RESUELTAS = ['cancelled', 'confirmed'];

    /**
     * Códigos de error de Meta de cada motivo. Solo van como «de la cita» los que dependen del destinatario o del
     * contenido de esa cita; los que dicen algo del número, la cuenta o la app del hospital cortan el lote (si no,
     * un problema del hospital marcaba una por una todas las citas del envío como error permanente):
     *   131005 permiso retirado, 133xxx registro del número del hospital, 131042 pago, 131045 certificado,
     *   131037 nombre visible, 131057 mantenimiento, 368 bloqueo por políticas, 0/3/10/200 permisos, 33 número borrado;
     *   131048 restricción por spam del número del hospital y 4 tope de llamadas → límite;
     *   131051 tipo de mensaje no admitido y 132068/132069 → plantilla.
     */
    private const CODIGOS = [
        'sin_whatsapp' => [131026],
        'rechazado' => [131049, 131047],
        'datos' => [132005, 132012, 131008, 131009, 100],
        'plantilla' => [132000, 132001, 132007, 132015, 132016, 131051, 132068, 132069],
        'cuenta' => [190, 131031, 131005, 133010, 133000, 133005, 133006, 133008, 133009, 131042, 131045, 131037, 131057, 368, 0, 3, 10, 33, 200],
        'limite' => [80007, 130429, 131048, 4],
        'temporal' => [131000, 131016, 131056, 133004, 2],
    ];

    /**
     * Qué hace el trabajo con cada motivo: «cita» la marca con error y no reintenta; «lote» corta el envío entero
     * sin marcar la cita (el problema es del hospital, no del paciente); «reintentar» la vuelve a intentar.
     */
    public const ALCANCE = [
        'telefono' => 'cita',
        'sin_whatsapp' => 'cita',
        'rechazado' => 'cita',
        'datos' => 'cita',
        'plantilla' => 'lote',
        'cuenta' => 'lote',
        'limite' => 'lote',
        'temporal' => 'reintentar',
        'caducado' => 'reintentar',
        'sin_respuesta' => 'cita',
        'otro' => 'cita',
    ];

    /** Motivos que no son culpa de la cita: la cita vuelve a contar en «Por enviar» y sale en el próximo envío. */
    public const REINTENTABLES = ['plantilla', 'cuenta', 'limite', 'temporal', 'caducado'];

    /**
     * Textos de los errores guardados antes de la etiqueta «[motivo]», y su motivo. El orden importa: se mira
     * de arriba abajo. errorReintentable() usa esta misma lista para que la cifra y el clasificador coincidan.
     */
    private const TEXTOS_VIEJOS = [
        'attempted too many' => 'caducado',
        'Something went wrong' => 'temporal',
        'timeout' => 'temporal',
        'rate limit' => 'limite',
        'WhatsApp no configurado' => 'cuenta',
        'Status: 401' => 'cuenta',
        'Status: 403' => 'cuenta',
        'Status: 5' => 'temporal',
    ];

    /** Lo que se guardaba (y se sigue guardando) cuando el teléfono no sirve: nunca se reintenta. */
    private const TEXTO_TELEFONO = 'Número de teléfono';

    /** Motivo → texto en español para el Excel (la pantalla los traduce con appointments.motivo.<clave>). */
    public const ETIQUETAS_MOTIVO = [
        'telefono' => 'Teléfono no válido',
        'sin_whatsapp' => 'El número no tiene WhatsApp',
        'rechazado' => 'WhatsApp no lo entregó (bloqueo o políticas)',
        'datos' => 'Un dato de la cita no sirve para la plantilla',
        'plantilla' => 'Problema con la plantilla del mensaje',
        'cuenta' => 'Problema con la cuenta de WhatsApp del hospital',
        'limite' => 'Se llegó al límite de mensajes de WhatsApp',
        'temporal' => 'Falla temporal de WhatsApp; se reintenta en el próximo envío',
        'caducado' => 'El envío se agotó (pausa larga o servicio detenido)',
        'sin_respuesta' => 'WhatsApp no respondió: revise el chat antes de reenviar',
        'otro' => 'No se pudo enviar',
    ];

    /** Estado efectivo del recordatorio → texto del Excel (los mismos nombres que la pantalla). */
    public const ETIQUETAS_ESTADO = [
        'con_error' => 'Con error',
        'enviado' => 'Enviado',
        'no_aplica' => 'No hacía falta',
        'sin_fecha' => 'Sin fecha',
        'sin_enviar' => 'No se envió',
        'sin_celular' => 'Sin celular válido',
        'por_enviar' => 'Por enviar',
    ];

    /** Respuesta del paciente → texto del Excel. */
    public const ETIQUETAS_RESPUESTA = [
        'confirmada' => 'Confirmada',
        'cancelada' => 'Cancelada',
        'cancelada_hospital' => 'Cancelada por el hospital',
        'sin_respuesta' => 'Sin respuesta',
    ];

    /** Hoy en Colombia, 'Y-m-d'. */
    public static function hoy(): string
    {
        return now(self::ZONA)->format('Y-m-d');
    }

    /** Hoy + $dias en Colombia, 'Y-m-d'. */
    public static function dentroDe(int $dias): string
    {
        return now(self::ZONA)->startOfDay()->addDays($dias)->format('Y-m-d');
    }

    /**
     * Una hora guardada en UTC (reminder_sent_at, created_at…) en hora de Colombia, como texto 'Y-m-d H:i' sin zona.
     * La pantalla la pinta tal cual: nunca hace new Date() sobre ella (restaría otras 5 h).
     */
    public static function horaCol(mixed $t): ?string
    {
        if ($t === null || $t === '') {
            return null;
        }

        try {
            $c = $t instanceof CarbonInterface ? $t->copy() : Carbon::parse((string) $t, 'UTC');
        } catch (\Throwable) {
            return null;
        }

        return $c->setTimezone(self::ZONA)->format('Y-m-d H:i');
    }

    /** Ahora en Colombia, 'Y-m-d H:i'. */
    public static function ahoraCol(): string
    {
        return now(self::ZONA)->format('Y-m-d H:i');
    }

    /**
     * El celular al que se puede mandar el WhatsApp, con el 57 delante, o null si el teléfono no sirve.
     *
     * Un único normalizador para contar, encolar y enviar. Acepta los formatos que hoy funcionan («300 123 4567»,
     * «300-123-4567», «+57 300…»), saca el celular de un texto con dos números («3001234567 - 3109876543») y deja
     * fuera los fijos (60X…) y los incompletos, que Meta acepta y luego no entrega. Los extranjeros (12 a 15
     * dígitos que no empiezan por 57) se siguen enviando, como hasta ahora.
     */
    public static function celular(?string $pactel): ?string
    {
        return self::celularesDe($pactel)[0] ?? null;
    }

    /**
     * Todos los celulares válidos de un texto, en orden y sin repetir (para «3001234567 - 3109876543» da los dos). Los
     * extranjeros solo si no hay ninguno colombiano, como celular().
     */
    public static function celularesDe(?string $pactel): array
    {
        $texto = trim((string) $pactel);
        if ($texto === '') {
            return [];
        }

        // Solo se parte por separadores ENTRE números: «/ , ; |», un guion con espacios y « y ».
        $trozos = preg_split('/\s*[\/,;|]\s*|\s+-\s+|\s+y\s+/iu', $texto) ?: [$texto];
        $colombianos = [];
        $extranjero = null;

        foreach ($trozos as $trozo) {
            // Dentro del trozo se quitan espacios, guiones, puntos, paréntesis y el «+»: quedan solo los dígitos.
            $d = preg_replace('/\D/', '', $trozo);
            if (strlen($d) === 12 && str_starts_with($d, '57')) {
                $d = substr($d, 2);
            } elseif (strlen($d) === 11 && str_starts_with($d, '0')) {
                $d = substr($d, 1);
            }
            if (preg_match('/^3\d{9}$/', $d)) {
                $colombianos[] = '57'.$d;
            } elseif ($extranjero === null && strlen($d) >= 12 && strlen($d) <= 15 && ! str_starts_with($d, '57')) {
                $extranjero = $d;
            }
        }

        // Dos celulares pegados sin separador: 20, 30… dígitos, en bloques de 10.
        if ($colombianos === []) {
            $todos = preg_replace('/\D/', '', $texto);
            if (strlen($todos) >= 20 && strlen($todos) % 10 === 0) {
                foreach (str_split($todos, 10) as $bloque) {
                    if (preg_match('/^3\d{9}$/', $bloque)) {
                        $colombianos[] = '57'.$bloque;
                    }
                }
            }
        }

        $colombianos = array_values(array_unique($colombianos));

        return $colombianos !== [] ? $colombianos : ($extranjero !== null ? [$extranjero] : []);
    }

    /**
     * Los números a los que se puede mandar el recordatorio de una cita, en orden: el principal y el de respaldo. El
     * respaldo es el de la columna «pactel2» o, si no hay, un segundo celular escrito en el mismo campo del teléfono.
     * Como mucho dos, sin repetir.
     */
    public static function celularesCita(?string $pactel, ?string $pactel2): array
    {
        return array_slice(array_values(array_unique(array_merge(self::celularesDe($pactel), self::celularesDe($pactel2)))), 0, 2);
    }

    /** Motivos de fallo que son del NÚMERO (no de la cita ni del hospital): con ellos se prueba el segundo número. */
    public const MOTIVOS_DEL_NUMERO = ['telefono', 'sin_whatsapp', 'rechazado'];

    /** Motivo de un código de error de Meta, o null si el código no está en la tabla. */
    public static function motivoDeCodigo(int|string|null $codigo): ?string
    {
        if ($codigo === null || $codigo === '' || ! is_numeric($codigo)) {
            return null;
        }
        $codigo = (int) $codigo;
        foreach (self::CODIGOS as $motivo => $codigos) {
            if (in_array($codigo, $codigos, true)) {
                return $motivo;
            }
        }

        return null;
    }

    /**
     * Motivo de un reminder_error: la etiqueta «[motivo]» de lo que se guarda ahora, o, para los textos viejos, el
     * código de Meta del JSON y luego los patrones conocidos. null si no hay error.
     */
    public static function motivo(?string $error): ?string
    {
        $error = trim((string) $error);
        if ($error === '') {
            return null;
        }

        if (str_starts_with($error, '[')) {
            return preg_match('/^\[([a-z_]+)\]/', $error, $m) && isset(self::ALCANCE[$m[1]]) ? $m[1] : 'otro';
        }

        // También «N?mero de tel?fono…»: en producción hay unos 300 guardados con las tildes perdidas (siguen siendo
        // permanentes en el SQL, que no los toma por reintentables).
        if (mb_stripos($error, self::TEXTO_TELEFONO) !== false || preg_match('/^N.mero de tel.fono/u', $error)) {
            return 'telefono';
        }

        if (preg_match('/"code":(\d+)/', $error, $m) && ($motivo = self::motivoDeCodigo($m[1])) !== null) {
            return $motivo;
        }

        foreach (self::TEXTOS_VIEJOS as $patron => $motivo) {
            if (stripos($error, $patron) !== false) {
                return $motivo;
            }
        }

        return 'otro';
    }

    /** ¿Ese error deja la cita en «Por enviar»? (sin error también: true). */
    public static function esReintentable(?string $error): bool
    {
        $motivo = self::motivo($error);

        return $motivo === null || in_array($motivo, self::REINTENTABLES, true);
    }

    /**
     * Lo que se guarda en reminder_error: «[motivo] texto llano (detalle técnico)». El detalle se recorta: es para
     * Sistemas, la persona ve el motivo traducido.
     */
    public static function error(string $motivo, string $texto, ?string $detalle = null): string
    {
        $detalle = trim((string) preg_replace('/\s+/u', ' ', (string) $detalle));
        if (mb_strlen($detalle) > 300) {
            $detalle = mb_substr($detalle, 0, 300).'…';
        }

        return '['.$motivo.'] '.$texto.($detalle !== '' ? ' ('.$detalle.')' : '');
    }

    /**
     * Condición SQL «reminder_error vacío o reintentable», armada con las MISMAS listas que motivo():
     *  - etiqueta nueva de un motivo reintentable, o
     *  - texto viejo (sin etiqueta, sin «Número de teléfono») con un código reintentable, o sin ningún código
     *    no reintentable y con alguno de los textos viejos reintentables.
     * Sirve para un builder de Eloquent o de consultas.
     */
    public static function errorReintentable($q): void
    {
        $reintentables = [];
        $otros = [];
        foreach (self::CODIGOS as $motivo => $codigos) {
            if (in_array($motivo, self::REINTENTABLES, true)) {
                array_push($reintentables, ...$codigos);
            } else {
                array_push($otros, ...$codigos);
            }
        }
        $textos = array_keys(array_filter(self::TEXTOS_VIEJOS, fn ($m) => in_array($m, self::REINTENTABLES, true)));

        $q->where(function ($q) use ($reintentables, $otros, $textos) {
            $q->whereNull('reminder_error')->orWhere('reminder_error', '');
            foreach (self::REINTENTABLES as $motivo) {
                $q->orWhere('reminder_error', 'like', '['.$motivo.']%');
            }
            $q->orWhere(function ($q) use ($reintentables, $otros, $textos) {
                $q->where('reminder_error', 'not like', '[%')
                    ->where('reminder_error', 'not like', '%'.self::TEXTO_TELEFONO.'%')
                    ->where(function ($q) use ($reintentables, $otros, $textos) {
                        foreach ($reintentables as $codigo) {
                            $q->orWhere('reminder_error', 'like', '%"code":'.$codigo.',%')
                                ->orWhere('reminder_error', 'like', '%"code":'.$codigo.'}%');
                        }
                        $q->orWhere(function ($q) use ($otros, $textos) {
                            foreach ($otros as $codigo) {
                                $q->where('reminder_error', 'not like', '%"code":'.$codigo.',%')
                                    ->where('reminder_error', 'not like', '%"code":'.$codigo.'}%');
                            }
                            $q->where(function ($q) use ($textos) {
                                foreach ($textos as $texto) {
                                    $q->orWhere('reminder_error', 'like', '%'.$texto.'%');
                                }
                            });
                        });
                    });
            });
        });
    }

    /** Lee un campo de una cita (modelo de Eloquent sin pasar por sus casts, o fila de DB::table). */
    private static function campo(object $apt, string $campo): mixed
    {
        if ($apt instanceof \Illuminate\Database\Eloquent\Model) {
            return $apt->getAttributes()[$campo] ?? null;
        }

        return $apt->{$campo} ?? null;
    }

    /** citfc como 'Y-m-d' (o null), venga como venga de la base. */
    public static function fechaDe(mixed $v): ?string
    {
        if ($v instanceof CarbonInterface) {
            return $v->format('Y-m-d');
        }
        $v = trim((string) $v);

        return $v === '' ? null : substr($v, 0, 10);
    }

    /** cithor como 'H:i' (o null): MySQL da '09:30:00'; si alguien guardó fecha y hora, se toma la hora. */
    public static function horaDe(mixed $v): ?string
    {
        if ($v instanceof CarbonInterface) {
            return $v->format('H:i');
        }
        $v = trim((string) $v);
        if ($v === '') {
            return null;
        }
        if (str_contains($v, ' ')) {
            $v = substr($v, strrpos($v, ' ') + 1);
        }

        return substr($v, 0, 5);
    }

    /**
     * Estado efectivo del recordatorio de una fila (el servidor lo calcula; la pantalla y el Excel solo lo pintan).
     * Orden: con_error, enviado, no_aplica, sin_fecha, sin_enviar, sin_celular, por_enviar.
     */
    public static function estadoFila(object $apt, string $hoy): string
    {
        $estado = self::campo($apt, 'reminder_status');
        if ($estado === 'failed') {
            return 'con_error'; // también con reminder_sent = 1: Meta avisó después que no lo entregó.
        }
        if ((bool) self::campo($apt, 'reminder_sent')) {
            return 'enviado';
        }
        if (in_array($estado, self::RESUELTAS, true)) {
            return 'no_aplica';
        }
        $citfc = self::fechaDe(self::campo($apt, 'citfc'));
        if ($citfc === null) {
            return 'sin_fecha';
        }
        if ($citfc <= $hoy) {
            return 'sin_enviar';
        }
        if (self::celularesCita(self::campo($apt, 'pactel'), self::campo($apt, 'pactel2')) === []) {
            return 'sin_celular';
        }

        return 'por_enviar';
    }

    /** Respuesta del paciente: confirmada, cancelada, cancelada_hospital, sin_respuesta o null. */
    public static function respuesta(object $apt): ?string
    {
        $estado = self::campo($apt, 'reminder_status');
        if ($estado === 'cancelled') {
            return str_contains((string) self::campo($apt, 'notes'), self::NOTA_CANCELADA_HOSPITAL) ? 'cancelada_hospital' : 'cancelada';
        }
        if ($estado === 'confirmed') {
            return 'confirmada';
        }
        if ((bool) self::campo($apt, 'reminder_sent') && $estado !== 'failed') {
            return 'sin_respuesta';
        }

        return null;
    }

    /** Tipo de documento solo si parece uno (CC, TI, RC, CE…); si no, null y la pantalla pone «Doc.». */
    public static function tipoDocumento(?string $cittid): ?string
    {
        $t = strtoupper(preg_replace('/\s+/', '', (string) $cittid));

        return preg_match('/^[A-Z]{2,3}$/', $t) ? $t : null;
    }

    /** Una cita tal como viaja a la pantalla (index y view usan la misma forma). */
    public static function fila(object $apt, string $hoy): array
    {
        $recordatorio = self::estadoFila($apt, $hoy);
        $enviadoEn = $apt instanceof \Illuminate\Database\Eloquent\Model ? $apt->reminder_sent_at : self::campo($apt, 'reminder_sent_at');

        return [
            'id' => (int) self::campo($apt, 'id'),
            'nom_paciente' => self::campo($apt, 'nom_paciente'),
            'citide' => self::campo($apt, 'citide'),
            'cittid' => self::tipoDocumento(self::campo($apt, 'cittid')),
            'pactel' => self::campo($apt, 'pactel'),
            'pactel2' => self::campo($apt, 'pactel2'),
            // El recordatorio salió al segundo número (el primero no tenía WhatsApp o no se lo entregaron).
            'al_segundo' => (int) self::campo($apt, 'reminder_numero') === 2,
            'citdoc' => self::campo($apt, 'citdoc'),
            'citfc' => self::fechaDe(self::campo($apt, 'citfc')),
            'cithor' => self::horaDe(self::campo($apt, 'cithor')),
            'mednom' => self::campo($apt, 'mednom'),
            'espnom' => self::campo($apt, 'espnom'),
            'reminder_sent' => (bool) self::campo($apt, 'reminder_sent'),
            'reminder_sent_at' => self::horaCol($enviadoEn),
            'reminder_status' => self::campo($apt, 'reminder_status'),
            'recordatorio' => $recordatorio,
            'respuesta' => self::respuesta($apt),
            'motivo' => $recordatorio === 'con_error' ? (self::motivo(self::campo($apt, 'reminder_error')) ?? 'otro') : null,
        ];
    }

    /** Columnas que necesita fila(): para no traer de la base lo que no viaja. */
    public const COLUMNAS_FILA = [
        'id', 'nom_paciente', 'citide', 'cittid', 'pactel', 'pactel2', 'citdoc', 'citfc', 'cithor', 'mednom', 'espnom',
        'reminder_sent', 'reminder_sent_at', 'reminder_status', 'reminder_error', 'reminder_numero', 'notes',
    ];
}
