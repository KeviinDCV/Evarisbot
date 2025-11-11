# 🏥 Sistema de Recordatorios Automáticos de Citas - Evarisbot

## ✅ **Implementación Completada**

Sistema completo de recordatorios automáticos de citas médicas por WhatsApp Business API, siguiendo las políticas y mejores prácticas de Meta.

---

## 📋 **Características Implementadas**

### ✨ **Funcionalidades:**
- ✅ Envío automático de recordatorios 48 horas antes de la cita
- ✅ Template de WhatsApp compatible con políticas de Meta (categoría UTILITY)
- ✅ Integración completa con sistema de conversaciones existente
- ✅ Dashboard con estadísticas de recordatorios (enviados, pendientes, fallidos)
- ✅ Respeto de límites de envío diario (configurable)
- ✅ Tracking de estado de mensajes (sent, delivered, read, failed)
- ✅ Comando manual y ejecución automática programada
- ✅ Modo dry-run para pruebas sin envío real

### 🔧 **Componentes Técnicos:**
- **Modelo:** `Appointment` con campos de recordatorio
- **Servicio:** `AppointmentReminderService` para lógica de envío
- **Comando:** `appointments:send-reminders` (Artisan)
- **Scheduler:** Ejecución diaria automática a las 9:00 AM
- **UI:** Dashboard actualizado con indicadores visuales

---

## 🚀 **Pasos de Configuración**

### **1. Ejecutar Migraciones**
```bash
php artisan migrate
```

Esto creará:
- Campos de recordatorio en tabla `appointments`
- Configuraciones en tabla `settings`

### **2. Crear Template en Meta** 📱

**IMPORTANTE:** Debes crear el template en Meta Business Manager **ANTES** de usar el sistema.

Sigue la guía completa en: `GUIA_TEMPLATE_WHATSAPP.md`

