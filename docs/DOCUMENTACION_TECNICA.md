# INNOVACIÓN Y DESARROLLO - HOSPITAL UNIVERSITARIO DEL VALLE
# EVARISBOT

# DOCUMENTACIÓN TÉCNICA

## 1. DESCRIPCIÓN GENERAL DE LA ARQUITECTURA

**Evarisbot** es una solución empresarial construida sobre una arquitectura monolítica moderna, utilizando el framework **Laravel 12** como núcleo backend, acoplado estrechamente con **Inertia.js** para servir un frontend reactivo basado en **React 19** y **TypeScript**.

El sistema sigue el patrón de diseño **MVC (Modelo-Vista-Controlador)**, pero adaptado para SPAs (Single Page Applications) modernas, donde la "Vista" es renderizada en el cliente (navegador) pero enrutada desde el servidor.

### 1.1 Diagrama de Componentes Lógicos

1.  **Capa de Presentación (Frontend):**
    -   React 19 + TypeScript.
    -   TailwindCSS 4.0 para estilos utilitarios.
    -   Inertia.js para el manejo de estado y navegación sin recarga (SPA).
    -   Componentes UI basados en Radix UI.

2.  **Capa de Aplicación (Backend):**
    -   Laravel 12 (PHP 8.2+).
    -   Controladores HTTP para lógica de negocio.
    -   Jobs y Queues para procesamiento asíncrono (envío masivo).
    -   Events y Listeners para desacoplamiento lógico.

3.  **Capa de Tiempo Real:**
    -   **Laravel Reverb:** Servidor WebSocket nativo de Laravel. Maneja la distribución de mensajes entrantes (WhatsApp) a las interfaces de los asesores conectados instantáneamente sin polling.

4.  **Capa de Datos:**
    -   **MySQL 8.0:** Almacenamiento relacional principal.
    -   **Sistema de Archivos:** Almacenamiento de logs y archivos adjuntos (Storage local).

---

## 2. ESTRUCTURA DE BASE DE DATOS (ESQUEMA)

A continuación se detalla el esquema relacional de la base de datos, fundamental para entender el flujo de datos.

### 2.1 Tabla `users` (Usuarios del Sistema)
Almacena la información de autenticación y perfil de los asesores y administradores.
*   `id`: Primary Key.
*   `name`: Nombre completo.
*   `email`: Correo corporativo (Único).
*   `password`: Hash bcrypt.
*   `two_factor_secret`: Para autenticación 2FA.
*   `is_on_duty`: Booleano, indica si el asesor está "En turno" y disponible para asignación automática.
*   `last_activity`: Timestamp de última acción.

### 2.2 Tabla `conversations` (Conversaciones)
Representa un hilo de chat único con un número de WhatsApp (Paciente).
*   `id`: PK.
*   `phone_number`: Número de teléfono del paciente (Formato E.164, ej: 573001234567).
*   `name`: Nombre del contacto (proisto por WhatsApp o editado).
*   `status`: Enum (`open`, `closed`, `pending`).
*   `assigned_to`: FK a `users.id` (Asesor responsable).
*   `last_message_at`: Timestamp para ordenamiento.
*   `unread_count`: Contador de mensajes no leídos.
*   `channel_id`: Identificador del canal (si se manejan múltiples líneas, por defecto 1).

### 2.3 Tabla `messages` (Mensajes)
Almacena cada mensaje individual dentro de una conversación.
*   `id`: PK.
*   `conversation_id`: FK a `conversations.id`.
*   `whatsapp_mid`: ID único del mensaje en la API de Meta (para deduplicación).
*   `type`: Enum (`text`, `image`, `document`, `audio`, `template`, `sticker`).
*   `direction`: Enum (`inbound` = entrante, `outbound` = saliente).
*   `body`: Contenido textual del mensaje.
*   `media_url`: Ruta al archivo adjunto (si aplica).
*   `status`: Enum (`sent`, `delivered`, `read`, `failed`).
*   `transcription`: Texto transcrito si es un audio (procesado por Groq).
*   `created_at`: Fecha de creación.

### 2.4 Tabla `appointments` (Citas y Recordatorios)
Tabla central para el módulo de recordatorios automáticos.
*   `id`: PK.
*   `patient_name`: Nombre del paciente.
*   `patient_phone`: Teléfono normalizado.
*   `appointment_date`: Fecha de la cita.
*   `appointment_time`: Hora de la cita.
*   `location`: Consultorio o Sede.
*   `doctor`: Nombre del profesional.
*   `specialty`: Especialidad médica.
*   `procedure_code`: Código del procedimiento (CUPS).
*   `status`: Enum (`pending`, `confirmed`, `cancelled`, `rescheduled`, `no_answer`).
*   `reminder_status`: Estado del envío del recordatorio (`pending`, `sent`, `failed`).
*   `batch_id`: ID del lote de carga (Tanda).

