<?php

namespace App\Support;

/**
 * Estructura que debe tener el Excel de un envío masivo según la plantilla elegida (pedido del 18/11/2026: «si no es
 * tal cual el Excel como debe ser, que no se pueda enviar y marque error»).
 *
 * La estructura es la misma «guía» que muestra la pantalla al elegir la plantilla (bulk-sends/index.tsx, excelGuide):
 * telefono, nombre y una columna por cada {{N}} con el nombre que dice el texto que lo rodea («a las {{4}}» → hora,
 * «el día {{3}}» → fecha, «Dr. {{5}}» → medico, «Especialidad: {{5}}» → especialidad; si no se reconoce, dato_N; el
 * segundo de un mismo tipo, fecha_2…). La lógica de tipos es copia de expectedSlotType: si se cambia allá, aquí también.
 *
 * Se exige tal cual: falta, sobra o está mal escrita una columna → error; y fila por fila: teléfono válido, nombre,
 * ninguna celda vacía, fechas como fecha y horas como hora (con la misma limpieza que hace SendBulkMessageJob al enviar).
 */
final class EstructuraMasivo
{
    /** Nombres que valen para la columna del teléfono y del nombre (los mismos que acepta la carga del Excel). */
    public const ALIAS_TELEFONO = ['telefono', 'phone', 'celular', 'cel', 'numero', 'pactel', 'phone_number'];

    public const ALIAS_NOMBRE = ['nombre', 'name', 'contacto', 'paciente', 'nom_paciente', 'contact_name', 'nom_pac', 'nombrepaciente', 'nombre_paciente', 'nombrepac', 'cliente', 'destinatario', 'usuario'];

    /**
     * Una fecha: 20/06/2026, 20-06-26, 2026-06-20 o 2026/06/20 (las de TIME_RX y DATE_RX de la pantalla, más el año
     * primero con barras: 662 celdas así en 90 días), y puede seguir una nota («20/06/2026 (miércoles)»).
     */
    private const FECHA = '/^(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})(\s+\S.*)?$/u';

    private const HORA = '/^\d{1,2}:\d{2}(:\d{2})?(\s?[ap]\.?\s?m\.?)?$/i';

    /** Cuántas filas se nombran por cada problema (el resto se cuenta). */
    private const FILAS_POR_PROBLEMA = 8;

    /** Minúsculas, sin tildes ni espacios sobrantes (como normalizeText de la pantalla). */
    public static function normalizar(string $s): string
    {
        // Sin la marca BOM (U+FEFF) que Excel pone al inicio de un CSV guardado como UTF-8: pegada a «telefono».
        // Y sin espacios duros (NBSP), que trim() no quita: «hora » quedaría «hora_».
        $s = mb_strtolower(trim(str_replace(["\u{FEFF}", "\u{00A0}"], ['', ' '], $s)));
        if (class_exists(\Normalizer::class)) {
            $s = (string) preg_replace('/\p{Mn}+/u', '', (string) \Normalizer::normalize($s, \Normalizer::FORM_D));
        }

        return (string) preg_replace('/\s+/u', ' ', $s);
    }

    /** Nombre de columna para comparar: «Fecha 2», «fecha-2» y «fecha_2» son la misma. */
    public static function clave(string $encabezado): string
    {
        return (string) preg_replace('/[\s\-]+/u', '_', self::normalizar($encabezado));
    }

