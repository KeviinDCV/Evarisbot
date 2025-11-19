# 📦 Sistema de Envío por Tandas/Lotes - Recordatorios de Citas

## ✅ **Implementación Completada** - 14 Nov 2025

Sistema mejorado de envío de recordatorios que procesa mensajes en **tandas/lotes** con pausas automáticas entre cada grupo. Esto permite ver el progreso de cada tanda y asegurar que todos los mensajes se envían correctamente.

---

## 🎯 **Objetivo del Sistema**

Anteriormente, el sistema enviaba todos los mensajes de corrido con delays de 1 segundo entre cada uno, pero **no se veía reflejado en tiempo real** y era difícil confirmar que se estaban enviando.

**Ahora:**
1. ✅ Envía un **lote/tanda** de mensajes (ej: 10 mensajes)
2. ✅ **Pausa automáticamente** (ej: 5 segundos)
3. ✅ Se **ve reflejado en tiempo real** (progreso se actualiza)
4. ✅ Continúa con el **siguiente lote**
5. ✅ Repite hasta enviar **todos los recordatorios**

---

## 📋 **Características Nuevas**

### 1. **Envío por Lotes/Tandas**
- Mensajes se dividen en grupos pequeños (configurable)
- Pausa automática entre cada lote
- Progreso visible en tiempo real
- Logs detallados por lote

### 2. **Modo Prueba** 🧪
- Botón especial para pruebas
- Cambia TODOS los números pendientes a tu número
- Perfecto para verificar que los mensajes se envían
- **Recomendado:** Antes de envío real, usar modo prueba

### 3. **Configuración Flexible**
- `reminder_batch_size`: Tamaño de cada lote (default: 10)
- `reminder_batch_pause_seconds`: Segundos de pausa entre lotes (default: 5)
- Ajustable según necesidades

---

## ⚙️ **Configuración**

Las siguientes configuraciones fueron agregadas a la tabla `settings`:

| Setting | Valor Default | Descripción |
|---------|---------------|-------------|
| `reminder_batch_size` | `10` | Número de recordatorios por lote/tanda |
| `reminder_batch_pause_seconds` | `5` | Segundos de pausa entre lotes |

### **Modificar Configuración:**

```bash
php artisan tinker
```

```php
// Cambiar tamaño de lote (más pequeño = más pausas, más visible)
Setting::set('reminder_batch_size', '5');

// Cambiar tiempo de pausa (más largo = más tiempo para verificar)
Setting::set('reminder_batch_pause_seconds', '10');

// Ejemplo para pruebas: lotes muy pequeños con pausas largas
Setting::set('reminder_batch_size', '3');
Setting::set('reminder_batch_pause_seconds', '15');
```

---

## 🚀 **Cómo Usar**

### **Opción 1: Modo Prueba (RECOMENDADO para primera vez)** 🧪

1. Ve a `/admin/appointments`
2. Verás tus citas pendientes
3. Click en **"Modo Prueba"** (botón morado con ícono de tubo de ensayo)
4. Ingresa **tu número de teléfono** (ej: `3001234567`)
5. Confirma que quieres cambiar todos los números pendientes
6. **IMPORTANTE:** Esto cambia SOLO las citas de la fecha objetivo (pasado mañana)
7. Ahora click en **"Comenzar Envío"**
8. Verás cómo se envían en tandas:
   - Lote 1: 10 mensajes → pausa 5 seg
   - Lote 2: 10 mensajes → pausa 5 seg
   - etc.

### **Opción 2: Envío Normal (producción)**

1. Ve a `/admin/appointments`
2. Verifica que los números de teléfono sean correctos
3. Click en **"Comenzar Envío"**
4. Observa el progreso en tiempo real

---

## 📊 **Flujo de Envío por Tandas**

```
Total: 35 mensajes pendientes
Tamaño de lote: 10 mensajes
Pausa entre lotes: 5 segundos

┌─────────────────────────────────────────┐
│ LOTE 1: Mensajes 1-10                   │
│ ✅ Enviando...                          │
│ ✅ Progreso: 10/35 (29%)                │
│ ⏸️  PAUSA 5 SEGUNDOS                    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ LOTE 2: Mensajes 11-20                  │
│ ✅ Enviando...                          │
│ ✅ Progreso: 20/35 (57%)                │
│ ⏸️  PAUSA 5 SEGUNDOS                    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ LOTE 3: Mensajes 21-30                  │
│ ✅ Enviando...                          │
│ ✅ Progreso: 30/35 (86%)                │
│ ⏸️  PAUSA 5 SEGUNDOS                    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ LOTE 4: Mensajes 31-35 (último)         │
│ ✅ Enviando...                          │
│ ✅ Progreso: 35/35 (100%)               │
│ ✅ COMPLETADO                           │
└─────────────────────────────────────────┘
```

---

## 📝 **Logs del Sistema**

Durante el envío, los logs muestran información detallada por lote:

```log
[2025-11-14 09:00:00] Recordatorio enviado exitosamente (síncrono)
    appointment_id: 123
    message_id: wamid.xxxxx
    batch: 1
    progress: {sent: 5, failed: 0, total: 35}

[2025-11-14 09:00:12] Lote completado, pausando...
    batch: 1
    total_batches: 4
    sent: 10
    failed: 0
    pause_seconds: 5

[2025-11-14 09:00:17] Continuando con siguiente lote...
    batch: 2
    remaining: 25
```

### **Ver Logs en Tiempo Real:**

```bash
# Windows PowerShell
Get-Content storage\logs\laravel.log -Wait -Tail 50 | Select-String "Lote|batch"

# Alternativa más simple
Get-Content storage\logs\laravel.log -Wait -Tail 50
```