### 2.5 Tabla `templates` (Plantillas)
Plantillas de mensajes aprobadas por WhatsApp para iniciar conversaciones (HSM - High Structured Messages).
*   `id`: PK.
*   `name`: Nombre interno (ej: `recordatorio_cita_v1`).
*   `content`: Texto de la plantilla con variables `{{1}}`, `{{2}}`.
*   `status`: Estado de aprobación en Meta.
*   `category`: `UTILITY`, `MARKETING`, `AUTHENTICATION`.
*   `language`: Código de idioma (`es`).

---

## 3. FLUJO DE DATOS Y PROCESOS CLAVE

### 3.1 Recepción de Mensajes (Webhook)
El archivo `routes/web.php` o `api.php` define la ruta POST `/webhook/whatsapp`.
1.  **Manejo:** `App\Http\Controllers\WebhookController`.
2.  **Validación:** Se verifica la firma SHA256 (`X-Hub-Signature`).
3.  **Procesamiento:**
    -   Se busca o crea la `Conversation` basada en el teléfono.
    -   Se guarda el `Message` en base de datos.
    -   Se dispara el evento `MessageReceived`.
4.  **Broadcast:** El evento `MessageReceived` envía el payload a través de **Reverb** al canal privado `chat.{conversation_id}` y al canal global `dashboard`.
5.  **Cliente:** El frontend recibe el evento y actualiza la UI instantáneamente.

### 3.2 Envío de Recordatorios (Tandas)
El módulo de citas permite cargar archivos Excel masivos.
1.  **Carga:** El administrador sube un Excel.
2.  **Validación:** `App\Imports\AppointmentsImport` valida columnas y formatos.
3.  **Colas:** Se crean Jobs `SendAppointmentReminder` en la tabla `jobs`.
4.  **Ejecución:** El worker (`php artisan queue:work`) procesa cada job:
    -   Verifica si el número es válido.
    -   Envía la plantilla correspondiente usando la API de WhatsApp.
    -   Actualiza el `reminder_status` a `sent`.
    -   Si el envío falla, reintenta según configuración de la cola.

### 3.3 Gestión de Estado de Citas
Cuando un paciente responde "CONFIRMO" o "CANCELO":
1.  El mensaje entra como texto normal.
2.  Un proceso (Bot básico o Asesor) identifica la palabra clave.
3.  Se actualiza el campo `status` en la tabla `appointments`.
4.  Se genera reporte de confirmación.

---

## 4. INTEGRACIONES EXTERNAS (APIs)

### 4.1 Meta Graph API (WhatsApp)
Documentación oficial: `developers.facebook.com/docs/whatsapp/cloud-api`
-   **Endpoint Base:** `https://graph.facebook.com/v18.0/`
-   **Autenticación:** Bearer Token.
-   **Límites:** Dependen del "Tier" de la cuenta de WhatsApp Business (1k, 10k, 100k conversaciones/día).

### 4.2 Groq (IA)
Utilizado para transcripción de audios (Whisper timestamped) y sugerencias de respuesta (LLaMA 3).
-   **Clase Wrapper:** `App\Services\GroqService`.
-   **Uso:** Al recibir un mensaje de tipo `audio`, se envía el binario a Groq, se recibe el texto json y se guarda en `messages.transcription`.

---

## 5. ESTRUCTURA DEL DIRECTORIO (DETALLADA)

*   `app/Http/Controllers/Admin/`: Controladores protegidos para gestión administrativa.
*   `app/Services/WhatsAppService.php`: Capa de abstracción para todas las peticiones a la API de Meta. Contiene métodos como `sendMessage`, `sendTemplate`, `markAsRead`.
*   `resources/js/Pages/Admin/Chat/`: Componentes principales de la interfaz de chat.
    *   `ChatIndex.tsx`: Layout principal.
    *   `ChatSidebar.tsx`: Lista de conversaciones con búsqueda y filtros.
    *   `ChatWindow.tsx`: Área de mensajes y input.
    *   `ChatInfo.tsx`: Panel lateral derecho con info del paciente.
*   `routes/channels.php`: Definición de canales de autorización para WebSockets.

---

## 6. SEGURIDAD

### 6.1 Autenticación y Autorización
-   Middleware `auth`: Protege rutas generales.
-   Middleware `role:admin`: Exclusivo para configuración sensible.
-   Políticas (Policies): Se utilizan para validar si un usuario puede ver una conversación específica.

### 6.2 Protección de Datos
-   Los teléfonos se almacenan tal cual, pero los accesos a exportaciones están logueados.
-   Sanitización de inputs para prevenir XSS e inyección SQL.

---

**ÁREA DE INNOVACIÓN Y DESARROLLO**
**HOSPITAL UNIVERSITARIO DEL VALLE**

