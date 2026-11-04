<?php

namespace App\Support;

use RuntimeException;
use ZipArchive;

/**
 * Escribe un .xlsx de una sola hoja fila por fila, directo a disco: la memoria no crece con el número de filas.
 *
 * PhpSpreadsheet arma el libro entero en memoria (unos 1–2 KB por celda), así que exportar las ~110.000 citas no
 * cabía y la exportación tenía un tope de 40.000. Aquí cada fila se escribe en un archivo temporal con el XML de la
 * hoja y al final se empaqueta el .xlsx (que es un ZIP de XML).
 *
 * Todo se guarda como texto (documentos y teléfonos sin notación científica ni ceros perdidos, y nada se toma por
 * fórmula), como hacía la exportación anterior con StringValueBinder. Admite: título de la hoja, anchos de columna,
 * una fila de encabezados con estilo (negrita blanca sobre un color) y colores por valor exacto en una columna
 * (formato condicional, como antes).
 */
final class LibroExcel
{
    /** Filas que admite una hoja de Excel (incluido el encabezado). */
    public const MAX_FILAS = 1048576;

    /** Caracteres que admite una celda de Excel. */
    private const MAX_CARACTERES = 32767;

    /** @var resource|null */
    private $hoja = null;

    private string $rutaHoja;

    private int $fila = 0;

    private int $columnas = 0;

    /** @var array<int, string> */
    private array $letras = [];

    /** @var array<string, array<string, array{0: string, 1: string}>> columna => texto => [fondo, letra] */
    private array $colores = [];

    private string $colorEncabezado = '2E3F84';

    /**
     * Carpeta privada de los temporales de las exportaciones (fuera de la web). Lleva datos de pacientes: si el proceso
     * muere a mitad de camino (error fatal, reinicio de Apache) quedaría el archivo, así que cada exportación barre lo
     * que tenga más de 1 hora (más que el tiempo máximo de una exportación, para no tocar una en curso).
     */
    public static function carpeta(): string
    {
        $carpeta = storage_path('app/private/exportes');
        if (! is_dir($carpeta) && ! @mkdir($carpeta, 0755, true) && ! is_dir($carpeta)) {
            throw new RuntimeException('No se pudo crear la carpeta de exportaciones.');
        }
        foreach (glob($carpeta.DIRECTORY_SEPARATOR.'*') ?: [] as $viejo) {
            if (is_file($viejo) && filemtime($viejo) < time() - 3600) {
                @unlink($viejo);
            }
        }

        return $carpeta;
    }

    /**
     * @param  array<string, float|int>  $anchos  letra de columna => ancho
     */
    public function __construct(private string $titulo, private array $anchos = [], ?string $carpeta = null)
    {
        $base = tempnam($carpeta ?? self::carpeta(), 'hoj');
        if ($base === false) {
            throw new RuntimeException('No se pudo crear el archivo temporal de la hoja.');
        }
        $this->rutaHoja = $base;
        // Tras un error fatal (tiempo o memoria agotados) PHP no llama a __destruct, pero sí a esto.
        register_shutdown_function(static function (string $ruta) {
            if (is_file($ruta)) {
                @unlink($ruta);
            }
        }, $base);
        $hoja = fopen($this->rutaHoja, 'wb');
        if ($hoja === false) {
            throw new RuntimeException('No se pudo abrir el archivo temporal de la hoja.');
        }
        $this->hoja = $hoja;
        // Los <cols> van antes de <sheetData>: los anchos se conocen desde el principio.
        $this->escribir('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'."\n"
            .'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            .'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            .$this->xmlAnchos().'<sheetData>');
    }

    public function __destruct()
    {
        if (is_resource($this->hoja)) {
            fclose($this->hoja);
        }
        if (is_file($this->rutaHoja)) {
            @unlink($this->rutaHoja);
        }
    }

