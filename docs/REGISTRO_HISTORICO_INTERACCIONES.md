# Registro Histórico de Interacciones - Evarisbot
## Documentación de Trazabilidad y Auditoría

**Versión:** 1.0  
**Fecha:** Noviembre 2024  
**Propósito:** Cumplimiento normativo y trazabilidad completa

---

## Tabla de Contenidos

1. [Introducción](#1-introducción)
2. [Marco Normativo](#2-marco-normativo)
3. [Arquitectura de Almacenamiento](#3-arquitectura-de-almacenamiento)
4. [Tipos de Registros](#4-tipos-de-registros)
5. [Consulta del Historial](#5-consulta-del-historial)
6. [Política de Retención](#6-política-de-retención)
7. [Seguridad y Privacidad](#7-seguridad-y-privacidad)
8. [Auditoría y Compliance](#8-auditoría-y-compliance)
9. [Procedimientos de Backup](#9-procedimientos-de-backup)
10. [Anexos](#10-anexos)

---

## 1. Introducción

### 1.1 Propósito del Documento

Este documento establece la metodología, alcance y procedimientos para el registro histórico de todas las interacciones realizadas en el sistema Evarisbot, garantizando:

- **Trazabilidad Completa** - Registro íntegro de todas las comunicaciones  
- **Cumplimiento Normativo** - Alineación con regulaciones de salud y protección de datos  
- **Auditoría** - Capacidad de revisión y verificación  
- **Evidencia Legal** - Respaldo para procesos legales o administrativos  
- **Mejora Continua** - Análisis de datos para optimización del servicio  

### 1.2 Alcance

El registro histórico incluye:

- Mensajes enviados y recibidos (texto, imágenes, documentos)
- Cambios de estado de conversaciones
- Asignaciones y reasignaciones
- Recordatorios de citas enviados
- Confirmaciones y cancelaciones
- Acciones administrativas
- Inicio y cierre de sesiones
- Cambios en configuraciones críticas

### 1.3 Responsabilidades

| Rol | Responsabilidad |
|-----|-----------------|
| **Administrador del Sistema** | Garantizar funcionamiento del registro, backups |
| **Personal de TI** | Mantenimiento técnico, seguridad de datos |
| **Asesores** | Uso apropiado, no eliminación de registros |
| **Dirección** | Supervisión del cumplimiento normativo |
| **Auditoría Interna** | Revisión periódica de registros |

---

## 2. Marco Normativo

### 2.1 Normativas Aplicables

**Nacional (Colombia):**

1. **Ley 1581 de 2012** - Protección de Datos Personales (Habeas Data)
2. **Decreto 1377 de 2013** - Reglamentación Ley 1581
3. **Resolución 2003 de 2014** - Historia Clínica Electrónica
4. **Ley Estatutaria 1581 de 2012** - Privacidad y protección de datos

**Internacional:**

1. **GDPR** (Reglamento General de Protección de Datos - UE) - Referencia de buenas prácticas
2. **HIPAA** (Health Insurance Portability and Accountability Act - USA) - Estándares de seguridad

### 2.2 Principios de Cumplimiento

**Legalidad:**
- Consentimiento informado de pacientes
- Aviso de privacidad visible
- Uso legítimo de datos personales de salud

**Finalidad:**
- Datos recolectados solo para atención médica
- No uso con fines distintos al declarado

**Calidad:**
- Información veraz y actualizada
- Corrección de errores cuando se detecten

**Seguridad:**
- Medidas técnicas y administrativas de protección
- Encriptación de datos sensibles
- Control de acceso basado en roles

**Confidencialidad:**
- Acceso restringido a personal autorizado
- Prohibición de divulgación no autorizada

---

## 3. Arquitectura de Almacenamiento

### 3.1 Modelo de Datos

**Diagrama de Almacenamiento:**

```
┌─────────────────────────────────────────────┐
│           BASE DE DATOS PRINCIPAL           │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │  CONVERSACIONES (conversations)      │  │
│  │  - ID                                │  │
│  │  - phone_number                      │  │
│  │  - contact_name                      │  │
│  │  - status                            │  │
│  │  - created_at, updated_at           │  │
│  └──────────────────────────────────────┘  │
│                  ↓                          │
│  ┌──────────────────────────────────────┐  │
│  │  MENSAJES (messages)                 │  │
│  │  - ID                                │  │
│  │  - conversation_id                   │  │
│  │  - content                           │  │
│  │  - message_type                      │  │
│  │  - is_from_user                      │  │
│  │  - whatsapp_message_id              │  │
│  │  - status                            │  │
│  │  - sent_by                           │  │
│  │  - created_at                        │  │
│  │  - NUNCA se elimina                 │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │  CITAS (appointments)                │  │
│  │  - appointment_date                  │  │
│  │  - patient_name                      │  │
│  │  - reminder_sent                     │  │
│  │  - reminder_status                   │  │
│  │  - created_at, updated_at           │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │  AUDITORÍA (audit_logs)              │  │
│  │  - user_id                           │  │
│  │  - action                            │  │
│  │  - model_type, model_id             │  │
│  │  - old_values, new_values           │  │
│  │  - ip_address                        │  │
│  │  - user_agent                        │  │
│  │  - created_at                        │  │
│  └──────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

### 3.2 Campos de Auditoría

**Todos los registros incluyen:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | bigint | Identificador único |
| `created_at` | timestamp | Cuándo se creó el registro (INMUTABLE) |
| `updated_at` | timestamp | Última modificación |
| `deleted_at` | timestamp nullable | Soft delete (no se usa, registros permanentes) |

**Campos específicos de mensajes:**

| Campo | Descripción |
|-------|-------------|
| `whatsapp_message_id` | ID único de WhatsApp para trazabilidad |
| `sent_by` | ID del usuario que envió (para mensajes del sistema) |
| `status` | Estado del mensaje (sent, delivered, read, failed) |
| `error_message` | Detalle si falló |

### 3.3 Soft Delete vs Hard Delete

**Política de Evarisbot:**

**NO SE PERMITE Hard Delete** de:
- Mensajes
- Conversaciones
- Citas
- Logs de auditoría

**Soft Delete permitido** para:
- Usuarios (desactivación)
- Plantillas (archivado)

**Razones:**

1. Cumplimiento normativo requiere historial íntegro
2. Trazabilidad legal
3. Análisis de calidad del servicio
4. Auditorías internas y externas

---

## 4. Tipos de Registros

### 4.1 Registro de Mensajes

**Información Capturada:**

```json
{
  "id": 12345,
  "conversation_id": 789,
  "content": "Buenos días, necesito agendar una cita",
  "message_type": "text",
  "media_url": null,
  "is_from_user": true,
  "whatsapp_message_id": "wamid.HBgNNTczMDA1M...",
  "status": "read",
  "sent_by": null,
  "created_at": "2024-11-15 09:23:45",
  "updated_at": "2024-11-15 09:24:12"
}
```

**Eventos Registrados:**

1. **Mensaje Recibido del Paciente**
   - Timestamp exacto
   - Contenido completo
   - Tipo (texto, imagen, documento, etc.)

2. **Mensaje Enviado por Asesor**
   - Usuario que envió (`sent_by`)
   - Contenido enviado
   - Timestamp

3. **Cambios de Estado**
   - sent → delivered → read
   - Timestamps de cada transición

4. **Fallos de Envío**
   - Razón del fallo
   - Número de reintentos

### 4.2 Registro de Conversaciones

**Información Capturada:**

```json
{
  "id": 789,
  "phone_number": "+573001234567",
  "contact_name": "Juan Pérez Gómez",
  "status": "active",
  "assigned_to": 5,
  "last_message_at": "2024-11-15 09:23:45",
  "unread_count": 0,
  "notes": "Paciente solicita cita control cardiología",
  "created_at": "2024-11-10 14:30:00",
  "updated_at": "2024-11-15 09:24:00"
}
```

**Eventos Registrados:**

1. **Creación de Conversación**
   - Primer contacto del paciente
   - Timestamp

2. **Asignación**
   - Usuario asignado
   - Timestamp de asignación

3. **Cambios de Estado**
   - pending → active → resolved → closed
   - Historial completo de transiciones

4. **Notas Agregadas**
   - Usuario que agregó
   - Contenido de la nota
   - Timestamp

### 4.3 Registro de Citas

**Información Capturada:**

```json
{
  "id": 456,
  "appointment_date": "2024-11-20 10:00:00",
  "patient_name": "Juan Pérez Gómez",
  "phone_number": "+573001234567",
  "service_type": "Cardiología - Dr. López",
  "reminder_sent": true,
  "reminder_status": "confirmed",
  "reminder_sent_at": "2024-11-18 09:00:00",
  "created_at": "2024-11-15 10:00:00",
  "updated_at": "2024-11-18 09:15:30"
}
```

**Eventos Registrados:**

1. **Programación de Cita**
   - Fecha y hora
   - Servicio
   - Paciente

2. **Envío de Recordatorio**
   - Timestamp de envío
   - Estado del envío (exitoso/fallido)

3. **Respuesta del Paciente**
   - Confirmación o cancelación
   - Timestamp de respuesta

### 4.4 Registro de Auditoría (Audit Log)

**Tabla Especializada:**

```sql
CREATE TABLE audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED,
    action VARCHAR(255),        -- 'created', 'updated', 'deleted'
    model_type VARCHAR(255),    -- 'Message', 'Conversation', 'User'
    model_id BIGINT UNSIGNED,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_model (model_type, model_id),
    INDEX idx_created_at (created_at)
);
```

**Ejemplo de Registro:**

```json
{
  "id": 9876,
  "user_id": 5,
  "action": "updated",
  "model_type": "Conversation",
  "model_id": 789,
  "old_values": {"status": "pending", "assigned_to": null},
  "new_values": {"status": "active", "assigned_to": 5},
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "created_at": "2024-11-15 09:25:00"
}
```

**Acciones Auditadas:**

- Login/Logout de usuarios
- Cambios en configuraciones críticas
- Asignación/reasignación de conversaciones
- Creación/edición de usuarios
- Modificación de plantillas
- Cambios en estados
- Exportación de datos

---

## 5. Consulta del Historial

### 5.1 Consulta por Conversación

**Desde la Interfaz:**

1. Ir a **Chat**
2. Seleccionar conversación
3. Ver historial completo de mensajes con timestamps
4. Scroll hacia arriba carga mensajes antiguos (paginación automática)

**Información Visible:**

- Todos los mensajes históricos
- Estados de cada mensaje
- Timestamps exactos
- Usuario que envió (si fue del sistema)

### 5.2 Consulta por Paciente

**Búsqueda:**

1. Usar búsqueda global
2. Ingresar nombre o número de teléfono
3. Ver todas las conversaciones del paciente
4. Acceder a cada conversación para ver detalle

### 5.3 Consulta por Rango de Fechas

**Desde Estadísticas:**

1. Ir a **Estadísticas**
2. Seleccionar **Personalizado**
3. Elegir rango de fechas
4. Exportar datos a Excel para análisis detallado

**Información Disponible:**

- Cantidad de mensajes en el período
- Conversaciones activas
- Citas programadas y estados
- Tasas de confirmación

### 5.4 Consulta de Auditoría (Solo Administradores)

**Acceso:**

1. Panel de Administración
2. **Configuración** → **Logs de Auditoría**
3. Filtrar por:
   - Usuario
   - Acción
   - Modelo
   - Rango de fechas

**Casos de Uso:**

- Investigar cambio no autorizado
- Auditoría de cumplimiento
- Revisión de actividad de usuario
- Troubleshooting de problemas

---

## 6. Política de Retención

### 6.1 Períodos de Retención

| Tipo de Dato | Retención Online | Retención en Backup | Justificación |
|--------------|------------------|---------------------|---------------|
| **Mensajes** | Indefinido | 7 años | Normativa de salud |
| **Conversaciones** | Indefinido | 7 años | Trazabilidad paciente |
| **Citas** | 2 años | 7 años | Requisitos administrativos |
| **Logs de Auditoría** | 1 año | 7 años | Compliance |
| **Sesiones** | 30 días | No aplica | Seguridad |

**Nota:** "Indefinido" significa que NO se elimina automáticamente. Solo se archiva si es necesario por volumen.

### 6.2 Archivado de Datos Antiguos

**Proceso (Opcional, solo si volumen es crítico):**

1. **Identificar datos > 2 años**
2. **Exportar a almacenamiento de largo plazo**
   - Amazon S3 Glacier
   - Almacenamiento en cinta
3. **Mantener índices para búsqueda**
4. **Documentar ubicación**

**Importante:** Los datos archivados siguen siendo accesibles, solo cambia la ubicación física.

### 6.3 Eliminación de Datos

**Política Estricta:**

**PROHIBIDO** eliminar:
- Mensajes de pacientes
- Historial de conversaciones
- Registros de citas
- Logs de auditoría

**Permitido** eliminar (con aprobación):
- Sesiones expiradas (automático)
- Caché temporal (automático)
- Logs de desarrollo (no producción)

**Proceso de Eliminación Excepcional:**

Solo bajo orden judicial o solicitud expresa del paciente (derecho al olvido):

1. Solicitud formal por escrito
2. Revisión legal
3. Aprobación de Dirección
4. Registro del proceso de eliminación
5. Eliminación con confirmación
6. Backup de evidencia legal

---

## 7. Seguridad y Privacidad

### 7.1 Control de Acceso

**Niveles de Acceso:**

| Rol | Acceso a Historial |
|-----|-------------------|
| **Asesor** | Solo conversaciones asignadas |
| **Administrador** | Todas las conversaciones |
| **Auditor** | Solo lectura, todas las conversaciones |
| **Soporte Técnico** | Logs del sistema, no contenido de mensajes |

**Autenticación:**

- Usuario y contraseña (obligatorio)
- 2FA (recomendado)
- Sesiones con timeout (120 minutos)

**Autorización:**

- Middleware `CheckRole` verifica permisos
- Intentos de acceso no autorizados se registran en audit log

### 7.2 Encriptación

**Datos en Tránsito:**

- HTTPS (TLS 1.3)
- Certificado SSL válido
- HSTS habilitado

**Datos en Reposo:**

- Tokens de WhatsApp encriptados (AES-256)
- Contraseñas hasheadas (bcrypt)
- Base de datos en volumen encriptado (recomendado)

**Datos Sensibles:**

```php
// Configuraciones encriptadas automáticamente
Setting::set('whatsapp_token', $token, true); // true = encrypt
```

### 7.3 Monitoreo de Accesos

**Registro de Accesos:**

- Todos los logins registrados
- IP y user agent guardados
- Intentos fallidos alertan
- Múltiples intentos bloquean temporalmente

**Alertas Automáticas:**

- Login desde nueva IP
- Login fuera de horario laboral
- Múltiples exportaciones de datos
- Cambios en configuraciones críticas

### 7.4 Cumplimiento GDPR/Habeas Data

**Derechos del Paciente:**

1. **Derecho de Acceso**
   - Paciente puede solicitar copia de sus mensajes
   - Proceso: Solicitud formal → Verificación identidad → Entrega en 15 días

2. **Derecho de Rectificación**
   - Corrección de datos incorrectos
   - Se registra la corrección sin eliminar el dato original

3. **Derecho de Portabilidad**
   - Exportación de datos en formato estándar (JSON/Excel)

4. **Derecho al Olvido** (limitado en salud)
   - Evaluación legal caso por caso
   - Puede ser denegado por normativa de salud

**Consentimiento Informado:**

- Aviso de privacidad visible al paciente
- Mención en primer contacto
- Documentación de aceptación

---

## 8. Auditoría y Compliance

### 8.1 Auditorías Programadas

**Frecuencia:**

- **Mensual:** Revisión de logs de acceso
- **Trimestral:** Auditoría de cambios en configuraciones
- **Semestral:** Revisión de cumplimiento normativo
- **Anual:** Auditoría externa completa

**Checklist de Auditoría:**

- [ ] Todos los mensajes tienen timestamp
- [ ] No hay gaps en IDs de mensajes
- [ ] Logs de auditoría completos
- [ ] Backups funcionando correctamente
- [ ] Accesos documentados
- [ ] No hay eliminaciones no autorizadas
- [ ] Encriptación funcional
- [ ] Certificados SSL válidos

### 8.2 Reportes de Cumplimiento

**Reporte Mensual:**

```
REPORTE DE CUMPLIMIENTO - MES: Noviembre 2024

1. Volumen de Datos:
   - Mensajes registrados: 5,234
   - Conversaciones nuevas: 234
   - Citas programadas: 89

2. Seguridad:
   - Intentos de acceso no autorizados: 0
   - Logins exitosos: 1,456
   - Cambios en configuraciones: 3 (todos autorizados)

3. Backups:
   - Backups exitosos: 30/30
   - Último backup: 2024-11-30 02:00:00
   - Tamaño BD: 2.3 GB

4. Incidentes:
   - Fallos de envío: 12 (solucionados)
   - Downtime: 0 minutos
   - Reportes de usuarios: 0

5. Cumplimiento:
   - Retención de datos: Conforme
   - Encriptación: Activa
   - Logs completos: Sí
```

### 8.3 Certificaciones y Evidencias

**Documentación Requerida:**

1. **Política de Privacidad** (actualizada)
2. **Aviso de Privacidad** (visible para pacientes)
3. **Matriz de Riesgos** (actualizada anualmente)
4. **Plan de Continuidad** (disaster recovery)
5. **Registro de Procesamiento de Datos** (GDPR)

**Almacenamiento:**

- Documentos firmados digitalmente
- Versionado
- Ubicación: Repositorio seguro institucional

---

## 9. Procedimientos de Backup

### 9.1 Estrategia de Backup

**Regla 3-2-1:**

- **3** copias de los datos
- **2** medios diferentes
- **1** copia fuera del sitio (off-site)

**Implementación en Evarisbot:**

1. **Copia Principal:** Base de datos en producción
2. **Backup Local:** Servidor de aplicación (`/home/deploy/backups/`)
3. **Backup Remoto:** Amazon S3 / Google Drive (encriptado)

### 9.2 Frecuencia de Backups

| Tipo | Frecuencia | Retención | Responsable |
|------|------------|-----------|-------------|
| **Base de Datos** | Diario (2 AM) | 30 días local, 90 días remoto | Cron Job |
| **Archivos del Sistema** | Semanal | 15 días | Cron Job |
| **Logs** | Diario | 14 días | Logrotate |
| **Configuraciones** | Cada cambio | Indefinido (Git) | Manual |

### 9.3 Procedimiento de Backup

**Script Automatizado:**

```bash
#!/bin/bash
# /home/deploy/backup-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/deploy/backups/database"
DB_NAME="evarisbot_production"

# Hacer backup
mysqldump -u user -p'password' $DB_NAME > $BACKUP_DIR/db_backup_$DATE.sql

# Comprimir
gzip $BACKUP_DIR/db_backup_$DATE.sql

# Subir a S3 (opcional)
aws s3 cp $BACKUP_DIR/db_backup_$DATE.sql.gz s3://evarisbot-backups/

# Limpiar backups antiguos (>30 días)
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete
```

### 9.4 Verificación de Backups

**Procedimiento Mensual:**

1. Seleccionar backup aleatorio
2. Restaurar en ambiente de prueba
3. Verificar integridad de datos
4. Documentar resultado
5. Reportar cualquier anomalía

**Checklist de Verificación:**

- [ ] Archivo de backup existe
- [ ] Tamaño del archivo es consistente
- [ ] Restauración exitosa
- [ ] Datos completos y legibles
- [ ] Timestamps correctos

### 9.5 Restauración de Datos

**Procedimiento de Emergencia:**

```bash
# 1. Identificar backup a restaurar
ls -lh /home/deploy/backups/database/

# 2. Descomprimir
gunzip db_backup_YYYYMMDD_HHMMSS.sql.gz

# 3. Restaurar
mysql -u user -p'password' evarisbot_production < db_backup_YYYYMMDD_HHMMSS.sql

# 4. Verificar
mysql -u user -p'password' evarisbot_production -e "SELECT COUNT(*) FROM messages;"

# 5. Reiniciar servicios
sudo systemctl restart php8.2-fpm nginx
```

**Tiempo de Restauración Objetivo (RTO):** 2 horas  
**Punto de Recuperación Objetivo (RPO):** 24 horas (último backup diario)

---

## 10. Anexos

### Anexo A: Formato de Solicitud de Acceso a Historial

```
SOLICITUD DE ACCESO A HISTORIAL DE INTERACCIONES

Fecha de Solicitud: ________________
Solicitante: _______________________
Cargo: ____________________________
Motivo: ___________________________

Datos del Paciente:
Nombre: ___________________________
Documento: ________________________
Teléfono: __________________________

Período Solicitado:
Desde: ____________________________
Hasta: ____________________________

Autorización:
________________________
Firma del Paciente / Representante Legal

Aprobación:
________________________
Firma Director Servicios Ambulatorios
```

### Anexo B: Formato de Eliminación Excepcional

```
SOLICITUD DE ELIMINACIÓN EXCEPCIONAL DE DATOS

ADVERTENCIA: Este procedimiento solo se autoriza bajo circunstancias 
excepcionales y con fundamento legal.

Fecha: ____________________________
Solicitante: _______________________
Fundamento Legal: __________________

Datos a Eliminar:
Tipo: _____________________________
ID del Registro: ___________________
Período: __________________________

Justificación:
_________________________________
_________________________________

Revisión Legal:
Aprobado: [ ]  Rechazado: [ ]
Firma Asesor Legal: _______________

Aprobación Final:
Firma Director General: ____________

Ejecución:
Fecha: ____________________________
Ejecutado por: ____________________
Evidencia conservada en: ___________
```

### Anexo C: Glosario

| Término | Definición |
|---------|------------|
| **Audit Log** | Registro de auditoría de acciones del sistema |
| **Backup** | Copia de seguridad de datos |
| **Compliance** | Cumplimiento normativo |
| **GDPR** | General Data Protection Regulation (UE) |
| **Hard Delete** | Eliminación física permanente |
| **Soft Delete** | Marcado como eliminado sin borrar físicamente |
| **RTO** | Recovery Time Objective (tiempo de recuperación) |
| **RPO** | Recovery Point Objective (punto de recuperación) |
| **Timestamp** | Marca temporal exacta de un evento |
| **Trazabilidad** | Capacidad de rastrear el historial completo |

---

## Control de Cambios

| Versión | Fecha | Autor | Cambios |
|---------|-------|-------|---------|
| 1.0 | Nov 2024 | Equipo Técnico | Versión inicial |

---

**© 2024 - Evarisbot**  
**Confidencial - Uso Interno**

**Para consultas sobre este documento:**  
Email: cumplimiento@dominio.com  
Teléfono: +57 XXX XXX XXXX
