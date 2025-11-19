# Documentación Técnica - Evarisbot
## Sistema de Gestión de Conversaciones de WhatsApp Business

**Versión:** 1.0  
**Fecha:** Noviembre 2024  
**Tipo:** Documentación Técnica Profesional

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Arquitectura del Sistema](#3-arquitectura-del-sistema)
4. [Modelos de Datos](#4-modelos-de-datos)
5. [API y Servicios](#5-api-y-servicios)
6. [Integración WhatsApp Business API](#6-integración-whatsapp-business-api)
7. [Sistema de Autenticación](#7-sistema-de-autenticación)
8. [Frontend y UI/UX](#8-frontend-y-uiux)
9. [Sistema de Colas y Jobs](#9-sistema-de-colas-y-jobs)
10. [Módulo de Informes](#10-módulo-de-informes)
11. [Instalación y Despliegue](#11-instalación-y-despliegue)
12. [Configuración de Producción](#12-configuración-de-producción)
13. [Seguridad](#13-seguridad)
14. [Monitoreo y Logs](#14-monitoreo-y-logs)
15. [Mantenimiento](#15-mantenimiento)
16. [Troubleshooting](#16-troubleshooting)
17. [Roadmap y Mejoras Futuras](#17-roadmap-y-mejoras-futuras)

---

## 1. Resumen Ejecutivo

### 1.1 Propósito del Sistema

Evarisbot es una aplicación web empresarial diseñada para centralizar y gestionar las comunicaciones de WhatsApp Business de los Servicios Ambulatorios. El sistema permite:

- **Gestión Centralizada:** Recibir y responder mensajes de WhatsApp desde una interfaz web
- **Multi-usuario:** Múltiples asesores trabajando simultáneamente
- **Trazabilidad Completa:** Registro histórico de todas las interacciones
- **Automatización:** Recordatorios automáticos de citas médicas
- **Análisis:** Informes y estadísticas detalladas en tiempo real
- **Escalabilidad:** Diseñado para manejar miles de conversaciones

### 1.2 Características Principales

**Funcionales:**
- Integración nativa con WhatsApp Business API (Meta)
- Sistema de asignación de conversaciones a asesores
- Envío programado de recordatorios de citas
- Plantillas de mensajes reutilizables
- Búsqueda y filtrado avanzado de conversaciones
- Exportación de estadísticas a Excel/PDF
- Gestión de archivos multimedia (imágenes, documentos)
- Notas internas por conversación
- Sistema de roles (Administrador/Asesor)

**Técnicas:**
- Arquitectura moderna PHP/JavaScript
- Single Page Application (SPA) con Inertia.js
- API RESTful
- Base de datos relacional (SQLite/MySQL/PostgreSQL)
- Sistema de colas para procesamiento asíncrono
- WebSockets para actualizaciones en tiempo real
- Autenticación de dos factores (2FA)
- Encriptación de datos sensibles

### 1.3 Casos de Uso Principales

1. **Atención al Paciente:**
   - Paciente envía mensaje → Sistema recibe → Asesor responde → Histórico se guarda

2. **Recordatorios de Citas:**
   - Sistema lee citas programadas → Envía recordatorios 48h antes → Paciente confirma/cancela → Sistema actualiza estado

3. **Gestión de Conversaciones:**
   - Nueva conversación → Asignar a asesor → Asesor gestiona → Marca como resuelta → Cierra conversación

4. **Generación de Reportes:**
   - Administrador selecciona período → Sistema calcula métricas → Exporta a Excel/PDF → Descarga

---

## 2. Stack Tecnológico

### 2.1 Backend

**Framework Principal:**
```json
{
  "framework": "Laravel",
  "version": "12.x",
  "php_version": "8.2+",
  "tipo": "Framework PHP full-stack"
}
```

**Dependencias Backend Principales:**

```json
{
  "inertiajs/inertia-laravel": "^2.0",
  "laravel/fortify": "^1.30",
  "laravel/reverb": "^1.6",
  "maatwebsite/excel": "^1.1",
  "phpoffice/phpspreadsheet": "^5.2",
  "twilio/sdk": "^8.8"
}
```

**Descripción de Dependencias:**

- **Inertia Laravel:** Adaptador backend para SPA sin API REST tradicional
- **Laravel Fortify:** Sistema de autenticación con soporte 2FA
- **Laravel Reverb:** Servidor WebSocket nativo de Laravel
- **Maatwebsite Excel:** Generación de archivos Excel
- **PHPSpreadsheet:** Librería de manipulación de hojas de cálculo
- **Twilio SDK:** Integración alternativa (no implementada actualmente)

### 2.2 Frontend

**Framework y Librerías:**

```json
{
  "framework": "React",
  "version": "19.0.0",
  "typescript": "5.7.2",
  "bundler": "Vite 7.0.4"
}
```

**Dependencias Frontend Principales:**

```json
{
  "@inertiajs/react": "^2.1.4",
  "@radix-ui/*": "Múltiples componentes UI",
  "lucide-react": "^0.475.0",
  "tailwindcss": "^4.0.0",
  "recharts": "^3.4.1",
  "laravel-echo": "^2.2.4",
  "pusher-js": "^8.4.0",
  "i18next": "^25.6.0"
}
```

**Descripción de Dependencias:**

- **Inertia React:** Adaptador frontend para SPA con Laravel
- **Radix UI:** Componentes accesibles sin estilos (headless UI)
- **Lucide React:** Librería de iconos moderna
- **TailwindCSS 4:** Framework de utilidades CSS
- **Recharts:** Librería de gráficos para estadísticas
- **Laravel Echo + Pusher:** Cliente WebSocket para tiempo real
- **i18next:** Internacionalización (preparado para múltiples idiomas)

### 2.3 Base de Datos

**Soportadas:**

```yaml
Primaria (Desarrollo): SQLite 3
Producción (Recomendada): MySQL 8.0+ / PostgreSQL 14+
Motor: InnoDB (MySQL) / Estándar (PostgreSQL)
Encoding: UTF-8 (utf8mb4 en MySQL)
```

**ORM:**
- Laravel Eloquent ORM
- Query Builder para consultas complejas
- Migraciones versionadas

### 2.4 APIs Externas

**WhatsApp Business API (Meta):**

```yaml
Proveedor: Meta (Facebook)
Versión API: Graph API v18.0
Endpoint Base: https://graph.facebook.com/v18.0
Autenticación: Bearer Token
Formato: JSON
```

**Endpoints Utilizados:**
- `POST /{phone_number_id}/messages` - Enviar mensajes
- `POST /{phone_number_id}/messages` - Marcar como leído
- `GET /webhook` - Verificación webhook
- `POST /webhook` - Recepción de mensajes

### 2.5 Infraestructura

**Servidor Web:**
```yaml
Desarrollo: PHP Built-in Server (artisan serve)
Producción: 
  - Apache 2.4+ con mod_rewrite
  - Nginx 1.20+ con PHP-FPM 8.2+
```

**Caché:**
```yaml
Driver: database (por defecto)
Alternativas: Redis, Memcached
```

**Colas:**
```yaml
Driver: database (por defecto)
Alternativas: Redis, SQS, Beanstalkd
```

**Sesiones:**
```yaml
Driver: database
Lifetime: 120 minutos
Encriptación: Opcional
```

### 2.6 Herramientas de Desarrollo

**Control de Calidad:**

```json
{
  "testing": "Pest PHP ^3.8",
  "linting_php": "Laravel Pint ^1.18",
  "linting_js": "ESLint ^9.17.0",
  "formatting": "Prettier ^3.4.2",
  "type_checking": "TypeScript ^5.7.2"
}
```

**Build Tools:**

```json
{
  "bundler": "Vite 7.0.4",
  "compiler": "esbuild (interno en Vite)",
  "css_processor": "TailwindCSS 4.0 + PostCSS",
  "concurrent_tasks": "concurrently 9.0.1"
}
```

---

## 3. Arquitectura del Sistema

### 3.1 Diagrama de Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENTE (Navegador)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │        React 19 + Inertia.js + TailwindCSS          │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │   │
│  │  │   Pages    │  │ Components │  │   Layouts  │    │   │
│  │  └────────────┘  └────────────┘  └────────────┘    │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/HTTPS + WebSocket
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              SERVIDOR WEB (Apache/Nginx)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │             Laravel 12 (Backend)                     │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │   │
│  │  │ Controllers│  │  Services  │  │    Jobs    │    │   │
│  │  └────────────┘  └────────────┘  └────────────┘    │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │   │
│  │  │   Models   │  │Middleware  │  │   Events   │    │   │
│  │  └────────────┘  └────────────┘  └────────────┘    │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────┬──────────────────────────┬──────────────────────┘
            │                          │
            ▼                          ▼
┌──────────────────────┐   ┌──────────────────────────────┐
│  Base de Datos       │   │   WhatsApp Business API      │
│  SQLite/MySQL/       │   │   (Meta Graph API v18.0)     │
│  PostgreSQL          │   │   https://graph.facebook.com │
└──────────────────────┘   └──────────────────────────────┘
```

### 3.2 Patrón de Arquitectura

**Modelo:** MVC + Service Layer

```
Vista (React + Inertia)
      ↓
Controlador (Laravel Controllers)
      ↓
Servicio (Service Classes) ← Lógica de Negocio
      ↓
Modelo (Eloquent Models)
      ↓
Base de Datos
```

**Beneficios:**
- Separación clara de responsabilidades
- Código reutilizable en servicios
- Testeable y mantenible
- Escalable

### 3.3 Estructura de Directorios

```
evarisbot/
├── app/
│   ├── Console/
│   │   └── Commands/          # Comandos Artisan personalizados
│   ├── Events/
│   │   ├── MessageSent.php
│   │   └── NewMessageReceived.php
│   ├── Exports/
│   │   └── StatisticsExport.php
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── Admin/
│   │   │   │   ├── ConversationController.php
│   │   │   │   ├── SettingsController.php
│   │   │   │   ├── StatisticsController.php
│   │   │   │   ├── TemplateController.php
│   │   │   │   └── UserController.php
│   │   │   └── WhatsAppWebhookController.php
│   │   ├── Middleware/
│   │   │   ├── CheckRole.php
│   │   │   ├── HandleAppearance.php
│   │   │   └── HandleInertiaRequests.php
│   │   └── Requests/          # Form Requests para validación
│   ├── Jobs/
│   │   └── SendAppointmentReminder.php
│   ├── Models/
│   │   ├── Appointment.php
│   │   ├── Conversation.php
│   │   ├── Message.php
│   │   ├── Setting.php
│   │   ├── Template.php
│   │   ├── TemplateSend.php
│   │   └── User.php
│   └── Services/
│       └── WhatsAppService.php
├── bootstrap/
├── config/                     # Configuraciones
├── database/
│   ├── migrations/             # Migraciones de BD
│   ├── seeders/                # Seeders de datos
│   └── database.sqlite         # BD SQLite (desarrollo)
├── public/                     # Assets públicos
├── resources/
│   ├── css/
│   │   └── app.css             # Variables CSS, estilos globales
│   ├── js/
│   │   ├── app.tsx             # Entry point React
│   │   ├── components/         # Componentes reutilizables
│   │   ├── hooks/              # Custom React Hooks
│   │   ├── layouts/            # Layouts de página
│   │   │   ├── admin-layout.tsx
│   │   │   ├── app-layout.tsx
│   │   │   └── auth/
│   │   │       └── auth-simple-layout.tsx
│   │   └── pages/              # Páginas Inertia
│   │       ├── admin/
│   │       │   ├── chat/
│   │       │   ├── settings/
│   │       │   ├── statistics/
│   │       │   └── users/
│   │       └── auth/
│   ├── lang/                   # Traducciones
│   └── views/
│       └── app.blade.php       # Template raíz
├── routes/
│   ├── auth.php                # Rutas de autenticación
│   ├── channels.php            # Canales de broadcast
│   ├── console.php             # Rutas de consola
│   ├── settings.php            # Rutas de configuración
│   └── web.php                 # Rutas principales
├── storage/
│   ├── app/
│   ├── framework/
│   └── logs/
├── tests/                      # Tests automatizados
├── .env.example                # Variables de entorno ejemplo
├── artisan                     # CLI de Laravel
├── composer.json               # Dependencias PHP
├── package.json                # Dependencias JavaScript
├── phpunit.xml                 # Config PHPUnit
├── vite.config.ts              # Config Vite
└── tsconfig.json               # Config TypeScript
```

### 3.4 Flujo de Datos

**Flujo de Recepción de Mensaje:**

```
WhatsApp → Webhook (POST) → WhatsAppWebhookController::handle()
                                      ↓
                          WhatsAppService::processIncomingMessage()
                                      ↓
                          Buscar/Crear Conversation
                                      ↓
                          Crear Message (is_from_user=true)
                                      ↓
                          Event: NewMessageReceived
                                      ↓
                          Broadcast via WebSocket (opcional)
                                      ↓
                          Marcar como leído en WhatsApp API
```

**Flujo de Envío de Mensaje:**

```
Usuario escribe → React Component → Inertia Post Request
                                           ↓
                              ConversationController::sendMessage()
                                           ↓
                              WhatsAppService::sendTextMessage()
                                           ↓
                              WhatsApp Graph API
                                           ↓
                              Crear Message (is_from_user=false)
                                           ↓
                              Event: MessageSent
                                           ↓
                              Actualizar UI via Inertia
```

---

## 4. Modelos de Datos

### 4.1 Diagrama de Entidad-Relación (ERD)

```
┌────────────────┐
│     User       │
└────────────────┘
│ id             │
│ name           │
│ email          │
│ password       │
│ role           │◄──────┐
│ timestamps     │       │
└────────────────┘       │
        │                │
        │                │ assigned_to
        │ sent_by        │
        │                │
        ▼                │
┌────────────────┐       │
│    Message     │       │
└────────────────┘       │
│ id             │       │
│ conversation_id│───┐   │
│ content        │   │   │
│ message_type   │   │   │
│ media_url      │   │   │
│ is_from_user   │   │   │
│ whatsapp_msg_id│   │   │
│ status         │   │   │
│ sent_by        │───┘   │
│ timestamps     │       │
└────────────────┘       │
        ▲                │
        │                │
        │ messages       │
        │                │
┌────────────────────────┼─┐
│   Conversation         │ │
└────────────────────────┼─┘
│ id                     │ │
│ phone_number (unique)  │ │
│ contact_name           │ │
│ profile_picture_url    │ │
│ status                 │ │
│ assigned_to            │─┘
│ last_message_at        │
│ unread_count           │
│ notes                  │
│ timestamps             │
└────────────────────────┘
        ▲
        │
        │ conversation_id
        │
┌────────────────┐
│  Appointment   │
└────────────────┘
│ id             │
│ conversation_id│
│ appointment_date│
│ patient_name   │
│ phone_number   │
│ service_type   │
│ reminder_sent  │
│ reminder_status│
│ timestamps     │
└────────────────┘

┌────────────────┐
│    Setting     │
└────────────────┘
│ id             │
│ key (unique)   │
│ value          │
│ is_encrypted   │
│ description    │
│ updated_by     │
│ timestamps     │
└────────────────┘

┌────────────────┐
│    Template    │
└────────────────┘
│ id             │
│ name           │
│ content        │
│ category       │
│ variables      │
│ timestamps     │
└────────────────┘
        ▲
        │
        │ template_id
        │
┌────────────────┐
│ TemplateSend   │
└────────────────┘
│ id             │
│ template_id    │
│ successful_sends│
│ failed_sends   │
│ last_sent_at   │
│ timestamps     │
└────────────────┘
```

### 4.2 Modelo User

**Archivo:** `app/Models/User.php`

**Campos:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | bigint | ID único autoincremental |
| name | string(255) | Nombre completo del usuario |
| email | string(255) | Email único (usado para login) |
| password | string | Contraseña hasheada (bcrypt) |
| role | enum | 'admin' o 'advisor' |
| two_factor_secret | text nullable | Secret para 2FA |
| two_factor_recovery_codes | text nullable | Códigos de recuperación 2FA |
| timestamps | timestamp | created_at, updated_at |

**Roles:**
- `admin`: Acceso completo al sistema
- `advisor`: Solo acceso a chat y conversaciones asignadas

**Métodos Principales:**

```php
// Verificar si es administrador
public function isAdmin(): bool

// Verificar si es asesor
public function isAdvisor(): bool

// Conversaciones asignadas
public function assignedConversations(): HasMany

// Mensajes enviados
public function sentMessages(): HasMany
```

**Relaciones:**
- `hasMany(Conversation::class, 'assigned_to')` - Conversaciones asignadas
- `hasMany(Message::class, 'sent_by')` - Mensajes enviados

### 4.3 Modelo Conversation

**Archivo:** `app/Models/Conversation.php`

**Campos:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | bigint | ID único |
| phone_number | string(20) unique | Número de WhatsApp (formato: +57XXXXXXXXXX) |
| contact_name | string(255) nullable | Nombre del contacto |
| profile_picture_url | string nullable | URL de foto de perfil |
| status | enum | 'active', 'pending', 'in_progress', 'resolved', 'closed' |
| assigned_to | bigint nullable | ID del usuario asignado |
| last_message_at | timestamp nullable | Fecha del último mensaje |
| unread_count | integer | Contador de mensajes sin leer |
| notes | text nullable | Notas internas del equipo |
| timestamps | timestamp | created_at, updated_at |

**Estados:**

```php
'active'      // Conversación activa
'pending'     // Esperando asignación
'in_progress' // En atención
'resolved'    // Resuelta
'closed'      // Cerrada/archivada
```

**Métodos Principales:**

```php
// Marcar todos los mensajes como leídos
public function markAsRead(): void

// Incrementar contador de no leídos
public function incrementUnread(): void

// Obtener último mensaje
public function lastMessage(): HasOne

// Scopes de búsqueda
public function scopeActive($query)
public function scopePending($query)
public function scopeAssignedTo($query, $userId)
public function scopeUnassigned($query)
public function scopeWithUnread($query)
```

**Relaciones:**
- `hasMany(Message::class)` - Mensajes de la conversación
- `hasOne(Message::class)->latestOfMany()` - Último mensaje
- `belongsTo(User::class, 'assigned_to')` - Usuario asignado
- `hasMany(Appointment::class)` - Citas asociadas

### 4.4 Modelo Message

**Archivo:** `app/Models/Message.php`

**Campos:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | bigint | ID único |
| conversation_id | bigint | ID de conversación |
| content | text nullable | Contenido del mensaje |
| message_type | enum | 'text', 'image', 'document', 'audio', 'video', 'location' |
| media_url | string nullable | URL del archivo multimedia |
| media_mime_type | string nullable | Tipo MIME del archivo |
| media_filename | string nullable | Nombre del archivo |
| is_from_user | boolean | true si es del paciente, false si es del sistema |
| whatsapp_message_id | string nullable unique | ID de WhatsApp |
| status | enum | 'pending', 'sent', 'delivered', 'read', 'failed' |
| error_message | text nullable | Mensaje de error si falla |
| sent_by | bigint nullable | ID del usuario que envió (si is_from_user=false) |
| timestamps | timestamp | created_at, updated_at |

**Tipos de Mensaje:**

```php
'text'     // Mensaje de texto
'image'    // Imagen (jpg, png, etc.)
'document' // Documento (pdf, docx, xlsx, etc.)
'audio'    // Audio/Nota de voz
'video'    // Video
'location' // Ubicación geográfica
```

**Estados:**

```php
'pending'   // En cola de envío
'sent'      // Enviado a WhatsApp
'delivered' // Entregado al destinatario
'read'      // Leído por el destinatario
'failed'    // Falló el envío
```

**Métodos Principales:**

```php
// Verificar si es del usuario/paciente
public function isFromUser(): bool

// Verificar si es del asesor
public function isFromAdvisor(): bool

// Verificar si tiene multimedia
public function hasMedia(): bool

// Obtener icono según tipo
public function getTypeIcon(): string
```

**Relaciones:**
- `belongsTo(Conversation::class)` - Conversación padre
- `belongsTo(User::class, 'sent_by')` - Usuario que envió

### 4.5 Modelo Appointment

**Archivo:** `app/Models/Appointment.php`

**Campos:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | bigint | ID único |
| conversation_id | bigint nullable | ID de conversación (si existe) |
| appointment_date | datetime | Fecha y hora de la cita |
| patient_name | string(255) | Nombre del paciente |
| phone_number | string(20) | Teléfono del paciente |
| service_type | string nullable | Tipo de servicio/especialidad |
| reminder_sent | boolean | Si se envió recordatorio |
| reminder_status | enum | Estado del recordatorio |
| reminder_sent_at | timestamp nullable | Cuándo se envió |
| timestamps | timestamp | created_at, updated_at |

**Estados de Recordatorio:**

```php
'pending'   // No enviado
'sent'      // Enviado
'delivered' // Entregado
'read'      // Leído
'confirmed' // Paciente confirmó
'cancelled' // Paciente canceló
'failed'    // Falló el envío
```

**Métodos Principales:**

```php
// Scope para citas que necesitan recordatorio
public function scopeNeedsReminder($query)

// Scope para citas próximas (24-48h)
public function scopeUpcoming($query, $hours = 48)

// Marcar recordatorio como enviado
public function markReminderSent(): void
```

**Relaciones:**
- `belongsTo(Conversation::class)` - Conversación asociada (nullable)

### 4.6 Modelo Setting

**Archivo:** `app/Models/Setting.php`

**Campos:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | bigint | ID único |
| key | string(255) unique | Clave de configuración |
| value | text nullable | Valor (puede estar encriptado) |
| is_encrypted | boolean | Si el valor está encriptado |
| description | text nullable | Descripción de la configuración |
| updated_by | bigint nullable | ID del usuario que actualizó |
| timestamps | timestamp | created_at, updated_at |

**Configuraciones Principales:**

```php
// WhatsApp API
'whatsapp_token'                // Token de acceso (ENCRIPTADO)
'whatsapp_phone_id'             // ID del número de WhatsApp
'whatsapp_business_account_id'  // ID de cuenta de negocio
'whatsapp_verify_token'         // Token de verificación webhook (ENCRIPTADO)
'whatsapp_app_secret'           // Secret de la app (ENCRIPTADO)
'whatsapp_webhook_url'          // URL del webhook

// Negocio
'business_name'                 // Nombre del negocio
'welcome_message'               // Mensaje de bienvenida automático
'away_message'                  // Mensaje fuera de horario
'business_hours'                // Horario de atención (JSON)
```

**Métodos Estáticos:**

```php
// Obtener valor de configuración
public static function get(string $key, $default = null)

// Guardar configuración
public static function set(string $key, $value, bool $encrypt = false): void

// Verificar si existe
public static function has(string $key): bool

// Eliminar configuración
public static function remove(string $key): void

// Obtener preview (primeros 8 caracteres si está encriptado)
public static function getPreview(string $key): ?string
```

**Caché:**
- Las configuraciones se cachean por 1 hora
- Se invalida el caché al actualizar

### 4.7 Modelo Template

**Archivo:** `app/Models/Template.php`

**Campos:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | bigint | ID único |
| name | string(255) | Nombre de la plantilla |
| content | text | Contenido del mensaje |
| category | string nullable | Categoría (recordatorio, bienvenida, etc.) |
| variables | json nullable | Variables disponibles |
| is_active | boolean | Si está activa |
| timestamps | timestamp | created_at, updated_at |

**Categorías Comunes:**

```php
'reminder'      // Recordatorios de cita
'welcome'       // Mensajes de bienvenida
'confirmation'  // Confirmaciones
'instruction'   // Instrucciones pre-cita
'followup'      // Seguimientos
'general'       // Generales
```

**Variables de Plantilla:**

```php
{patient_name}       // Nombre del paciente
{appointment_date}   // Fecha de la cita
{appointment_time}   // Hora de la cita
{service_type}       // Tipo de servicio
{business_name}      // Nombre del negocio
```

**Métodos:**

```php
// Reemplazar variables en el contenido
public function render(array $data): string

// Obtener plantillas activas por categoría
public function scopeActive($query)
public function scopeByCategory($query, $category)
```

**Relaciones:**
- `hasMany(TemplateSend::class)` - Registro de envíos

### 4.8 Modelo TemplateSend

**Archivo:** `app/Models/TemplateSend.php`

**Campos:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | bigint | ID único |
| template_id | bigint | ID de la plantilla |
| successful_sends | integer | Envíos exitosos |
| failed_sends | integer | Envíos fallidos |
| last_sent_at | timestamp nullable | Última vez enviado |
| timestamps | timestamp | created_at, updated_at |

**Propósito:**
- Rastrear uso de plantillas
- Estadísticas de efectividad
- Auditoría de envíos

**Relaciones:**
- `belongsTo(Template::class)` - Plantilla padre

---

## 5. API y Servicios

### 5.1 WhatsAppService

**Archivo:** `app/Services/WhatsAppService.php`

**Propósito:** Centralizar toda la lógica de integración con WhatsApp Business API

**Configuración:**

```php
private string $apiUrl = 'https://graph.facebook.com/v18.0';
private ?string $token;           // De Setting::get('whatsapp_token')
private ?string $phoneNumberId;   // De Setting::get('whatsapp_phone_id')
```

**Métodos Públicos:**

#### sendTextMessage(string $to, string $message): array

Envía un mensaje de texto.

```php
// Ejemplo de uso
$whatsapp = app(WhatsAppService::class);
$result = $whatsapp->sendTextMessage('+573001234567', 'Hola, este es un mensaje de prueba');

// Respuesta exitosa
[
    'success' => true,
    'message_id' => 'wamid.ABC123...',
    'data' => [...]
]

// Respuesta con error
[
    'success' => false,
    'error' => 'Mensaje descriptivo del error'
]
```

#### sendImageMessage(string $to, string $imageUrl, ?string $caption = null): array

Envía una imagen con caption opcional.

```php
$result = $whatsapp->sendImageMessage(
    '+573001234567',
    'https://example.com/image.jpg',
    'Esta es una imagen'
);
```

#### sendDocumentMessage(string $to, string $documentUrl, string $filename): array

Envía un documento (PDF, Word, Excel, etc.).

```php
$result = $whatsapp->sendDocumentMessage(
    '+573001234567',
    'https://example.com/documento.pdf',
    'Resultados_Laboratorio.pdf'
);
```

#### markAsRead(string $messageId): array

Marca un mensaje como leído en WhatsApp.

```php
$result = $whatsapp->markAsRead('wamid.ABC123...');
```

#### processIncomingMessage(array $messageData): void

Procesa mensajes entrantes desde el webhook.

```php
// Llamado desde WhatsAppWebhookController
$whatsapp->processIncomingMessage($messageData);
```

**Proceso:**
1. Extrae información del mensaje
2. Busca o crea la Conversation
3. Crea el Message
4. Incrementa unread_count
5. Marca como leído en WhatsApp

#### isConfigured(): bool

Verifica si la API está configurada correctamente.

```php
if (!$whatsapp->isConfigured()) {
    // Mostrar mensaje de error
}
```

**Métodos Privados:**

- `formatPhoneNumber(string $phone): string` - Limpia formato de número
- `handleWebhookStatus(array $statusData): void` - Procesa actualizaciones de estado

### 5.2 Rutas de la API

**Archivo:** `routes/web.php`

#### Rutas Públicas

```php
// Webhook de WhatsApp (debe ser accesible públicamente)
GET  /webhook/whatsapp          // Verificación del webhook por Meta
POST /webhook/whatsapp          // Recepción de mensajes
```

#### Rutas Autenticadas

```php
// Dashboard
GET /dashboard → DashboardController::index

// Chat y Conversaciones (prefix: /admin/chat)
GET    /admin/chat                              → ConversationController::index
GET    /admin/chat/{conversation}              → ConversationController::show
POST   /admin/chat/{conversation}/send         → ConversationController::sendMessage
POST   /admin/chat/{conversation}/assign       → ConversationController::assign
POST   /admin/chat/{conversation}/status       → ConversationController::updateStatus
```

#### Rutas de Administración

```php
// Usuarios (role:admin)
GET    /admin/users              → UserController::index
GET    /admin/users/create       → UserController::create
POST   /admin/users              → UserController::store
GET    /admin/users/{user}/edit  → UserController::edit
PUT    /admin/users/{user}       → UserController::update
DELETE /admin/users/{user}       → UserController::destroy

// Configuración (role:admin)
GET  /admin/settings                    → SettingsController::index
POST /admin/settings/whatsapp           → SettingsController::updateWhatsApp
POST /admin/settings/business           → SettingsController::updateBusiness
POST /admin/settings/test-whatsapp      → SettingsController::testWhatsAppConnection

// Estadísticas
GET  /admin/statistics         → StatisticsController::index
GET  /admin/statistics/export  → StatisticsController::export

// Plantillas
GET    /admin/templates              → TemplateController::index
POST   /admin/templates              → TemplateController::store
PUT    /admin/templates/{template}   → TemplateController::update
DELETE /admin/templates/{template}   → TemplateController::destroy

// Citas
GET  /admin/appointments         → AppointmentController::index
POST /admin/appointments/import  → AppointmentController::import
```

### 5.3 Controladores Principales

#### WhatsAppWebhookController

**Métodos:**

**verify(Request $request): Response**
```php
// Verifica el webhook con Meta
// Compara hub.verify_token con Setting::get('whatsapp_verify_token')
// Retorna hub.challenge si coincide
```

**handle(Request $request): Response**
```php
// Procesa mensajes entrantes y actualizaciones de estado
// Extrae entry[].changes[].value.messages[]
// Llama a WhatsAppService::processIncomingMessage()
```

#### ConversationController

**index(Request $request)**
- Lista conversaciones con filtros
- Soporta búsqueda por nombre/número
- Paginación

**show(Conversation $conversation)**
- Muestra detalles de conversación
- Carga mensajes con paginación
- Marca mensajes como leídos

**sendMessage(Request $request, Conversation $conversation)**
- Valida mensaje
- Envía via WhatsAppService
- Guarda en base de datos
- Retorna respuesta Inertia

**assign(Request $request, Conversation $conversation)**
- Asigna conversación a usuario
- Valida permisos
- Actualiza estado

**updateStatus(Request $request, Conversation $conversation)**
- Cambia estado de conversación
- Valida transiciones válidas

#### StatisticsController

**index(Request $request)**
- Calcula estadísticas según período
- Retorna datos para gráficos

**export(Request $request)**
- Genera archivo Excel
- Usa StatisticsExport
- Descarga archivo

### 5.4 Middleware

#### CheckRole

**Propósito:** Verificar rol del usuario

```php
// Uso en rutas
Route::middleware(['auth', 'role:admin'])->group(function () {
    // Solo administradores
});
```

#### HandleInertiaRequests

**Propósito:** Compartir datos globales con frontend

```php
public function share(Request $request): array
{
    return [
        'auth' => [
            'user' => $request->user(),
        ],
        'flash' => [
            'success' => session('success'),
            'error' => session('error'),
        ],
        'settings' => [
            'business_name' => Setting::get('business_name'),
        ],
    ];
}
```

---

## 6. Integración WhatsApp Business API

### 6.1 Configuración Inicial

**Requisitos:**

1. Cuenta de Meta Business
2. Aplicación de WhatsApp Business
3. Número de teléfono verificado
4. Token de acceso permanente

**Variables de Entorno:**

```env
WHATSAPP_TOKEN=EAAxxxxxxxxxxxxxxx
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_BUSINESS_ACCOUNT_ID=123456789012345
WHATSAPP_VERIFY_TOKEN=mi_token_secreto_2024
```

### 6.2 Configuración del Webhook

**URL del Webhook:**
```
https://tudominio.com/webhook/whatsapp
```

**Configuración en Meta:**

1. Ir a https://developers.facebook.com
2. Seleccionar tu aplicación
3. WhatsApp → Configuration
4. Webhook → Edit
5. Configurar:
   - **Callback URL:** `https://tudominio.com/webhook/whatsapp`
   - **Verify Token:** El valor de `WHATSAPP_VERIFY_TOKEN`
   - **Webhook fields:** Marcar `messages`

**Verificación:**

El endpoint GET debe responder:

```php
GET /webhook/whatsapp?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHALLENGE

Response: CHALLENGE (texto plano)
```

### 6.3 Recepción de Mensajes

**Estructura del Payload:**

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "BUSINESS_ACCOUNT_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "573001234567",
          "phone_number_id": "PHONE_NUMBER_ID"
        },
        "contacts": [{
          "profile": {
            "name": "Juan Perez"
          },
          "wa_id": "573009876543"
        }],
        "messages": [{
          "from": "573009876543",
          "id": "wamid.HBgNNTczMDA...",
          "timestamp": "1699999999",
          "type": "text",
          "text": {
            "body": "Hola, necesito información"
          }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

**Tipos de Mensaje Soportados:**

**Texto:**
```json
{
  "type": "text",
  "text": {
    "body": "Contenido del mensaje"
  }
}
```

**Imagen:**
```json
{
  "type": "image",
  "image": {
    "id": "MEDIA_ID",
    "mime_type": "image/jpeg",
    "sha256": "HASH",
    "caption": "Descripción opcional"
  }
}
```

**Documento:**
```json
{
  "type": "document",
  "document": {
    "id": "MEDIA_ID",
    "mime_type": "application/pdf",
    "filename": "documento.pdf"
  }
}
```

### 6.4 Envío de Mensajes

**Endpoint:**
```
POST https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages
```

**Headers:**
```
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: application/json
```

**Payload Mensaje de Texto:**

```json
{
  "messaging_product": "whatsapp",
  "to": "573009876543",
  "type": "text",
  "text": {
    "body": "Hola, este es un mensaje del sistema"
  }
}
```

**Respuesta Exitosa:**

```json
{
  "messaging_product": "whatsapp",
  "contacts": [{
    "input": "573009876543",
    "wa_id": "573009876543"
  }],
  "messages": [{
    "id": "wamid.HBgNNTczMDA..."
  }]
}
```

### 6.5 Estados de Mensaje

**Webhook de Estado:**

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "statuses": [{
          "id": "wamid.HBgNNTczMDA...",
          "status": "delivered",
          "timestamp": "1699999999",
          "recipient_id": "573009876543"
        }]
      }
    }]
  }]
}
```

**Estados Posibles:**

- `sent` - Enviado al servidor de WhatsApp
- `delivered` - Entregado al dispositivo del destinatario
- `read` - Leído por el destinatario
- `failed` - Falló el envío

**Actualización en BD:**

```php
// En WhatsAppService::handleWebhookStatus()
$message = Message::where('whatsapp_message_id', $statusId)->first();
$message->update(['status' => $status]);
```

### 6.6 Limitaciones y Consideraciones

**Rate Limits:**
- 1000 mensajes por segundo por número de teléfono
- 250,000 mensajes por día (puede variar según plan)

**Ventanas de Mensajería:**
- **24 horas:** Después del último mensaje del usuario
- Fuera de ventana: Solo plantillas aprobadas

**Formato de Números:**
- Formato internacional sin símbolos: `573001234567`
- Incluir código de país (57 para Colombia)

**Tipos de Contenido Soportados:**

| Tipo | Formato | Tamaño Máximo |
|------|---------|---------------|
| Imagen | JPG, PNG | 5 MB |
| Documento | PDF, DOC, DOCX, XLS, XLSX | 100 MB |
| Audio | AAC, MP3, AMR, OGG | 16 MB |
| Video | MP4, 3GP | 16 MB |

**Manejo de Errores Comunes:**

| Error | Causa | Solución |
|-------|-------|----------|
| 190 | Token inválido | Regenerar token de acceso |
| 131047 | Mensaje fuera de ventana 24h | Usar plantilla aprobada |
| 100 | Parámetro inválido | Verificar formato del payload |
| 368 | Número bloqueado | Usuario bloqueó el número de negocio |

---

## 7. Sistema de Autenticación

### 7.1 Laravel Fortify

**Configuración:** `config/fortify.php`

**Features Habilitadas:**

```php
'features' => [
    Features::registration(),           // Registro de usuarios (deshabilitado en producción)
    Features::resetPasswords(),         // Recuperación de contraseña
    Features::emailVerification(),      // Verificación de email
    Features::updateProfileInformation(), // Actualizar perfil
    Features::updatePasswords(),        // Cambiar contraseña
    Features::twoFactorAuthentication([ // 2FA
        'confirm' => true,
        'confirmPassword' => true,
    ]),
],
```

### 7.2 Autenticación de Dos Factores (2FA)

**Activación:**

```php
// El usuario activa 2FA desde su perfil
POST /user/two-factor-authentication

// Respuesta: QR Code + Recovery Codes
```

**Flujo de Login con 2FA:**

```
1. Usuario ingresa email + password
2. Sistema valida credenciales
3. Si 2FA activo → Solicita código
4. Usuario ingresa código de 6 dígitos
5. Sistema valida código
6. Login exitoso
```

**Recovery Codes:**

```php
// Generar nuevos códigos
POST /user/two-factor-recovery-codes

// Mostrar códigos actuales
GET /user/two-factor-recovery-codes
```

**IMPORTANTE:** Los códigos de recuperación deben guardarse de forma segura

### 7.3 Middleware de Autorización

**CheckRole Middleware:**

```php
// app/Http/Middleware/CheckRole.php

public function handle($request, Closure $next, ...$roles)
{
    if (!$request->user()) {
        return redirect('/login');
    }

    if (!in_array($request->user()->role, $roles)) {
        abort(403, 'No tienes permiso para acceder a esta sección.');
    }

    return $next($request);
}
```

**Uso en Rutas:**

```php
// Solo administradores
Route::middleware(['auth', 'role:admin'])->group(function () {
    Route::get('/admin/users', [UserController::class, 'index']);
});

// Administradores y asesores
Route::middleware(['auth', 'role:admin,advisor'])->group(function () {
    Route::get('/admin/chat', [ConversationController::class, 'index']);
});
```

### 7.4 Sesiones

**Configuración:** `config/session.php`

```php
'driver' => 'database',      // Sesiones en BD
'lifetime' => 120,           // 120 minutos
'expire_on_close' => false,  // No expirar al cerrar navegador
'encrypt' => false,          // No encriptar (rendimiento)
'secure' => true,            // Solo HTTPS en producción
'http_only' => true,         // No accesible desde JavaScript
'same_site' => 'lax',        // Protección CSRF
```

**Tabla de Sesiones:**

```sql
-- database/migrations/xxxx_create_sessions_table.php
CREATE TABLE sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id BIGINT UNSIGNED,
    ip_address VARCHAR(45),
    user_agent TEXT,
    payload LONGTEXT,
    last_activity INT
);
```

---

## 8. Frontend y UI/UX

### 8.1 Estructura de Componentes React

**Entry Point:** `resources/js/app.tsx`

```typescript
import { createRoot } from 'react-dom/client';
import { createInertiaApp } from '@inertiajs/react';

createInertiaApp({
    resolve: (name) => {
        const pages = import.meta.glob('./pages/**/*.tsx', { eager: true });
        return pages[`./pages/${name}.tsx`];
    },
    setup({ el, App, props }) {
        createRoot(el).render(<App {...props} />);
    },
});
```

### 8.2 Layouts

**Admin Layout:** `resources/js/layouts/admin-layout.tsx`

```typescript
export default function AdminLayout({ children }: PropsWithChildren) {
    return (
        <div className="admin-layout">
            <Sidebar />
            <div className="content">
                <Header />
                <main>{children}</main>
            </div>
        </div>
    );
}
```

**Auth Layout:** `resources/js/layouts/auth/auth-simple-layout.tsx`

Sistema de diseño fluido con variables CSS:
- Color base: `#2e3f84`
- Espaciado: Variables `--space-*`
- Typography: Variables `--text-*`
- Shadows: Variables `--shadow-*`

### 8.3 Páginas Principales

**Chat/Conversaciones:**

```typescript
// resources/js/pages/admin/chat/index.tsx

interface Props {
    conversations: Conversation[];
    filters: Filters;
}

export default function ChatIndex({ conversations, filters }: Props) {
    return (
        <AdminLayout>
            <div className="chat-container">
                <ConversationList conversations={conversations} />
                <ChatArea />
            </div>
        </AdminLayout>
    );
}
```

**Estadísticas:**

```typescript
// resources/js/pages/admin/statistics/index.tsx

import { BarChart, LineChart, PieChart } from 'recharts';

export default function Statistics({ statistics }: Props) {
    return (
        <AdminLayout>
            <StatsOverview stats={statistics} />
            <Charts data={statistics} />
            <ExportButtons />
        </AdminLayout>
    );
}
```

### 8.4 Componentes UI Reutilizables

**Button:**

```typescript
// resources/js/components/ui/button.tsx

import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
    'inline-flex items-center justify-center rounded-lg transition-all',
    {
        variants: {
            variant: {
                default: 'bg-primary text-white hover:bg-primary-darker',
                outline: 'border border-primary text-primary',
                ghost: 'hover:bg-gray-100',
            },
            size: {
                sm: 'h-9 px-3 text-sm',
                md: 'h-11 px-4',
                lg: 'h-13 px-6 text-lg',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'md',
        },
    }
);
```

**Dialog:**

```typescript
// resources/js/components/ui/dialog.tsx

import * as DialogPrimitive from '@radix-ui/react-dialog';

export function Dialog({ children, ...props }) {
    return <DialogPrimitive.Root {...props}>{children}</DialogPrimitive.Root>;
}
```

### 8.5 Gestión de Estado

**Inertia Form Helper:**

```typescript
import { useForm } from '@inertiajs/react';

const { data, setData, post, processing, errors } = useForm({
    message: '',
});

const submit = (e) => {
    e.preventDefault();
    post(`/admin/chat/${conversation.id}/send`, {
        preserveScroll: true,
        onSuccess: () => setData('message', ''),
    });
};
```

**React Hooks Personalizados:**

```typescript
// resources/js/hooks/useConversation.ts

export function useConversation(conversationId: number) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMessages();
    }, [conversationId]);

    return { messages, loading, refetch: fetchMessages };
}
```

### 8.6 Internacionalización (i18next)

```typescript
// resources/js/i18n.ts

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n
    .use(initReactI18next)
    .init({
        resources: {
            es: {
                translation: {
                    'welcome': 'Bienvenido',
                    'chat': 'Chat',
                    'statistics': 'Estadísticas',
                }
            }
        },
        lng: 'es',
        fallbackLng: 'es',
    });
```

---

## 9. Sistema de Colas y Jobs

### 9.1 Configuración de Colas

**Driver:** Database (por defecto)

**Tabla:** `jobs`

```sql
CREATE TABLE jobs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    queue VARCHAR(255),
    payload LONGTEXT,
    attempts TINYINT UNSIGNED,
    reserved_at INT UNSIGNED,
    available_at INT UNSIGNED,
    created_at INT UNSIGNED
);
```

### 9.2 Job: SendAppointmentReminder

**Archivo:** `app/Jobs/SendAppointmentReminder.php`

```php
class SendAppointmentReminder implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public Appointment $appointment
    ) {}

    public function handle(WhatsAppService $whatsapp): void
    {
        // Renderizar plantilla
        $template = Template::where('category', 'reminder')->first();
        $message = $template->render([
            'patient_name' => $this->appointment->patient_name,
            'appointment_date' => $this->appointment->appointment_date->format('d/m/Y'),
            'appointment_time' => $this->appointment->appointment_date->format('h:i A'),
        ]);

        // Enviar mensaje
        $result = $whatsapp->sendTextMessage(
            $this->appointment->phone_number,
            $message
        );

        // Actualizar estado
        if ($result['success']) {
            $this->appointment->update([
                'reminder_sent' => true,
                'reminder_status' => 'sent',
                'reminder_sent_at' => now(),
            ]);
        } else {
            $this->appointment->update([
                'reminder_status' => 'failed',
            ]);
            
            throw new \Exception('Failed to send reminder: ' . $result['error']);
        }
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('Reminder job failed', [
            'appointment_id' => $this->appointment->id,
            'error' => $exception->getMessage(),
        ]);
    }
}
```

### 9.3 Despachar Jobs

**En Controlador:**

```php
use App\Jobs\SendAppointmentReminder;

SendAppointmentReminder::dispatch($appointment);
```

**Con Delay:**

```php
SendAppointmentReminder::dispatch($appointment)
    ->delay(now()->addHours(24));
```

**En Comando Artisan:**

```php
// app/Console/Commands/SendDailyReminders.php

public function handle()
{
    $appointments = Appointment::needsReminder()
        ->upcoming(48)
        ->get();

    foreach ($appointments as $appointment) {
        SendAppointmentReminder::dispatch($appointment);
    }

    $this->info("Dispatched {$appointments->count()} reminder jobs");
}
```

### 9.4 Worker de Cola

**Iniciar Worker:**

```bash
php artisan queue:work --tries=3 --timeout=90
```

**En Producción (Supervisor):**

```ini
[program:evarisbot-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/evarisbot/artisan queue:work --sleep=3 --tries=3
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/var/www/evarisbot/storage/logs/worker.log
stopwaitsecs=3600
```

### 9.5 Comandos de Cola

```bash
# Ver trabajos fallidos
php artisan queue:failed

# Reintentar trabajo fallido
php artisan queue:retry {id}

# Reintentar todos
php artisan queue:retry all

# Limpiar trabajos fallidos
php artisan queue:flush
```

---

## 10. Módulo de Informes

### 10.1 StatisticsExport

**Archivo:** `app/Exports/StatisticsExport.php`

**Hojas Generadas:**

1. **Resumen** - Overview general
2. **Mensajes** - Estadísticas de mensajería
3. **Citas** - Recordatorios y confirmaciones
4. **Conversaciones** - Estados y asignaciones
5. **Plantillas** - Uso y efectividad
6. **Usuarios** - Distribución de roles

**Uso:**

```php
$export = new StatisticsExport($statistics, $dateRange);
return $export->download('estadisticas_' . now()->format('Y-m-d') . '.xlsx');
```

### 10.2 Cálculo de Métricas

**StatisticsController:**

```php
private function getMessageStatistics($startDate, $endDate): array
{
    $query = Message::query();
    
    if ($startDate && $endDate) {
        $query->whereBetween('created_at', [$startDate, $endDate]);
    }
    
    return [
        'sent' => $query->where('is_from_user', false)->count(),
        'answered' => $this->getAnsweredMessagesCount($startDate, $endDate),
        'by_status' => $query->groupBy('status')
            ->selectRaw('status, count(*) as count')
            ->pluck('count', 'status'),
    ];
}
```

### 10.3 Gráficos con Recharts

```typescript
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export function MessagesChart({ data }) {
    return (
        <BarChart width={600} height={300} data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="sent" fill="#2e3f84" />
            <Bar dataKey="received" fill="#10b981" />
        </BarChart>
    );
}
```

### 10.4 Exportación a PDF

**Usando DomPDF (futuro):**

```php
use Barryvdh\DomPDF\Facade\Pdf;

$pdf = Pdf::loadView('reports.statistics', ['statistics' => $statistics]);
return $pdf->download('estadisticas.pdf');
```

---

## 11. Instalación y Despliegue

### 11.1 Requisitos del Sistema

**Servidor:**

```yaml
Sistema Operativo: Ubuntu 22.04 LTS (recomendado) o similar
CPU: 2+ cores
RAM: 4GB mínimo, 8GB recomendado
Disco: 20GB+ SSD
```

**Software:**

```yaml
PHP: 8.2 o superior
Extensiones PHP requeridas:
  - bcmath
  - ctype
  - fileinfo
  - json
  - mbstring
  - openssl
  - pdo
  - pdo_mysql (o pdo_pgsql)
  - tokenizer
  - xml
  - curl
  - gd
  - zip

Servidor Web:
  - Nginx 1.20+ (recomendado)
  - o Apache 2.4+

Base de Datos:
  - MySQL 8.0+ (recomendado)
  - o PostgreSQL 14+
  - o SQLite 3 (solo desarrollo)

Node.js: 18.x o superior
Composer: 2.x
Git: 2.x
```

### 11.2 Instalación Paso a Paso

**1. Clonar Repositorio:**

```bash
cd /var/www
git clone https://github.com/tu-org/evarisbot.git
cd evarisbot
```

**2. Instalar Dependencias PHP:**

```bash
composer install --no-dev --optimize-autoloader
```

**3. Configurar Entorno:**

```bash
cp .env.example .env
nano .env
```

Configurar variables (ver `docs/CREDENCIALES_Y_CONFIGURACION.md`)

**4. Generar Application Key:**

```bash
php artisan key:generate
```

**5. Crear Base de Datos:**

```sql
CREATE DATABASE evarisbot_production CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**6. Ejecutar Migraciones:**

```bash
php artisan migrate --force
```

**7. Seeders (Opcional):**

```bash
php artisan db:seed --force
```

**8. Instalar Dependencias Frontend:**

```bash
npm install
```

**9. Compilar Assets:**

```bash
npm run build
```

**10. Configurar Permisos:**

```bash
sudo chown -R www-data:www-data /var/www/evarisbot
sudo chmod -R 775 /var/www/evarisbot/storage
sudo chmod -R 775 /var/www/evarisbot/bootstrap/cache
```

**11. Optimizar para Producción:**

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### 11.3 Configuración de Nginx

**Archivo:** `/etc/nginx/sites-available/evarisbot`

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name evarisbot.dominio.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name evarisbot.dominio.com;
    root /var/www/evarisbot/public;

    index index.php;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/evarisbot.dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/evarisbot.dominio.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Logs
    access_log /var/log/nginx/evarisbot-access.log;
    error_log /var/log/nginx/evarisbot-error.log;

    # Laravel Public Directory
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # PHP-FPM Configuration
    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_hide_header X-Powered-By;
    }

    # Deny access to sensitive files
    location ~ /\.(?!well-known).* {
        deny all;
    }

    # Cache static files
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**Habilitar Sitio:**

```bash
sudo ln -s /etc/nginx/sites-available/evarisbot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 11.4 Configuración de PHP-FPM

**Archivo:** `/etc/php/8.2/fpm/pool.d/evarisbot.conf`

```ini
[evarisbot]
user = www-data
group = www-data
listen = /var/run/php/php8.2-fpm-evarisbot.sock
listen.owner = www-data
listen.group = www-data
pm = dynamic
pm.max_children = 20
pm.start_servers = 5
pm.min_spare_servers = 5
pm.max_spare_servers = 10
pm.max_requests = 500
```

**Reiniciar PHP-FPM:**

```bash
sudo systemctl restart php8.2-fpm
```

### 11.5 Configuración de Supervisor (Queue Worker)

**Archivo:** `/etc/supervisor/conf.d/evarisbot-worker.conf`

```ini
[program:evarisbot-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/evarisbot/artisan queue:work database --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/var/www/evarisbot/storage/logs/worker.log
stopwaitsecs=3600
```

**Iniciar Supervisor:**

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start evarisbot-worker:*
```

### 11.6 Cron Jobs

**Editar crontab:**

```bash
sudo crontab -e -u www-data
```

**Agregar:**

```cron
# Laravel Scheduler
* * * * * cd /var/www/evarisbot && php artisan schedule:run >> /dev/null 2>&1

# Backup Diario (2 AM)
0 2 * * * /home/deploy/backup-db.sh >> /home/deploy/backups/backup.log 2>&1
```

