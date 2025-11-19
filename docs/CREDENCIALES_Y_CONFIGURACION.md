# Guía de Credenciales y Configuración - Evarisbot
## Archivo Confidencial - Uso Exclusivo del Equipo Técnico

**Versión:** 1.0  
**Fecha:** Noviembre 2024  
**Clasificación:** CONFIDENCIAL

---

## ADVERTENCIA DE SEGURIDAD

Este documento contiene información sensible y credenciales del sistema. 

**OBLIGATORIO:**
- Almacenar en ubicación segura con acceso restringido
- Nunca compartir por email o mensajería no cifrada
- No subir a repositorios públicos
- Cambiar contraseñas regularmente
- Usar gestores de contraseñas (LastPass, 1Password, Bitwarden)
- NUNCA hardcodear credenciales en el código
- NO compartir con personal no autorizado

---

## Tabla de Contenidos

1. [Variables de Entorno](#1-variables-de-entorno)
2. [Credenciales WhatsApp Business API](#2-credenciales-whatsapp-business-api)
3. [Base de Datos](#3-base-de-datos)
4. [Configuración del Servidor](#4-configuración-del-servidor)
5. [Certificados SSL](#5-certificados-ssl)
6. [Copias de Seguridad](#6-copias-de-seguridad)
7. [Accesos Administrativos](#7-accesos-administrativos)
8. [Rotación de Credenciales](#8-rotación-de-credenciales)

---

## 1. Variables de Entorno

### 1.1 Archivo .env de Producción

**Ubicación:** Raíz del proyecto  
**Archivo:** `.env` (NO incluir en Git)

```env
# ============================================
# APLICACIÓN
# ============================================
APP_NAME="Evarisbot"
APP_ENV=production
APP_KEY=base64:XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
APP_DEBUG=false
APP_URL=https://evarisbot.dominio.com

APP_LOCALE=es
APP_FALLBACK_LOCALE=es
APP_FAKER_LOCALE=es_ES

# ============================================
# BASE DE DATOS - PRODUCCIÓN
# ============================================
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=evarisbot_production
DB_USERNAME=evarisbot_user
DB_PASSWORD=CONTRASEÑA_SEGURA_AQUI_MIN_16_CARACTERES

# ============================================
# SESIONES Y CACHÉ
# ============================================
SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_ENCRYPT=false

CACHE_STORE=database
QUEUE_CONNECTION=database

BROADCAST_CONNECTION=reverb

# ============================================
# WHATSAPP BUSINESS API (META)
# ============================================
WHATSAPP_TOKEN=EAAG...XXXXXXX
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_BUSINESS_ACCOUNT_ID=123456789012345
WHATSAPP_SYSTEM_USER_ID=123456789012345
WHATSAPP_VERIFY_TOKEN=huv_webhook_verificacion_2024

# ============================================
# LARAVEL REVERB (WebSockets)
# ============================================
REVERB_APP_ID=evarisbot_prod
REVERB_APP_KEY=XXXXXXXXXXXXX
REVERB_APP_SECRET=XXXXXXXXXXXXX
REVERB_HOST=evarisbot.dominio.com
REVERB_PORT=8080
REVERB_SCHEME=https

VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST="${REVERB_HOST}"
VITE_REVERB_PORT="${REVERB_PORT}"
VITE_REVERB_SCHEME="${REVERB_SCHEME}"

# ============================================
# CORREO ELECTRÓNICO
# ============================================
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=notificaciones@dominio.com
MAIL_PASSWORD=CONTRASEÑA_APP_GMAIL
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS="notificaciones@dominio.com"
MAIL_FROM_NAME="${APP_NAME}"

# ============================================
# LOGS Y MONITOREO
# ============================================
LOG_CHANNEL=stack
LOG_STACK=daily
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=info

# ============================================
# SEGURIDAD
# ============================================
BCRYPT_ROUNDS=12
```

### 1.2 Generar APP_KEY

```bash
php artisan key:generate
```

**Salida esperada:**
```
Application key set successfully.
```

**IMPORTANTE:** 
- El APP_KEY se guarda automáticamente en `.env`
- Nunca cambiar en producción sin backup
- Si se pierde, las sesiones y datos encriptados se pierden

### 1.3 Variables Críticas

| Variable | Descripción | Dónde Obtenerla |
|----------|-------------|-----------------|
| APP_KEY | Clave de encriptación de Laravel | `php artisan key:generate` |
| WHATSAPP_TOKEN | Token de acceso de Meta | Meta Business Suite → WhatsApp |
| DB_PASSWORD | Contraseña de base de datos | Panel de hosting / Creada manualmente |
| MAIL_PASSWORD | Contraseña de aplicación Gmail | Cuenta Google → Seguridad → Contraseñas de aplicación |

---

## 2. Credenciales WhatsApp Business API

### 2.1 Obtener Credenciales de Meta

**Paso 1: Crear Aplicación en Meta**

1. Ir a https://developers.facebook.com
2. Click en **"Mis aplicaciones"** → **"Crear aplicación"**
3. Seleccionar **"Empresa"**
4. Nombre: **"Evarisbot - Servicios Ambulatorios"**
5. Agregar producto: **WhatsApp**

**Paso 2: Configurar WhatsApp Business**

1. En la aplicación → **WhatsApp** → **Inicio rápido**
2. Seleccionar o crear cuenta de WhatsApp Business
3. Agregar número de teléfono
4. Verificar número con código SMS

**Paso 3: Obtener Credenciales**

```
Meta Business Suite → Configuración de WhatsApp
```

**Credenciales necesarias:**

```yaml
Phone Number ID: 
  Ubicación: WhatsApp → API Setup → Phone number ID
  Ejemplo: 123456789012345
  
Business Account ID:
  Ubicación: WhatsApp → API Setup → WhatsApp Business Account ID
  Ejemplo: 123456789012345
  
Access Token (Temporal):
  Ubicación: WhatsApp → API Setup → Temporary access token
  Duración: 24 horas
  Uso: Solo para pruebas
  
System User Token (Permanente):
  Ubicación: Business Settings → System Users → Generate Token
  Permisos necesarios:
    - whatsapp_business_management
    - whatsapp_business_messaging
  Duración: Permanente (hasta que se revoque)
  Uso: PRODUCCIÓN
```

### 2.2 Generar Token Permanente

**Paso a Paso:**

1. **Ir a Business Settings**
   ```
   https://business.facebook.com/settings/system-users
   ```

2. **Crear System User**
   - Nombre: "Evarisbot Production"
   - Rol: Administrador

3. **Generar Token**
   - Click en **"Generar nuevo token"**
   - Seleccionar App: **"Evarisbot - Servicios Ambulatorios"**
   - Permisos:
     - `whatsapp_business_management`
     - `whatsapp_business_messaging`
   - Duración: **"Never expires"** (Nunca caduca)
   - Click en **"Generar token"**

4. **Copiar y Guardar**
   ```
   Token: EAAGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   
   **IMPORTANTE:** El token solo se muestra UNA VEZ. Guardarlo inmediatamente en:
   - Gestor de contraseñas
   - Archivo `.env` de producción
   - Documentación segura

### 2.3 Configurar Webhook

**URL del Webhook:**
```
https://evarisbot.dominio.com/webhook/whatsapp
```

**Configuración en Meta:**

1. WhatsApp → **Configuration** → **Webhook**
2. Click en **"Edit"**
3. **Callback URL:** `https://evarisbot.dominio.com/webhook/whatsapp`
4. **Verify token:** `huv_webhook_verificacion_2024` (personalizar)
5. **Webhook fields:**
   - messages
   - message_echoes (opcional)
6. Click en **"Verify and Save"**

**Verificación Exitosa:**
```
Your webhook is successfully verified
```

**Troubleshooting:**

Si la verificación falla:

```bash
# 1. Verificar que el servidor responde
curl "https://evarisbot.dominio.com/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=huv_webhook_verificacion_2024&hub.challenge=TEST"

# Respuesta esperada: TEST

# 2. Verificar logs
tail -f storage/logs/laravel.log

# 3. Verificar variable en .env
grep WHATSAPP_VERIFY_TOKEN .env
```

### 2.4 Números de Prueba

Meta proporciona números de prueba:

```yaml
Números de Prueba (Test Numbers):
  Ubicación: WhatsApp → API Setup → Test numbers
  Uso: Solo para desarrollo
  Limitación: Máximo 5 números
  
Número de Producción:
  Requiere: Verificación de negocio (Business Verification)
  Proceso: 1-2 semanas
  Documentación requerida:
    - Registro mercantil
    - Documento de identidad del representante legal
    - Comprobante de domicilio
```

---

## 3. Base de Datos

### 3.1 Credenciales de MySQL

**Información de Conexión:**

```yaml
Host: localhost (o IP del servidor)
Puerto: 3306
Base de Datos: evarisbot_production
Usuario: evarisbot_user
Contraseña: [VER GESTOR DE CONTRASEÑAS]
Charset: utf8mb4
Collation: utf8mb4_unicode_ci
```

### 3.2 Crear Base de Datos

```sql
-- Conectar como root
mysql -u root -p

-- Crear base de datos
CREATE DATABASE evarisbot_production 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

-- Crear usuario
CREATE USER 'evarisbot_user'@'localhost' 
  IDENTIFIED BY 'CONTRASEÑA_SEGURA_AQUI';

-- Otorgar permisos
GRANT ALL PRIVILEGES ON evarisbot_production.* 
  TO 'evarisbot_user'@'localhost';

-- Aplicar cambios
FLUSH PRIVILEGES;

-- Salir
EXIT;
```

### 3.3 Conexión Remota (si aplica)

Si la base de datos está en otro servidor:

```sql
-- Crear usuario para conexión remota
CREATE USER 'evarisbot_user'@'%' 
  IDENTIFIED BY 'CONTRASEÑA_SEGURA_AQUI';

-- Otorgar permisos
GRANT ALL PRIVILEGES ON evarisbot_production.* 
  TO 'evarisbot_user'@'%';

FLUSH PRIVILEGES;
```

**Actualizar .env:**

```env
DB_HOST=192.168.1.100  # IP del servidor de BD
DB_PORT=3306
```

### 3.4 Verificar Conexión

```bash
# Desde el servidor de aplicación
php artisan db:show

# Output esperado:
# MySQL 8.0.x  evarisbot_production
```

---

## 4. Configuración del Servidor

### 4.1 Información del Servidor

**Servidor Web:**

```yaml
Proveedor: [Nombre del hosting/servidor]
IP Pública: XXX.XXX.XXX.XXX
Dominio: evarisbot.dominio.com
Sistema Operativo: Ubuntu 22.04 LTS (o especificar)
Servidor Web: Nginx 1.24 (o Apache 2.4)
PHP: 8.2.x
MySQL: 8.0.x
```

### 4.2 Acceso SSH

**Credenciales:**

```bash
Host: evarisbot.dominio.com
Puerto: 22 (o puerto personalizado)
Usuario: deploy
Contraseña: [VER GESTOR DE CONTRASEÑAS]
# O usar clave SSH (recomendado)
```

**Conectar:**

```bash
ssh deploy@evarisbot.dominio.com -p 22
```

**Con clave SSH:**

```bash
ssh -i ~/.ssh/evarisbot_rsa deploy@evarisbot.dominio.com
```

### 4.3 Ubicación de Archivos

```yaml
Directorio Web: /var/www/evarisbot
Logs Apache/Nginx: /var/log/nginx/ (o /var/log/apache2/)
Logs Laravel: /var/www/evarisbot/storage/logs/
Certificados SSL: /etc/letsencrypt/live/evarisbot.dominio.com/
Configuración Nginx: /etc/nginx/sites-available/evarisbot
```

### 4.4 Usuarios del Sistema

```yaml
Usuario Web (www-data):
  Grupo: www-data
  Propósito: Ejecutar PHP-FPM y servir archivos
  
Usuario Deploy (deploy):
  Grupo: deploy
  Propósito: Despliegues y mantenimiento
  Home: /home/deploy
  
Usuario Root:
  Acceso: Solo para tareas administrativas críticas
  Contraseña: [VER GESTOR DE CONTRASEÑAS - NIVEL MÁXIMO]
```

---

## 5. Certificados SSL

### 5.1 Let's Encrypt (Recomendado - Gratis)

**Instalación con Certbot:**

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx

# Obtener certificado
sudo certbot --nginx -d evarisbot.dominio.com

# Renovación automática (ya configurada)
sudo certbot renew --dry-run
```

**Ubicación de Certificados:**

```
/etc/letsencrypt/live/evarisbot.dominio.com/
  ├── fullchain.pem   # Certificado completo
  ├── privkey.pem     # Clave privada
  ├── cert.pem        # Certificado solo
  └── chain.pem       # Cadena de certificación
```

**Renovación:**

```bash
# Manual
sudo certbot renew

# Automática (cron ya configurado)
# Se ejecuta 2 veces al día automáticamente
```

### 5.2 Certificado Comercial (Alternativa)

Si se usa certificado comprado:

```yaml
Proveedor: [Nombre del proveedor SSL]
Tipo: Wildcard / Single Domain
Validación: DV / OV / EV
Vigencia: Hasta [Fecha]
Ubicación Archivos:
  - Certificado: /etc/ssl/certs/evarisbot.crt
  - Clave Privada: /etc/ssl/private/evarisbot.key
  - CA Bundle: /etc/ssl/certs/ca-bundle.crt
```

---

## 6. Copias de Seguridad

### 6.1 Base de Datos

**Script de Backup Automático:**

```bash
#!/bin/bash
# /home/deploy/backup-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/deploy/backups/database"
DB_NAME="evarisbot_production"
DB_USER="evarisbot_user"
DB_PASS="CONTRASEÑA_AQUI"

# Crear directorio si no existe
mkdir -p $BACKUP_DIR

# Hacer backup
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME > $BACKUP_DIR/db_backup_$DATE.sql

# Comprimir
gzip $BACKUP_DIR/db_backup_$DATE.sql

# Eliminar backups antiguos (más de 30 días)
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup completado: db_backup_$DATE.sql.gz"
```

**Cron Job:**

```bash
# Editar crontab
crontab -e

# Agregar (backup diario a las 2 AM)
0 2 * * * /home/deploy/backup-db.sh >> /home/deploy/backups/backup.log 2>&1
```

### 6.2 Archivos del Sistema

```bash
#!/bin/bash
# /home/deploy/backup-files.sh

DATE=$(date +%Y%m%d)
BACKUP_DIR="/home/deploy/backups/files"
APP_DIR="/var/www/evarisbot"

mkdir -p $BACKUP_DIR

# Backup de storage y .env
tar -czf $BACKUP_DIR/files_backup_$DATE.tar.gz \
  $APP_DIR/storage \
  $APP_DIR/.env \
  $APP_DIR/database/database.sqlite

# Eliminar backups antiguos
find $BACKUP_DIR -name "*.tar.gz" -mtime +15 -delete
```

### 6.3 Ubicación de Backups

```yaml
Backups Locales:
  Base de Datos: /home/deploy/backups/database/
  Archivos: /home/deploy/backups/files/
  Retención: 30 días (BD), 15 días (archivos)
  
Backups Remotos (Recomendado):
  Servicio: Amazon S3 / Google Drive / Dropbox
  Frecuencia: Semanal
  Retención: 90 días
```

---

## 7. Accesos Administrativos

### 7.1 Panel de Hosting

```yaml
Proveedor: [Nombre del hosting]
URL: https://panel.hosting.com
Usuario: admin@dominio.com
Contraseña: [VER GESTOR DE CONTRASEÑAS]
```

### 7.2 Cuenta de Meta Business

```yaml
URL: https://business.facebook.com
Email: admin@dominio.com
Contraseña: [VER GESTOR DE CONTRASEÑAS]
2FA: Activado (Authenticator App)
Códigos de Recuperación: [VER GESTOR DE CONTRASEÑAS]
```

### 7.3 Usuario Administrador del Sistema

```yaml
Email: admin@dominio.com
Contraseña: [Cambiar en primer ingreso]
Rol: admin
2FA: Activado (Recomendado)
```

**Crear usuario admin:**

```bash
php artisan tinker

> $user = new App\Models\User();
> $user->name = 'Administrador';
> $user->email = 'admin@dominio.com';
> $user->password = bcrypt('ContraseñaTemporal123!');
> $user->role = 'admin';
> $user->save();
```

---

## 8. Rotación de Credenciales

### 8.1 Calendario de Rotación

| Credencial | Frecuencia | Última Rotación | Próxima Rotación |
|------------|------------|-----------------|------------------|
| DB_PASSWORD | 90 días | [Fecha] | [Fecha] |
| WhatsApp Token | 180 días | [Fecha] | [Fecha] |
| APP_KEY | Nunca* | [Fecha instalación] | N/A |
| SSH Keys | 180 días | [Fecha] | [Fecha] |
| Admin Password | 60 días | [Fecha] | [Fecha] |

*Solo cambiar en caso de compromiso

### 8.2 Procedimiento de Rotación

**Contraseña de Base de Datos:**

```sql
-- 1. Cambiar contraseña
ALTER USER 'evarisbot_user'@'localhost' 
  IDENTIFIED BY 'NUEVA_CONTRASEÑA_SEGURA';
FLUSH PRIVILEGES;
```

```bash
# 2. Actualizar .env
nano .env
# Cambiar DB_PASSWORD

# 3. Reiniciar servicios
php artisan config:clear
php artisan cache:clear
sudo systemctl restart php8.2-fpm
sudo systemctl restart nginx
```

**Token de WhatsApp:**

1. Generar nuevo token en Meta Business Suite
2. Actualizar `.env`
3. Probar conexión: `php artisan test-whatsapp`
4. Revocar token antiguo en Meta

---

## 9. Checklist de Seguridad

- [ ] `.env` no está en Git (verificar `.gitignore`)
- [ ] APP_DEBUG=false en producción
- [ ] APP_ENV=production
- [ ] SSL configurado y funcionando (HTTPS)
- [ ] Firewall activo (UFW/iptables)
- [ ] Solo puertos necesarios abiertos (80, 443, 22)
- [ ] SSH con autenticación por clave (no password)
- [ ] Usuario root deshabilitado para SSH
- [ ] 2FA activado en cuentas críticas
- [ ] Backups automáticos configurados
- [ ] Logs rotando correctamente
- [ ] Permisos de archivos correctos (storage 775)
- [ ] Certificado SSL válido y auto-renovable

---

**ESTE DOCUMENTO DEBE PERMANECER CONFIDENCIAL**

**Última actualización:** [Fecha]  
**Actualizado por:** [Nombre del técnico]

**Contacto de emergencia:**
- Equipo Técnico: tecnico@dominio.com
- Teléfono: +57 XXX XXX XXXX
