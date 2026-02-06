# INNOVACIÓN Y DESARROLLO - HOSPITAL UNIVERSITARIO DEL VALLE
# EVARISBOT

# CREDENCIALES Y CONFIGURACIÓN DEL SISTEMA

## 1. INTRODUCCIÓN

Este documento detalla de manera exhaustiva las credenciales, variables de entorno, servicios requeridos y procedimientos de configuración para el correcto despliegue y funcionamiento del sistema **Evarisbot**. Esta aplicación es crítica para la gestión de comunicaciones vía WhatsApp Business y requiere una configuración precisa para garantizar la disponibilidad, seguridad y escalabilidad.

---

## 2. REQUISITOS DEL SISTEMA

### 2.1 Entorno de Servidor (Hardware Recomendado)
- **Procesador:** Mínimo 2 vCPU (Recomendado 4 vCPU para producción con alta carga).
- **Memoria RAM:** Mínimo 4 GB (Recomendado 8 GB para manejar WebSockets y Workers de cola).
- **Almacenamiento:** SSD, espacio dependiente del volumen de archivos multimedia (imágenes/documentos) recibidos.
- **Sistema Operativo:** Windows Server (Compatible con Scripts .bat incluidos) o Linux (Ubuntu 22.04 LTS recomendado).

### 2.2 Software Base
El servidor debe contar con el siguiente software instalado y configurado:

1.  **PHP 8.2 o superior**
    - Extensiones requeridas: `bcmath`, `ctype`, `curl`, `dom`, `fileinfo`, `json`, `mbstring`, `openssl`, `pcre`, `pdo`, `pdo_mysql`, `tokenizer`, `xml`, `zip`, `intl`, `gd`.
    - Configuración `php.ini`:
        - `memory_limit = 512M`
        - `upload_max_filesize = 100M`
        - `post_max_size = 100M`
        - `max_execution_time = 300`

2.  **Composer 2.x**
    - Gestor de dependencias de PHP.

3.  **Node.js LTS (v20.x o v22.x)**
    - Entorno de ejecución para JavaScript.
    - Gestor de paquetes `npm` o `yarn`.

4.  **Base de Datos (MySQL 8.0+ o MariaDB 10.6+)**
    - Soporte para JSON nativo requerido.
    - Cotejamiento recomendado: `utf8mb4_unicode_ci`.

5.  **Servidor Web**
    - Apache o Nginx (Recomendado Nginx + PHP-FPM).
    - O uso de `php artisan serve` para entornos de desarrollo/pruebas locales, gestionado mediante los scripts `.bat` proporcionados.

---

## 3. VARIABLES DE ENTORNO (.ENV)

El archivo `.env` es el corazón de la configuración de Evarisbot. A continuación se describe cada sección y variable crítica.

### 3.1 Configuración General de la Aplicación
Define el entorno y las claves de seguridad base.

```ini
APP_NAME=Evarisbot
APP_ENV=production
APP_KEY=base64:GENERAR_CON_ARTISAN_KEY_GENERATE
APP_DEBUG=false
APP_URL=https://evarisbot.huv.gov.co
```

*   **APP_ENV**: Debe estar en `production` para despliegues reales.
*   **APP_DEBUG**: `false` en producción para evitar exposición de trazas de error, `true` solo para desarrollo.
*   **APP_URL**: URL base donde se alojará la aplicación. Es crítico para la generación de Webhooks y assets estáticos.

### 3.2 Configuración de Base de Datos
Credenciales de acceso al motor de base de datos MySQL.

```ini
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=evarisbot_db
DB_USERNAME=usuario_db
DB_PASSWORD=contraseña_segura
```

### 3.3 Configuración de Drivers (Colas, Caché, Sesiones)
Evarisbot hace uso intensivo de colas y caché para optimizar el rendimiento.

```ini
SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=null

QUEUE_CONNECTION=database
CACHE_STORE=database
```

*   **QUEUE_CONNECTION**: Recomendado `database` para persistencia simple o `redis` para alto rendimiento. Si se cambia a Redis, asegurar instalación de servicio Redis.

### 3.4 Configuración de Servidor de WebSockets (Laravel Reverb)
Esencial para la comunicación en tiempo real (chat en vivo).

```ini
REVERB_APP_ID=evarisbot_app
REVERB_APP_KEY=evarisbot_key_secreta
REVERB_APP_SECRET=evarisbot_secret_super_seguro
REVERB_HOST="0.0.0.0"
REVERB_PORT=8080
REVERB_SCHEME=http

VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST_PORT="${REVERB_PORT}"
VITE_REVERB_SCHEME="${REVERB_SCHEME}"
```

*   **REVERB_PORT**: Puerto donde el servidor WebSocket escuchará. Debe estar abierto en el firewall.
*   **VITE_...**: Estas variables son inyectadas en el frontend (React) para que el cliente sepa a dónde conectarse.

### 3.5 Configuración de WhatsApp Business API (Meta)
Credenciales para la integración con la API de Cloud API de Meta.