    /** Qué dato espera el hueco {{idx}} según el texto que lo precede (copia de expectedSlotType). */
    public static function tipoEsperado(string $texto, int $idx): string
    {
        $pos = mb_strpos($texto, '{{' . $idx . '}}');
        if ($pos === false) {
            return 'any';
        }
        // Como normalizeText de la pantalla: minúsculas y sin tildes, SIN juntar espacios (para decidir igual que ella).
        $antes = mb_strtolower(mb_substr($texto, max(0, $pos - 28), min(28, $pos)));
        if (class_exists(\Normalizer::class)) {
            $antes = (string) preg_replace('/[\x{0300}-\x{036F}]+/u', '', (string) \Normalizer::normalize($antes, \Normalizer::FORM_D));
        }
        if (preg_match('/(a las|para las|hora)\s*[:.]?\s*$/u', $antes)) {
            return 'time';
        }
        if (preg_match('/(el dia|del dia|fecha|para el)\s*[:.]?\s*$/u', $antes)) {
            return 'date';
        }
        if (preg_match('/(dr\.?\s*\(?a?\)?|doctor|medic[oa])\s*[:.]?\s*$/u', $antes)) {
            return 'doctor';
        }
        if (preg_match('/(especialidad|cita de)\s*[:.]?\s*$/u', $antes)) {
            return 'especialidad';
        }
        if (preg_match('/(sr\s*\(?a?\)?\.?|sra\.?|senor(a)?)\s*$/u', $antes)) {
            return 'nombre';
        }

        return 'any';
    }

    /**
     * La guía de la plantilla: un elemento por cada {{N}} (en orden), con la columna que le toca y el contexto. Los de
     * tipo nombre salen de la columna del nombre (columna null).
     *
     * @return list<array{idx:int, tipo:string, columna:?string, contexto:string}>
     */
    public static function guia(?string $texto): array
    {
        $texto = (string) $texto;
        preg_match_all('/\{\{(\d+)\}\}/', $texto, $m);
        $huecos = array_values(array_unique(array_map('intval', $m[1])));
        sort($huecos);

        $cuenta = [];
        $guia = [];
        foreach ($huecos as $i => $idx) {
            $tipo = $i === 0 ? 'nombre' : self::tipoEsperado($texto, $idx);
            $base = match ($tipo) {
                'date' => 'fecha',
                'time' => 'hora',
                'doctor' => 'medico',
                'especialidad' => 'especialidad',
                'nombre' => 'nombre',
                default => 'dato_' . $idx,
            };
            $cuenta[$base] = ($cuenta[$base] ?? 0) + 1;
            $columna = $cuenta[$base] > 1 ? $base . '_' . $cuenta[$base] : $base;

            $pos = mb_strpos($texto, '{{' . $idx . '}}');
            $antes = trim((string) preg_replace('/\s+/u', ' ', mb_substr($texto, max(0, $pos - 26), min(26, $pos))));
            $despues = trim((string) preg_replace('/\s+/u', ' ', mb_substr($texto, $pos + mb_strlen('{{' . $idx . '}}'), 20)));
            $limpio = fn (string $s) => (string) preg_replace('/\{\{\d+\}\}/', '…', $s);

            $guia[] = [
                'idx' => $idx,
                'tipo' => $tipo,
                'columna' => $tipo === 'nombre' ? null : $columna,
                'contexto' => '…' . $limpio($antes) . ' ___ ' . $limpio($despues) . '…',
            ];
        }

        return $guia;
    }

    /** Las columnas de datos que debe traer el Excel, además de teléfono y nombre. */
    public static function columnasDeDatos(array $guia): array
    {
        return array_values(array_filter(array_column($guia, 'columna')));
    }

    /**
     * ¿Es un celular que el envío puede usar? La misma regla de SendBulkMessageJob: 10 dígitos (se le antepone el 57)
     * o de 12 a 15 con el código de país. Un «.0» final (número de Excel leído como texto) no cuenta.
     */
    public static function celularValido(string $telefono): bool
    {
        $digitos = (string) preg_replace('/\D/', '', (string) preg_replace('/\.0+$/', '', trim($telefono)));
        $n = strlen($digitos);

        return $n === 10 || ($n >= 12 && $n <= 15);
    }

    /** ¿La plantilla usa el nombre del paciente? (tiene algún {{N}}: el primero siempre es el nombre). */
    public static function usaNombre(array $guia): bool
    {
        return $guia !== [];
    }