**Resumen rápido:**
1. Ve a [Meta Business Manager](https://business.facebook.com/)
2. WhatsApp Manager > Message Templates > Create Template
3. **Nombre:** `appointment_reminder`
4. **Categoría:** `UTILITY` (obligatorio)
5. **Idioma:** Spanish (es)
6. **Body:**
```
🏥 *Recordatorio de Cita Médica*

Hola {{1}}, le recordamos su cita médica:

📅 *Fecha:* {{2}}
⏰ *Hora:* {{3}}
👨‍⚕️ *Médico:* {{4}}
🏥 *Especialidad:* {{5}}
📍 *Consultorio:* {{6}}

Por favor, llegue 15 minutos antes de su cita.

Si no puede asistir, responda a este mensaje para reprogramar.
```

7. Enviar para aprobación (1-24 horas)
8. Una vez **APPROVED**, continuar

### **3. Verificar Configuraciones**

Revisa en Admin > Settings que existan:
- `reminder_enabled` = true
- `reminder_days_in_advance` = 2 (días antes de enviar)
- `reminder_max_per_day` = 500 (respeta límites de tu tier)
- `reminder_template_name` = appointment_reminder

### **4. Configurar Task Scheduler** ⏰

**Windows (XAMPP):**
1. Abre el Programador de Tareas de Windows
2. Crear nueva tarea:
   - **Nombre:** Laravel Scheduler - Evarisbot
   - **Trigger:** Diariamente a las 9:00 AM
   - **Action:** Iniciar programa
     - **Programa:** `C:\xampp\php\php.exe`
     - **Argumentos:** `C:\xampp\htdocs\evarisbot\artisan schedule:run`
   - **Repetir:** Cada 1 minuto durante 24 horas

**Linux/Mac:**
```bash
crontab -e
```
Agregar:
```
* * * * * cd /ruta/a/evarisbot && php artisan schedule:run >> /dev/null 2>&1
```

---

## 🎯 **Uso del Sistema**

### **Envío Manual (Pruebas)**

**Dry-run (sin enviar mensajes reales):**
```bash
php artisan appointments:send-reminders --dry-run
```

**Envío real:**
```bash
php artisan appointments:send-reminders
```

**Con límite personalizado:**
```bash
php artisan appointments:send-reminders --limit=10
```

### **Envío Automático**

Una vez configurado el Task Scheduler, el sistema:
1. Se ejecuta automáticamente todos los días a las 9:00 AM
2. Busca citas para dentro de 2 días (configurable)
3. Envía recordatorios a pacientes con WhatsApp
4. Registra todo en logs
5. Actualiza estado en la base de datos

---

## 📊 **Monitoreo y Seguimiento**

### **Dashboard de Citas** (`/admin/appointments`)

Muestra:
- 📤 **Recordatorios Enviados:** Total de recordatorios exitosos
- ⏰ **Por Enviar:** Citas pendientes de recordatorio
- ❌ **Fallidos:** Errores en envío

Cada cita en la tabla muestra:
- ✅ Verde: Recordatorio enviado
- 🔵 Azul: Entregado
- ⏳ Amarillo: Pendiente
- ❌ Rojo: Fallido

### **Logs**

Ver logs del sistema:
```bash
tail -f storage/logs/laravel.log | grep -i "recordatorio\|reminder"
```

### **Verificar Próximos Recordatorios**

```bash
php artisan tinker
```

```php
// Ver citas que recibirán recordatorio hoy
$targetDate = now()->addDays(2)->startOfDay();
Appointment::whereDate('citfc', $targetDate)
    ->where('reminder_sent', false)
    ->whereNotNull('pactel')
    ->get(['nom_paciente', 'citfc', 'cithor', 'pactel']);
```

---

## 🔧 **Configuración Avanzada**

### **Cambiar Días de Anticipación**

```bash
php artisan tinker
```

```php
// Cambiar a 1 día de anticipación
Setting::set('reminder_days_in_advance', '1');

// Cambiar a 3 días
Setting::set('reminder_days_in_advance', '3');
```

### **Cambiar Hora de Envío**

Editar `routes/console.php`:
```php
Schedule::command('appointments:send-reminders')
    ->dailyAt('08:00') // Cambiar hora aquí
    ->timezone('America/Bogota');
```

### **Deshabilitar Recordatorios Temporalmente**

```php
Setting::set('reminder_enabled', 'false');
```

Para reactivar:
```php
Setting::set('reminder_enabled', 'true');
```

---

## 🚨 **Políticas y Límites de Meta**

### ⚠️ **Importante:**

1. **Opt-in obligatorio:** Solo enviar a pacientes que dieron consentimiento
2. **Un recordatorio por cita:** No enviar múltiples recordatorios
3. **Límites de mensajes:**
   - Tier 1: 1,000 mensajes/24h
   - Tier 2: 10,000 mensajes/24h
   - Tier 3: 100,000 mensajes/24h
   - Tier 4: Ilimitado
4. **Calidad del mensaje:** Mantener tasa de respuesta alta y bloqueos bajos
5. **Contenido:** Solo información relacionada con la cita

### 📈 **Escalar el Tier:**

Para aumentar límites, Meta evalúa:
- Calificación de calidad del número (Alto/Medio/Bajo)
- Estado del número (Conectado)
- Historial de envío

---

## 🔍 **Troubleshooting**

### **Problema: Template Rechazado**
**Solución:** Asegúrate de:
- Usar categoría UTILITY (no MARKETING)
- No incluir contenido promocional
- Variables claramente identificadas con {{1}}, {{2}}, etc.
- Seguir formato de la guía exactamente

### **Problema: No se envían recordatorios**
**Verificar:**
```bash
# 1. Verificar configuración
php artisan tinker
Setting::get('reminder_enabled');
Setting::get('reminder_template_name');

# 2. Verificar template aprobado en Meta

# 3. Verificar citas elegibles
php artisan appointments:send-reminders --dry-run

# 4. Ver logs
tail -f storage/logs/laravel.log
```

### **Problema: Error "Template not found"**
- El template no está aprobado en Meta
- El nombre del template no coincide exactamente
- Verificar: `reminder_template_name` en settings

### **Problema: Error de API de WhatsApp**
```bash
# Verificar tokens
php artisan tinker
Setting::get('whatsapp_token');
Setting::get('whatsapp_phone_number_id');

# Probar conexión
curl -X GET "https://graph.facebook.com/v18.0/me?access_token=YOUR_TOKEN"
```

---

## 📝 **Flujo Completo**

```
1. Usuario sube archivo Excel con citas
   ↓
2. Sistema guarda citas en BD con reminder_sent=false
   ↓
3. Scheduler ejecuta comando diariamente (9:00 AM)
   ↓
4. Comando busca citas para dentro de 2 días
   ↓
5. Para cada cita elegible:
   - Formatea número de teléfono
   - Prepara parámetros del template
   - Envía mensaje via WhatsApp API
   - Crea/actualiza Conversation
   - Guarda Message en BD
   - Marca reminder_sent=true
   ↓
6. Usuario ve conversación en /admin/chat
   ↓
7. Paciente responde (confirma/cancela/reprograma)
   ↓
8. Asesor atiende en chat normal
```

---

## 📚 **Documentos Relacionados**

- `GUIA_TEMPLATE_WHATSAPP.md` - Guía paso a paso para crear template
- `storage/logs/laravel.log` - Logs del sistema
- [Meta Business Manager](https://business.facebook.com/)
- [WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp)

---

## ✅ **Checklist de Implementación**

Antes de ir a producción:

- [ ] Migraciones ejecutadas
- [ ] Template creado y **APPROVED** en Meta
- [ ] Configuraciones verificadas en Admin > Settings
- [ ] Task Scheduler configurado
- [ ] Prueba con `--dry-run` exitosa
- [ ] Envío manual de prueba a un número real exitoso
- [ ] Dashboard muestra estadísticas correctamente
- [ ] Logs muestran ejecución correcta
- [ ] Pacientes han dado consentimiento para recibir WhatsApp
- [ ] Equipo capacitado para responder consultas de pacientes

---

## 🎉 **¡Sistema Listo!**

El sistema de recordatorios está completamente funcional. Los pacientes recibirán recordatorios automáticos 2 días antes de su cita, y podrán responder directamente en WhatsApp donde serán atendidos por el equipo.

**Siguiente paso:** Crear el template en Meta Business Manager siguiendo `GUIA_TEMPLATE_WHATSAPP.md`