---

## 🧪 **Ejemplo de Prueba Completa**

### **Escenario:** Tienes 25 citas pendientes y quieres probar con tu número

```bash
# 1. Configurar lotes pequeños para ver bien el progreso
php artisan tinker
Setting::set('reminder_batch_size', '5');
Setting::set('reminder_batch_pause_seconds', '10');
exit
```

**En el navegador:**
1. Ve a `http://localhost:8000/admin/appointments`
2. Click en **"Modo Prueba"** 🧪
3. Ingresa tu número: `3045782893`
4. Confirma
5. Click en **"Comenzar Envío"**

**Resultado esperado:**
- Lote 1: 5 mensajes → recibes 5 WhatsApp → pausa 10 seg
- Lote 2: 5 mensajes → recibes 5 WhatsApp → pausa 10 seg
- Lote 3: 5 mensajes → recibes 5 WhatsApp → pausa 10 seg
- Lote 4: 5 mensajes → recibes 5 WhatsApp → pausa 10 seg
- Lote 5: 5 mensajes → recibes 5 WhatsApp → ✅ COMPLETADO

**Total:** 25 mensajes recibidos en tu WhatsApp en ~50 segundos

---

## 🔍 **Verificar que Funcionó**

### **1. Verificar en WhatsApp Business API:**
```bash
# Ver últimos mensajes enviados
curl -X GET "https://graph.facebook.com/v18.0/YOUR_PHONE_ID/messages" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### **2. Verificar en Base de Datos:**
```bash
php artisan tinker
```

```php
// Ver mensajes enviados hoy
Message::whereDate('created_at', today())->count();

// Ver conversaciones creadas hoy
Conversation::whereDate('created_at', today())->count();

// Ver recordatorios marcados como enviados
Appointment::where('reminder_sent', true)->count();
```

### **3. Verificar en Dashboard:**
- Estadística "Recordatorios Enviados" debe aumentar
- Citas deben cambiar de estado "Pendiente" → "Enviado"
- Indicador verde ✅ en cada cita enviada

---

## ⚠️ **Importante: Límites de Meta**

Recuerda que el sistema **respeta los límites de Meta**:
- ✅ **1 mensaje por segundo** máximo (delay de 1 segundo entre mensajes)
- ✅ **20 mensajes por minuto** máximo
- ✅ **1,000 conversaciones nuevas por día** (Tier 1)

Las pausas entre lotes son **ADICIONALES** a estos delays, no los reemplazan.

**Ejemplo con batch_size=10:**
- Envía 10 mensajes (10 segundos con delays de 1 seg)
- Pausa 5 segundos
- Envía 10 mensajes (10 segundos)
- Pausa 5 segundos
- etc.

**Total:** ~15 segundos por lote de 10 mensajes

---

## 🎯 **Casos de Uso**

### **Caso 1: Pruebas con pocas citas**
```php
// Configuración recomendada
Setting::set('reminder_batch_size', '3');
Setting::set('reminder_batch_pause_seconds', '10');
```
- Lotes muy pequeños
- Pausas largas
- Fácil de seguir visualmente

### **Caso 2: Producción con muchas citas**
```php
// Configuración recomendada
Setting::set('reminder_batch_size', '20');
Setting::set('reminder_batch_pause_seconds', '5');
```
- Lotes más grandes
- Pausas cortas
- Más eficiente

### **Caso 3: Verificación intensiva**
```php
// Configuración recomendada
Setting::set('reminder_batch_size', '5');
Setting::set('reminder_batch_pause_seconds', '15');
```
- Lotes pequeños
- Pausas largas
- Tiempo suficiente para verificar cada lote en WhatsApp

---

## 🔧 **Archivos Modificados**

### **Backend:**
- `database/migrations/2025_11_14_123216_add_batch_size_setting.php` - Nueva migración
- `app/Http/Controllers/AppointmentController.php` - Lógica de lotes + modo prueba
- `routes/web.php` - Nueva ruta para modo prueba

### **Frontend:**
- `resources/js/pages/admin/appointments/index.tsx` - Botón modo prueba

---

## ✅ **Checklist de Verificación**

Antes de usar en producción:

- [ ] Migración ejecutada: `php artisan migrate`
- [ ] Configuración de lotes ajustada según necesidad
- [ ] Prueba con **modo prueba** usando tu número
- [ ] Verificar que recibes los mensajes en WhatsApp
- [ ] Verificar que se ven las pausas entre lotes
- [ ] Verificar logs en `storage/logs/laravel.log`
- [ ] Verificar que progreso se actualiza en dashboard
- [ ] Template aprobado en Meta Business Manager
- [ ] Token de WhatsApp configurado correctamente

---

## 🎉 **Resumen**

**Problema anterior:** 
- Mensajes se enviaban todos de corrido
- No se veía reflejado en tiempo real
- Difícil confirmar que se estaban enviando

**Solución implementada:**
- ✅ Envío por **tandas/lotes configurables**
- ✅ **Pausas automáticas** entre lotes
- ✅ **Progreso en tiempo real** visible
- ✅ **Modo prueba** para verificar con tu número
- ✅ **Logs detallados** por lote
- ✅ Respeta **límites de Meta** (1 msg/seg, 20 msg/min)

**Próximos pasos:**
1. Hacer prueba con modo prueba
2. Verificar que recibes mensajes
3. Ajustar tamaño de lote según preferencia
4. Usar en producción

---

**Fecha de implementación:** 14 Noviembre 2025  
**Versión:** 2.0 - Sistema de Tandas
