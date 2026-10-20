<?php

namespace App\Support;

/**
 * Quita datos de pacientes del contexto de los logs antes de escribirlos.
 *
 * Los logs se guardan 30 días y se copian como evidencia; antes llevaban teléfonos completos y el texto
 * de los mensajes. Los teléfonos quedan con sus últimos 4 dígitos (suficiente para cruzar con la base
 * junto con el id de conversación) y los textos se cambian por su longitud.
 */
class LogRedactor
{
    private const PHONE_KEYS = ['phone', 'phone_number', 'from', 'to', 'recipient', 'recipient_id', 'recipient_phone', 'wa_id', 'telefono', 'pactel', 'pactel2', 'user'];

    private const TEXT_KEYS = ['text', 'content', 'body', 'caption', 'message_text', 'transcription', 'contact_name', 'profile_name', 'pacnom', 'original_filename', 'local_url', 'search', 'query', 'notes', 'texto'];

    public static function redact(array $context, int $depth = 0): array
    {
        if ($depth > 5) {
            return $context;
        }

        foreach ($context as $key => $value) {
            $k = is_string($key) ? strtolower($key) : $key;

            if (is_array($value)) {
                $context[$key] = self::redact($value, $depth + 1);
            } elseif (in_array($k, self::PHONE_KEYS, true) && (is_string($value) || is_int($value))) {
                $context[$key] = self::maskPhone((string) $value);
            } elseif (in_array($k, self::TEXT_KEYS, true) && is_string($value) && $value !== '') {
                $context[$key] = '['.mb_strlen($value).' caracteres]';
            }
        }

        return $context;
    }

    private static function maskPhone(string $value): string
    {
        $digits = preg_replace('/\D/', '', $value);

        // Solo números de teléfono (7 a 15 dígitos); otros valores (ids, "unknown", correos) quedan igual.
        if ($digits === null || strlen($digits) < 7 || strlen($digits) > 15 || strlen($digits) < strlen(trim($value, "+ \t")) - 4) {
            return $value;
        }

        return '***'.substr($digits, -4);
    }
}