    /** Fila de encabezados: negrita, blanca, tamaño 12, sobre el color dado (RGB). Debe ser la primera fila. */
    public function encabezados(array $titulos, string $color = '2E3F84'): void
    {
        $this->colorEncabezado = strtoupper(ltrim($color, '#'));
        $this->agregarFila($titulos, 1);
    }

    /** Una fila de datos; los vacíos (null o '') quedan como celdas vacías. */
    public function fila(array $valores): void
    {
        $this->agregarFila($valores, 0);
    }

    /**
     * Colorea las celdas de una columna (desde la fila 2) según su texto exacto.
     *
     * @param  array<string, array{0: string, 1: string}>  $colores  texto => [fondo RGB, letra RGB]
     */
    public function colorear(string $columna, array $colores): void
    {
        $this->colores[strtoupper($columna)] = $colores;
    }

    public function filas(): int
    {
        return $this->fila;
    }

    /** Cierra la hoja y escribe el .xlsx en $ruta. */
    public function guardar(string $ruta): void
    {
        $ultima = max(2, $this->fila);
        $this->escribir('</sheetData>'.$this->xmlColores($ultima).'</worksheet>');
        fclose($this->hoja);
        $this->hoja = null;

        $zip = new ZipArchive();
        if ($zip->open($ruta, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('No se pudo crear el archivo Excel.');
        }
        $zip->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'."\n"
            .'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            .'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            .'<Default Extension="xml" ContentType="application/xml"/>'
            .'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            .'<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            .'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            .'</Types>');
        $zip->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'."\n"
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            .'</Relationships>');
        $zip->addFromString('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'."\n"
            .'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            .'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            .'<sheets><sheet name="'.$this->texto(mb_substr($this->titulo, 0, 31)).'" sheetId="1" r:id="rId1"/></sheets>'
            .'</workbook>');
        $zip->addFromString('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'."\n"
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            .'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            .'</Relationships>');
        $zip->addFromString('xl/styles.xml', $this->xmlEstilos());
        // addFile lee el archivo al cerrar el ZIP: no se carga entero en memoria.
        $zip->addFile($this->rutaHoja, 'xl/worksheets/sheet1.xml');
        if (! $zip->close()) {
            throw new RuntimeException('No se pudo terminar el archivo Excel.');
        }
        @unlink($this->rutaHoja);
    }

    private function agregarFila(array $valores, int $estilo): void
    {
        if ($this->fila >= self::MAX_FILAS) {
            throw new RuntimeException('El libro pasa del máximo de filas de Excel.');
        }
        $this->fila++;
        $this->columnas = max($this->columnas, count($valores));
        $xml = '<row r="'.$this->fila.'">';
        $i = 0;
        foreach ($valores as $valor) {
            $letra = $this->letras[$i] ??= self::letra($i);
            $i++;
            if ($valor === null || $valor === '') {
                continue;
            }
            $xml .= '<c r="'.$letra.$this->fila.'" t="inlineStr"'.($estilo ? ' s="'.$estilo.'"' : '').'>'
                .'<is><t xml:space="preserve">'.$this->texto((string) $valor).'</t></is></c>';
        }
        $this->escribir($xml.'</row>');
    }

    /** Texto apto para XML: UTF-8 válido, sin caracteres que XML 1.0 prohíbe, y dentro del máximo de celda. */
    private function texto(string $valor): string
    {
        $valor = mb_scrub($valor, 'UTF-8');
        // Uno solo de estos en una celda haría que Excel rechazara la hoja entera.
        $valor = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x{FFFE}\x{FFFF}]/u', '', $valor) ?? '';
        if (strlen($valor) > self::MAX_CARACTERES) {
            $valor = $this->recortar($valor);
        }

        return htmlspecialchars($valor, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }

    /** Excel mide la celda en unidades UTF-16 (un emoji son dos): se corta así, sin partir un emoji por la mitad. */
    private function recortar(string $valor): string
    {
        $utf16 = mb_convert_encoding($valor, 'UTF-16LE', 'UTF-8');
        if (strlen($utf16) <= self::MAX_CARACTERES * 2) {
            return $valor;
        }
        $utf16 = substr($utf16, 0, self::MAX_CARACTERES * 2);
        $ultima = unpack('v', substr($utf16, -2))[1];
        if ($ultima >= 0xD800 && $ultima <= 0xDBFF) {
            $utf16 = substr($utf16, 0, -2);
        }

        return mb_convert_encoding($utf16, 'UTF-8', 'UTF-16LE');
    }

    private function escribir(string $xml): void
    {
        if (fwrite($this->hoja, $xml) === false) {
            throw new RuntimeException('No se pudo escribir la hoja (¿disco lleno?).');
        }
    }

    private function xmlAnchos(): string
    {
        if (! $this->anchos) {
            return '';
        }
        $cols = '';
        foreach ($this->anchos as $letra => $ancho) {
            $n = self::numero($letra);
            $cols .= '<col min="'.$n.'" max="'.$n.'" width="'.(float) $ancho.'" customWidth="1"/>';
        }

        return '<cols>'.$cols.'</cols>';
    }

    /** Formato condicional: celda igual a «texto» → fondo y letra en negrita de ese color (un dxf por regla). */
    private function xmlColores(int $ultima): string
    {
        $xml = '';
        $dxf = 0;
        $prioridad = 1;
        foreach ($this->colores as $columna => $reglas) {
            $xml .= '<conditionalFormatting sqref="'.$columna.'2:'.$columna.$ultima.'">';
            foreach ($reglas as $texto => $color) {
                $xml .= '<cfRule type="cellIs" dxfId="'.$dxf++.'" priority="'.$prioridad++.'" operator="equal">'
                    .'<formula>"'.$this->texto(str_replace('"', '""', (string) $texto)).'"</formula></cfRule>';
            }
            $xml .= '</conditionalFormatting>';
        }

        return $xml;
    }

    private function xmlEstilos(): string
    {
        $dxfs = '';
        $total = 0;
        foreach ($this->colores as $reglas) {
            foreach ($reglas as [$fondo, $letra]) {
                $fondo = strtoupper(ltrim($fondo, '#'));
                $letra = strtoupper(ltrim($letra, '#'));
                $dxfs .= '<dxf><font><b/><color rgb="FF'.$letra.'"/></font>'
                    .'<fill><patternFill patternType="solid"><fgColor rgb="FF'.$fondo.'"/><bgColor rgb="FF'.$fondo.'"/></patternFill></fill></dxf>';
                $total++;
            }
        }

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'."\n"
            .'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            .'<fonts count="2">'
            .'<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>'
            .'<font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>'
            .'</fonts>'
            .'<fills count="3">'
            .'<fill><patternFill patternType="none"/></fill>'
            .'<fill><patternFill patternType="gray125"/></fill>'
            .'<fill><patternFill patternType="solid"><fgColor rgb="FF'.$this->colorEncabezado.'"/><bgColor indexed="64"/></patternFill></fill>'
            .'</fills>'
            .'<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
            .'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            .'<cellXfs count="2">'
            .'<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
            .'<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'
            .'</cellXfs>'
            .'<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
            .'<dxfs count="'.$total.'">'.$dxfs.'</dxfs>'
            .'</styleSheet>';
    }

    /** 0 → A, 25 → Z, 26 → AA… */
    private static function letra(int $indice): string
    {
        $letra = '';
        for ($n = $indice + 1; $n > 0; $n = intdiv($n - 1, 26)) {
            $letra = chr(65 + ($n - 1) % 26).$letra;
        }

        return $letra;
    }

    /** A → 1, Z → 26, AA → 27… */
    private static function numero(string $letra): int
    {
        $n = 0;
        foreach (str_split(strtoupper($letra)) as $c) {
            $n = $n * 26 + (ord($c) - 64);
        }

        return $n;
    }
}
