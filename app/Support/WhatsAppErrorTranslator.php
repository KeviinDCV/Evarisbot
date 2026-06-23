<?php

namespace App\Support;

/**
 * Traduce los errores de la API de WhatsApp (Meta) a mensajes claros en español,
 * para que los usuarios entiendan por qué falló un envío sin ver códigos técnicos.
 */
class WhatsAppErrorTranslator
{
    /**
     * Mapa de códigos de error de Meta -> mensaje en lenguaje natural.
     */
    private const MAP = [
        131026 => 'El número no tiene WhatsApp o no puede recibir mensajes.',
        133010 => 'El número no está registrado en WhatsApp.',
        131047 => 'Pasaron más de 24 horas desde el último mensaje del paciente; solo se pueden enviar plantillas.',
        131048 => 'El número está bloqueando los mensajes (marcado como spam).',
        131049 => 'WhatsApp no entregó el mensaje por sus políticas de calidad.',
        131051 => 'El número no admite este tipo de mensaje.',
        131000 => 'Error temporal de WhatsApp; intenta de nuevo más tarde.',
        131005 => 'El número no está habilitado en WhatsApp.',
        131016 => 'El servicio de WhatsApp no está disponible por el momento.',
        131031 => 'La cuenta de WhatsApp Business está restringida o bloqueada.',
        132000 => 'La plantilla tiene un número de parámetros incorrecto.',
        132001 => 'La plantilla no existe o no está aprobada en ese idioma.',
        132005 => 'El texto de la plantilla supera el límite permitido.',
        132007 => 'La plantilla fue rechazada o pausada por Meta.',
        132012 => 'Un parámetro de la plantilla tiene un formato inválido.',
        100    => 'Parámetro inválido en la solicitud a WhatsApp.',
        190    => 'El token de WhatsApp expiró o no es válido (revisar configuración).',
        80007  => 'Se alcanzó el límite diario de mensajes permitido por WhatsApp.',
    ];

    /**
     * Devuelve un mensaje claro en español a partir de un código/título/detalle de error de Meta.
     */
    public static function human(int|string|null $code, ?string $title = null, ?string $detail = null): string
    {
        $code = ($code === null || $code === '') ? null : (int) $code;

        if ($code !== null && isset(self::MAP[$code])) {
            return self::MAP[$code];
        }

        // Sin código mapeado: deducir por el texto si es posible.
        $hint = strtolower(trim((string) ($detail ?: $title)));

        if ($hint !== '') {
            if (str_contains($hint, 'undeliverable') || str_contains($hint, 'not a whatsapp')) {
                return 'El número no tiene WhatsApp o no puede recibir mensajes.';
            }
            if (str_contains($hint, 'template')) {
                return 'Problema con la plantilla del mensaje.';
            }
            if (str_contains($hint, 'token') || str_contains($hint, 'expired')) {
                return 'El token de WhatsApp expiró o no es válido (revisar configuración).';
            }
        }

        return 'No se pudo enviar el mensaje.';
    }
}