    /**
     * Valida un Excel completo: $encabezados = la primera fila tal cual; $filas = las demás (cada una, lista de celdas).
     * $numeroFila(i) da el número de fila a mostrar (en el Excel, la 2 es la primera de datos).
     *
     * Las filas sin un celular válido (vacío, fijo, incompleto) no son un error de estructura: se quitan, como siempre,
     * y quedan en $avisos para decirlo. $exigirNombre: cada fila debe traer el nombre (si la plantilla lo usa).
     *
     * @return list<string> errores (vacío = el Excel está tal cual)
     */
    public static function validarExcel(array $encabezados, array $filas, array $guia, ?callable $numeroFila = null, ?array &$avisos = null, ?bool $exigirNombre = null): array
    {
        $numeroFila ??= fn (int $i) => $i + 2;
        $exigirNombre ??= self::usaNombre($guia);
        $avisos = [];
        $errores = [];
        $esperadas = self::columnasDeDatos($guia);
        $contextos = [];
        foreach ($guia as $g) {
            if ($g['columna']) {
                $contextos[$g['columna']] = $g['contexto'];
            }
        }

        // 1) Columnas.
        $colTelefono = null;
        $colNombre = null;
        $colDatos = [];
        $vistas = [];
        $sobran = [];
        $sinNombre = [];
        foreach ($encabezados as $i => $enc) {
            $crudo = trim(str_replace("\u{00A0}", ' ', (string) $enc));
            $clave = self::clave($crudo);
            if ($clave === '') {
                // Sin nombre: solo es problema si tiene datos (datos corridos de columna).
                foreach ($filas as $f) {
                    if (trim((string) ($f[$i] ?? '')) !== '') {
                        $sinNombre[] = self::letra($i);
                        break;
                    }
                }
                continue;
            }
            $vistas[$clave] = ($vistas[$clave] ?? 0) + 1;
            if ($colTelefono === null && in_array($clave, self::ALIAS_TELEFONO, true)) {
                $colTelefono = $i;
            } elseif ($colNombre === null && in_array($clave, self::ALIAS_NOMBRE, true)) {
                $colNombre = $i;
            } elseif (in_array($clave, $esperadas, true) && !isset($colDatos[$clave])) {
                $colDatos[$clave] = $i;
            } elseif ($vistas[$clave] === 1) {
                $sobran[$i] = $crudo;
            }
        }

        foreach ($vistas as $clave => $n) {
            if ($n > 1) {
                $errores[] = "La columna «{$clave}» está repetida. Cada columna debe aparecer una sola vez.";
            }
        }
        if ($colTelefono === null) {
            $errores[] = 'Falta la columna del teléfono: nómbrela «telefono».';
        }
        if ($colNombre === null && self::usaNombre($guia)) {
            $errores[] = 'Falta la columna del nombre del paciente: nómbrela «nombre».';
        }
        $faltan = array_values(array_diff($esperadas, array_keys($colDatos)));
        foreach ($faltan as $col) {
            $parecida = self::parecida($col, $sobran);
            $errores[] = $parecida !== null
                ? "La columna «{$parecida}» está mal escrita: debe llamarse «{$col}» (va en «{$contextos[$col]}»)."
                : "Falta la columna «{$col}» (va en «{$contextos[$col]}»).";
        }
        foreach ($sobran as $crudo) {
            if (self::parecida($crudo, array_combine($faltan, $faltan) ?: [], true) === null) {
                $errores[] = "Sobra la columna «{$crudo}»: esta plantilla no la usa. Quítela del Excel.";
            }
        }
        foreach ($sinNombre as $letra) {
            $errores[] = "La columna {$letra} no tiene nombre pero tiene datos: póngale el nombre que corresponde o quítela.";
        }
        if ($errores !== []) {
            $errores[] = 'Columnas que debe tener el Excel, con esos nombres: ' . implode(', ', self::columnasDelExcel($guia)) . '.';

            // Con columnas que no cuadran, revisar las filas solo confunde.
            return $errores;
        }

        // 2) Filas.
        $tipos = [];
        foreach ($guia as $g) {
            if ($g['columna']) {
                $tipos[$g['columna']] = $g['tipo'];
            }
        }
        $problemas = [];
        $omitidas = [];
        $validas = 0;
        $anotar = function (array &$lista, string $que, int $fila, ?string $valor = null) {
            $lista[$que][] = $valor === null ? (string) $fila : $fila . ' («' . mb_substr($valor, 0, 30) . '»)';
        };
        foreach ($filas as $i => $f) {
            $celdas = array_map(fn ($c) => trim(str_replace("\u{00A0}", ' ', (string) $c)), (array) $f);
            if (implode('', $celdas) === '') {
                continue; // fila vacía
            }
            $n = $numeroFila($i);
            $tel = $celdas[$colTelefono] ?? '';
            if (!self::celularValido($tel)) {
                // Se quita (como siempre); no se revisa el resto de la fila.
                $anotar($omitidas, $tel === '' ? 'sin teléfono' : 'con un número que no es celular', $n, $tel === '' ? null : $tel);
                continue;
            }
            $validas++;
            if ($exigirNombre && $colNombre !== null && ($celdas[$colNombre] ?? '') === '') {
                $anotar($problemas, 'Falta el nombre', $n);
            }
            foreach ($colDatos as $col => $j) {
                $valor = self::limpiar($col, $celdas[$j] ?? '');
                if ($valor === '') {
                    $anotar($problemas, "Falta «{$col}»", $n);
                } elseif ($tipos[$col] === 'date' && !preg_match(self::FECHA, $valor)) {
                    $anotar($problemas, "«{$col}» no es una fecha (escríbala como 20/06/2026)", $n, $valor);
                } elseif ($tipos[$col] === 'time' && !preg_match(self::HORA, $valor)) {
                    $anotar($problemas, "«{$col}» no es una hora (escríbala como 8:30 AM)", $n, $valor);
                } elseif ($tipos[$col] === 'doctor' && (preg_match(self::FECHA, $valor) || preg_match(self::HORA, $valor))) {
                    $anotar($problemas, "«{$col}» trae una fecha u hora en lugar del médico", $n, $valor);
                }
            }
        }
        foreach ($problemas as $que => $lista) {
            $errores[] = $que . self::enFilas($lista) . '.';
        }
        if ($validas === 0 && $errores === []) {
            $errores[] = 'Ninguna fila tiene un celular válido (10 dígitos): revise la columna del teléfono.';
        }
        foreach ($omitidas as $que => $lista) {
            $avisos[] = (count($lista) === 1 ? 'Se quitará 1 fila ' : 'Se quitarán ' . count($lista) . ' filas ') . $que . ':' . self::enFilas($lista, false) . '.';
        }

        return $errores;
    }

