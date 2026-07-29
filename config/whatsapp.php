<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Facturación / estimación de costos del API de WhatsApp (Meta)
    |--------------------------------------------------------------------------
    |
    | Meta cobra POR MENSAJE de plantilla entregado (modelo per-message vigente
    | desde el 1 de julio de 2025), según la categoría y el país del destinatario.
    | Estas tarifas son las de Colombia (+57) en USD y se usan solo para ESTIMAR
    | el gasto en el panel de estadísticas. El cobro real y las facturas viven en
    | Meta Business Manager > Facturación y pagos; el consumo por categoría en
    | WhatsApp Manager > Insights.
    |
    | Verifica los valores contra el rate card oficial de Meta (cambian con el
    | tiempo; Colombia ajustó utility/authentication el 1-oct-2025). Puedes
    | sobreescribirlos por .env sin tocar código.
    |
    */

    /*
    |--------------------------------------------------------------------------
    | Plantillas que cancelan una cita
    |--------------------------------------------------------------------------
    |
    | Al enviar una de estas (por envío masivo o desde el chat), la cita que
    | menciona el mensaje se marca como 'cancelled'. Sin esto, el WhatsApp salía
    | pero la cita seguía "confirmada", y el bot contradecía al asesor diciéndole
    | al paciente que su cita estaba CONFIRMADA.
    |
    | date_param / time_param = número de parámetro ({{2}}, {{3}}…) que lleva la
    | fecha y la hora en esa plantilla. Si añades una plantilla nueva, comprueba
    | su orden de parámetros antes de listarla aquí.
    |
    | NO se incluyen a propósito las de reprogramación ni cambio de horario: ahí
    | la cita no se cancela, se mueve, y marcarlas 'cancelled' sería incorrecto.
    |
    */

    'cancellation_templates' => [
        // "…su cita médica programada para el {{2}} a las {{3}} ha sido cancelada."
        'cancelacion_cita' => ['date_param' => 2, 'time_param' => 3],
        'cancelacion_de_citas_por_festivo_13_julio' => ['date_param' => 2, 'time_param' => 3],
    ],

    'billing' => [

        // Moneda en la que están expresadas las tarifas de abajo.
        'currency' => env('WHATSAPP_BILLING_CURRENCY', 'USD'),

        // Mes de referencia de las tarifas (para mostrar en el panel).
        'rates_as_of' => env('WHATSAPP_RATES_AS_OF', '2025-11'),

        // Tarifa por mensaje entregado, por categoría (USD, Colombia).
        // 'service' es gratis; 'utility' es gratis dentro de la ventana de 24h
        // (Meta lo marca como no facturable y no se suma al costo).
        'rates' => [
            'marketing' => (float) env('WHATSAPP_RATE_MARKETING', 0.0125),
            'utility' => (float) env('WHATSAPP_RATE_UTILITY', 0.0008),
            'authentication' => (float) env('WHATSAPP_RATE_AUTHENTICATION', 0.0008),
            'service' => (float) env('WHATSAPP_RATE_SERVICE', 0.0),
        ],

    ],

];
