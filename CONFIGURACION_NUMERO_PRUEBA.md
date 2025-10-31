# 📱 Configuración del Número de Prueba de Meta

## ✅ **Datos del Número de Prueba:**

```
Número de Prueba: +1 555 180 2633
Phone Number ID: 727639077099774
Business Account ID (WABA ID): 2962142497321275
```

---

## 🔧 **Configuración en tu App:**

### **1. Ve a Settings en tu app Evarisbot:**
```
Login como admin → Settings → WhatsApp Configuration
```

### **2. Completa los campos:**

| Campo | Valor |
|-------|-------|
| **Phone Number ID** | `727639077099774` |
| **Access Token** | *(Generar en Meta for Developers)* |
| **Business Account ID** | `2962142497321275` |
| **Verify Token** | *(Crear uno aleatorio, ej: "evarisbot_verify_2025")* |

---

## 🔑 **Obtener el Access Token:**

### **Opción A: Token Temporal (24 horas)**

1. **Ve a:** https://developers.facebook.com/apps/
2. **Selecciona tu app**
3. **WhatsApp** → **API Setup**
4. **Temporary Access Token** → Click "Copy"
5. **Pega en tu app**

⚠️ **Expira en 24 horas** - Para pruebas cortas

---

### **Opción B: System User Token (NO EXPIRA) ✅ RECOMENDADO**

1. **Ve a:** https://business.facebook.com/settings/system-users
2. **Add** → **System User**
   - Name: "Evarisbot Production"
   - Role: Admin
3. **Add Assets** → **Apps**
   - Select tu app
   - Permission: "Manage app"
4. **Generate New Token**
   - App: [Tu app]
   - Permissions: `whatsapp_business_messaging`, `whatsapp_business_management`
   - Expiration: **Never** (60 días o Never)
5. **Copy token** → Pega en tu app

✅ **No expira** - Para producción

---

## 📝 **Configurar Webhook:**

### **1. URL del Webhook:**
```
https://tudominio.com/webhook/whatsapp
```

### **2. Verify Token:**
Crea uno aleatorio (el que pusiste en Settings):
```
evarisbot_verify_2025
```

### **3. Configurar en Meta:**

1. **Ve a:** WhatsApp → Configuration
2. **Webhook** → **Edit**
3. **Callback URL:** `https://tudominio.com/webhook/whatsapp`
4. **Verify Token:** `evarisbot_verify_2025`
5. **Click** "Verify and Save"

### **4. Suscribirse a eventos:**

Marca estos campos:
- ✅ `messages`
- ✅ `message_deliveries`
- ✅ `message_statuses`

---

## 🧪 **Probar la Configuración:**

### **Test 1: Enviar mensaje desde tu app**

1. **Login** en tu app
2. **Ve a** Conversaciones
3. **Crea una conversación de prueba:**
   - Número: `+1234567890` (cualquier número para testing)
4. **Escribe mensaje:** "Hello from Evarisbot"
5. **Click Send**
6. **Verifica en logs** (o en tu teléfono si usas tu número)

---

### **Test 2: Recibir mensaje en tu app**

1. **Desde WhatsApp** envía mensaje a: `+1 555 180 2633`
2. **El mensaje debe aparecer** en tu app en Conversaciones
3. **Si no aparece:**
   - Verifica webhook en Meta
   - Verifica logs: `storage/logs/laravel.log`

---

## 📱 **Agregar Tu Teléfono como Número de Prueba:**

Para que puedas enviar/recibir mensajes desde TU WhatsApp personal:

1. **Ve a:** https://developers.facebook.com/apps/
2. **Tu app** → **WhatsApp** → **API Setup**
3. **To:** section → **Manage phone number list**
4. **Add phone number**
5. **Ingresa tu número:** `+57 XXX XXX XXXX`
6. **Te llegará código de verificación**
7. **Ingrésalo**

Ahora TU número puede enviar/recibir mensajes del bot.

---

## 🎬 **Preparar para el Video:**

### **Lo que Meta necesita ver:**

✅ **Settings page mostrando:**
- Phone Number ID visible: `727639077099774`
- Status: Connected ✓
- Test connection exitoso

✅ **Envío de mensaje:**
- Tu app → Type "Hello, I need help with my appointment"
- Click Send
- Mensaje aparece en WhatsApp (tu teléfono)

✅ **Recepción de mensaje:**
- Tu WhatsApp → Type "Yes, I need assistance"
- Mensaje aparece en tu app automáticamente

---

## 🚨 **Troubleshooting:**

### **Problema: "WhatsApp API not configured"**
**Solución:**
- Verifica que Phone Number ID esté correcto
- Verifica que Access Token no haya expirado
- Click "Test Connection" en Settings

### **Problema: "Message failed to send"**
**Solución:**
- Verifica que el número destino esté agregado como "test number"
- Verifica logs: `storage/logs/laravel.log`
- Revisa Activity Log en Meta Developers

### **Problema: "Webhook verification failed"**
**Solución:**
- Verifica que Verify Token sea el mismo en app y Meta
- Verifica que URL esté accesible públicamente
- Usa ngrok si estás en local: `ngrok http 8000`

---

## ✅ **Checklist de Configuración:**

- [ ] Phone Number ID configurado: `727639077099774`
- [ ] Access Token generado (System User - Never expires)
- [ ] Business Account ID configurado: `2962142497321275`
- [ ] Verify Token creado y guardado
- [ ] Webhook URL configurada en Meta
- [ ] Webhook verificado exitosamente
- [ ] Eventos suscritos (messages, deliveries, statuses)
- [ ] Tu número personal agregado como test number
- [ ] Test Connection exitoso en Settings
- [ ] Mensaje enviado desde app a WhatsApp ✓
- [ ] Mensaje recibido desde WhatsApp a app ✓

---

## 🎯 **Siguiente Paso:**

Una vez que todo esto funcione → **Grabar el video**

**Fecha:** 30 oct 2025