    /** «en la fila 4» / «en las filas 3, 5 (…) y 12 más». */
    private static function enFilas(array $lista, bool $conEn = true): string
    {
        $resto = count($lista) - self::FILAS_POR_PROBLEMA;

        return ($conEn ? ' en ' : ' ') . (count($lista) === 1 ? 'la fila ' : 'las filas ') . implode(', ', array_slice($lista, 0, self::FILAS_POR_PROBLEMA))
            . ($resto > 0 ? " y {$resto} más" : '');
    }

    /** Las columnas del Excel, en orden: telefono, nombre (si la plantilla lo usa) y las de datos. */
    public static function columnasDelExcel(array $guia): array
    {
        return array_merge(['telefono'], self::usaNombre($guia) ? ['nombre'] : [], self::columnasDeDatos($guia));
    }

    /**
     * Valida el envío al pulsar Enviar (respaldo del servidor: la pantalla pudo quedar abierta con una versión vieja):
     * los destinatarios ya cargados (teléfono, nombre y las columnas del Excel en params) y el mapeo de cada {{N}}.
     * Los huecos de nombre ({{1}}) salen del nombre del paciente o de un valor fijo (en saludo_asesor_v2 el {{1}} es el
     * asesor), nunca de una columna; los demás, de su columna.
     *
     * @return list<string>
     */
    public static function validarEnvio(array $destinatarios, ?array $mapeo, array $guia): array
    {
        $esperadas = self::columnasDeDatos($guia);
        $errores = [];

        // Mapeo.
        $nombreDelPaciente = false;
        foreach ($guia as $g) {
            $m = is_array($mapeo) ? ($mapeo[(string) $g['idx']] ?? null) : null;
            $fuente = is_array($m) ? ($m['source'] ?? null) : null;
            if ($g['columna'] === null) {
                if ($fuente === 'nombre') {
                    $nombreDelPaciente = true;
                } elseif (!($fuente === 'static' && trim((string) ($m['value'] ?? '')) !== '')) {
                    $errores[] = '{{' . $g['idx'] . '}} debe salir del nombre del paciente (o de un valor fijo).';
                }
            } elseif ($fuente !== 'column' || self::clave((string) ($m['column'] ?? '')) !== $g['columna']) {
                $errores[] = '{{' . $g['idx'] . "}} debe salir de la columna «{$g['columna']}» (va en «{$g['contexto']}»).";
            }
        }

        // Columnas: las de params (vienen del encabezado del Excel) deben ser exactamente las esperadas.
        $claves = [];
        $aMano = 0;
        foreach ($destinatarios as $d) {
            $p = $d['params'] ?? null;
            if (!is_array($p) || $p === []) {
                $aMano++;
                continue;
            }
            foreach (array_keys($p) as $k) {
                $claves[(string) $k] = true;
            }
        }
        if ($esperadas !== [] && $aMano > 0) {
            $errores[] = ($aMano === 1 ? 'Hay 1 número sin datos del Excel' : "Hay {$aMano} números sin datos del Excel")
                . ' (agregados a mano): esta plantilla necesita ' . implode(', ', $esperadas) . ' de cada paciente. Agréguelos en el Excel.';
        }
        $encabezados = array_merge(['telefono', 'nombre'], array_keys($claves));
        $filas = array_map(function ($d) use ($claves) {
            $fila = [(string) ($d['phone'] ?? ''), (string) ($d['name'] ?? '')];
            foreach (array_keys($claves) as $k) {
                $fila[] = (string) (($d['params'] ?? [])[$k] ?? '');
            }

            return $fila;
        }, array_values(array_filter($destinatarios, fn ($d) => (is_array($d['params'] ?? null) && $d['params'] !== []) || $esperadas === [])));
        $avisos = [];
        foreach (self::validarExcel($encabezados, $filas, $guia, fn (int $i) => $i + 1, $avisos, $nombreDelPaciente) as $e) {
            $errores[] = str_replace(['en la fila ', 'en las filas '], ['en el destinatario ', 'en los destinatarios '], $e);
        }

        return array_values(array_unique($errores));
    }