```ini
WHATSAPP_API_TOKEN=EAAG... (Token de larga duración)
WHATSAPP_PHONE_ID=1234567890 (ID del número de teléfono en Meta)
WHATSAPP_BUSINESS_ACCOUNT_ID=9876543210 (ID de la cuenta comercial)
WHATSAPP_WEBHOOK_VERIFY_TOKEN=token_personalizado_verificacion
WHATSAPP_API_VERSION=v18.0
```

*   **WHATSAPP_API_TOKEN**: Token de acceso. Debe ser un "System User Token" con permisos permanentes (`whatsapp_business_management`, `whatsapp_business_messaging`).
*   **WHATSAPP_WEBHOOK_VERIFY_TOKEN**: Cadena arbitraria definida por nosotros, que se debe ingresar en el panel de desarrolladores de Meta al configurar el Webhook.

### 3.6 Configuración de Inteligencia Artificial (Groq)
Utilizada para sugerencias automáticas y transcripciones.

```ini
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile
```

---

## 4. GESTIÓN DE SERVICIOS Y SCRIPTS DE AUTOMATIZACIÓN

Para facilitar la administración en entornos Windows (común en infraestructura hospitalaria), se han desarrollado scripts `.bat` específicos ubicados en la raíz del proyecto.

### 4.1 Scripts Principales

#### `start-all-services.bat`
Este script orquesta el inicio de todos los componentes necesarios.
1.  Verifica si PHP está en el PATH.
2.  Inicia el servidor web (PHP Artisan Serve).
3.  Inicia el servidor de WebSockets (Reverb).
4.  Inicia el procesador de colas (Queue Worker) para envíos masivos.
5.  Inicia el compilador de frontend (Vite) si estamos en modo dev.

**Uso:** Ejecutar como administrador al iniciar el servidor.

#### `start-queue-worker.bat`
Inicia únicamente el proceso encargado de despachar recordatorios y mensajes de WhatsApp. Es vital que este proceso esté siempre corriendo. Si se detiene, los mensajes se quedarán en estado "Encolado".

#### `start-reverb-optimized.bat`
Inicia el servidor de WebSockets con configuración optimizada para producción.

#### `stop-all-services.bat`
Detiene de manera segura todos los procesos relacionados con Evarisbot para mantenimiento.

### 4.2 Webhooks (Configuración en Servidor)

Existen scripts PHP en la raíz para facilitar la configuración de Webhooks sin acceso SSH/Consola directo si fuera necesario:

*   **`setup_webhook.php`**: Registra la URL del webhook en Meta.
*   **`force_subscribe_webhook.php`**: Fuerza la re-suscripción si se pierden los permisos.

---

## 5. CREDENCIALES DE ACCESO (POR DEFECTO)

**Nota de Seguridad:** Estas credenciales deben ser cambiadas INMEDIATAMENTE después del primer despliegue.

### 5.1 Super Administrador
*   **Email:** admin@huv.gov.co
*   **Password:** (Definida durante la instalación en `DatabaseSeeder` o `HUV2026!`)
*   **Rol:** Admin Global (Acceso a Configuración, Usuarios, Logs).

### 5.2 Usuario Asesor (Prueba)
*   **Email:** asesor@huv.gov.co
*   **Password:** asesor123
*   **Rol:** Asesor (Acceso solo a Chat y gestión básica).

---

## 6. CONFIGURACIÓN DE TERCEROS (META FOR DEVELOPERS)

Para conectar WhatsApp, se requiere una App creada en `developers.facebook.com`.

1.  **Tipo de App:** Business (Negocios).
2.  **Producto:** WhatsApp.
3.  **Configuración de API:**
    - Generar Token Permanente (System User).
    - Asignar Activos (Cuenta de WhatsApp Business).
4.  **Configuración de Webhook:**
    - **Callback URL:** `https://evarisbot.huv.gov.co/api/webhook/whatsapp`
    - **Verify Token:** El valor de `WHATSAPP_WEBHOOK_VERIFY_TOKEN` del .env.
    - **Campos de suscripción:** `messages`, `message_delivered`, `message_read`, `message_sent`.

---

## 7. MANTENIMIENTO Y RESPALDOS

### 7.1 Base de Datos
Se recomienda configurar un respaldo diario de la base de datos MySQL (dump).
Ruta sugerida de backups: `C:\Backups\Evarisbot\`

### 7.2 Logs
Los logs se almacenan en `storage/logs/laravel.log`.
Se debe revisar este archivo periódicamente para detectar errores de conexión con la API de WhatsApp.
Configurar rotación de logs diaria para evitar saturación de disco.

### 7.3 Actualizaciones
Para actualizar el sistema con nuevos cambios del repositorio:
1.  `git pull origin main`
2.  `composer install --optimize-autoloader --no-dev`
3.  `php artisan migrate --force`
4.  `npm run build`
5.  `php artisan config:cache`
6.  `php artisan route:cache`
7.  `php artisan view:cache`
8.  Reiniciar servicios con `stop-all-services.bat` y luego `start-all-services.bat`.

---

**ÁREA DE INNOVACIÓN Y DESARROLLO**
**HOSPITAL UNIVERSITARIO DEL VALLE**
