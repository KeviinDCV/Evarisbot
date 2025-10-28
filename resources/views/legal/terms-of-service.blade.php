<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Términos de Servicio - Hospital Universitario del Valle</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2e3f84;
            margin-bottom: 10px;
            font-size: 2em;
        }
        h2 {
            color: #2e3f84;
            margin-top: 30px;
            margin-bottom: 15px;
            font-size: 1.5em;
        }
        p {
            margin-bottom: 15px;
            text-align: justify;
        }
        .last-updated {
            color: #666;
            font-size: 0.9em;
            margin-bottom: 30px;
        }
        ul {
            margin-left: 30px;
            margin-bottom: 15px;
        }
        li {
            margin-bottom: 8px;
        }
        .important {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
        }
        .contact {
            background: #f0f2f8;
            padding: 20px;
            border-radius: 8px;
            margin-top: 30px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Términos de Servicio</h1>
        <p class="last-updated">Última actualización: {{ date('d/m/Y') }}</p>

        <h2>1. Aceptación de los Términos</h2>
        <p>
            Al utilizar el servicio de atención por WhatsApp del Hospital Universitario del Valle "Evaristo Garcia", usted acepta estos Términos de Servicio. Si no está de acuerdo con estos términos, por favor no utilice este servicio.
        </p>

        <h2>2. Descripción del Servicio</h2>
        <p>
            Nuestro servicio de WhatsApp Business proporciona:
        </p>
        <ul>
            <li>Información general sobre servicios médicos del hospital</li>
            <li>Atención a consultas de pacientes y familiares</li>
            <li>Coordinación de citas médicas</li>
            <li>Seguimiento de pacientes</li>
            <li>Soporte y orientación general</li>
        </ul>

        <div class="important">
            <strong>IMPORTANTE:</strong> Este servicio NO sustituye la atención médica de emergencia. En caso de emergencia médica, llame al 123 o acuda al servicio de urgencias más cercano.
        </div>

        <h2>3. Uso Aceptable</h2>
        <p>Al usar este servicio, usted se compromete a:</p>
        <ul>
            <li>Proporcionar información veraz y precisa</li>
            <li>No compartir información falsa o engañosa</li>
            <li>No usar el servicio para fines ilegales o no autorizados</li>
            <li>Tratar al personal con respeto y cortesía</li>
            <li>No enviar contenido ofensivo, abusivo o inapropiado</li>
            <li>No hacer uso comercial o promocional del servicio</li>
        </ul>

        <h2>4. Limitaciones del Servicio</h2>
        <p>
            Este servicio tiene las siguientes limitaciones:
        </p>
        <ul>
            <li><strong>NO es un servicio de emergencias:</strong> Para emergencias, contacte el 123</li>
            <li><strong>NO reemplaza consultas médicas presenciales:</strong> La información proporcionada es orientativa</li>
            <li><strong>Horario de atención:</strong> El servicio opera en horarios específicos del hospital</li>
            <li><strong>Tiempo de respuesta:</strong> Nos esforzamos por responder rápidamente, pero no garantizamos tiempos específicos</li>
            <li><strong>No diagnóstico por chat:</strong> No realizamos diagnósticos médicos a través de mensajes</li>
        </ul>

        <h2>5. Privacidad y Confidencialidad</h2>
        <p>
            El manejo de su información está regido por nuestra <a href="{{ route('privacy-policy') }}">Política de Privacidad</a>. Toda información médica compartida es tratada con estricta confidencialidad conforme a las leyes colombianas de protección de datos y normativa sanitaria.
        </p>

        <h2>6. Propiedad Intelectual</h2>
        <p>
            Todo el contenido proporcionado a través de este servicio, incluyendo texto, imágenes, y materiales educativos, es propiedad del Hospital Universitario del Valle o de sus licenciantes y está protegido por leyes de propiedad intelectual.
        </p>

        <h2>7. Disponibilidad del Servicio</h2>
        <p>
            Nos esforzamos por mantener el servicio disponible, pero no garantizamos que esté libre de interrupciones. El servicio puede experimentar:
        </p>
        <ul>
            <li>Mantenimiento programado</li>
            <li>Interrupciones técnicas</li>
            <li>Limitaciones de la plataforma WhatsApp</li>
            <li>Factores externos fuera de nuestro control</li>
        </ul>

        <h2>8. Responsabilidades y Limitación de Responsabilidad</h2>
        <p>
            El Hospital no será responsable por:
        </p>
        <ul>
            <li>Daños derivados del uso incorrecto del servicio</li>
            <li>Retrasos en las respuestas o fallas técnicas</li>
            <li>Información proporcionada por terceros</li>
            <li>Decisiones tomadas basadas únicamente en la información del chat</li>
            <li>Interrupciones del servicio de WhatsApp por parte de Meta</li>
        </ul>

        <h2>9. Modificación de los Términos</h2>
        <p>
            Nos reservamos el derecho de modificar estos términos en cualquier momento. Las modificaciones entrarán en vigor inmediatamente después de su publicación. Es su responsabilidad revisar periódicamente estos términos.
        </p>

        <h2>10. Suspensión y Terminación</h2>
        <p>
            Nos reservamos el derecho de suspender o terminar el acceso al servicio a cualquier usuario que:
        </p>
        <ul>
            <li>Viole estos Términos de Servicio</li>
            <li>Haga uso indebido o abusivo del servicio</li>
            <li>Proporcione información falsa</li>
            <li>Acose o amenace al personal</li>
        </ul>

        <h2>11. Ley Aplicable</h2>
        <p>
            Estos términos se rigen por las leyes de la República de Colombia. Cualquier disputa será resuelta en los tribunales competentes de Cali, Valle del Cauca, Colombia.
        </p>

        <h2>12. Información de Contacto</h2>
        <div class="contact">
            <p><strong>Para preguntas sobre estos términos o nuestro servicio:</strong></p>
            <p>
                <strong>Hospital Universitario del Valle "Evaristo Garcia"</strong><br>
                Email: atencionusuario@hospitaluniversitariodelvalle.gov.co<br>
                Teléfono: +57 (2) XXX XXXX<br>
                Dirección: Cali, Valle del Cauca, Colombia<br>
                Horario de atención: Lunes a Viernes, 8:00 AM - 5:00 PM
            </p>
        </div>

        <h2>13. Consentimiento</h2>
        <p>
            Al utilizar este servicio, usted reconoce que ha leído, entendido y acepta estos Términos de Servicio y nuestra Política de Privacidad.
        </p>

        <p style="margin-top: 30px; text-align: center; color: #666; font-size: 0.9em;">
            © {{ date('Y') }} Hospital Universitario del Valle "Evaristo Garcia". Todos los derechos reservados.
        </p>
    </div>
</body>
</html>