    /** La misma limpieza que hace SendBulkMessageJob::sanitizeParamValue antes de mandar el dato. */
    public static function limpiar(string $columna, string $valor): string
    {
        $valor = trim($valor);
        $c = mb_strtolower($columna);
        $hora = str_contains($c, 'hora');
        $fecha = str_contains($c, 'fecha');
        if ($hora && !$fecha) {
            if (preg_match('#^\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}\s+(.+)$#u', $valor, $m) || preg_match('#^\d{4}[/\-]\d{1,2}[/\-]\d{1,2}\s+(.+)$#u', $valor, $m)) {
                $valor = trim($m[1]);
            }
        }
        if ($fecha && !$hora) {
            if (preg_match('#^(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})\s+\d{1,2}:\d{2}#u', $valor, $m) || preg_match('#^(\d{4}[/\-]\d{1,2}[/\-]\d{1,2})\s+\d{1,2}:\d{2}#u', $valor, $m)) {
                $valor = $m[1];
            }
        }

        return trim((string) preg_replace('/\s+/u', ' ', $valor));
    }

    /** ¿Alguno de $candidatos se parece a $nombre (error de escritura: 1-2 letras)? Devuelve el candidato tal cual. */
    private static function parecida(string $nombre, array $candidatos, bool $alReves = false): ?string
    {
        $a = self::clave($nombre);
        foreach ($candidatos as $crudo) {
            $b = self::clave((string) $crudo);
            $limite = min(mb_strlen($a), mb_strlen($b)) <= 5 ? 1 : 2;
            if ($a !== $b && levenshtein($a, $b) <= $limite) {
                return $alReves ? $nombre : (string) $crudo;
            }
        }

        return null;
    }

    /** Letra de la columna (0 → A). */
    private static function letra(int $i): string
    {
        return \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($i + 1);
    }
}
