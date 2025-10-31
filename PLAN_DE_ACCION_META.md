# 🚀 Plan de Acción - Aprobación Meta WhatsApp

## ✅ **COMPLETADO:**

### **1. Código limpio de Twilio ✓**
- ❌ Eliminada lógica de Twilio en `ConversationController.php`
- ❌ Comentadas rutas de Twilio en `routes/web.php`
- ✅ App usa exclusivamente WhatsApp Business API de Meta

### **2. Datos del número de prueba recibidos ✓**
```
Número: +1 555 180 2633
Phone Number ID: 727639077099774
Business Account ID: 2962142497321275
```

### **3. Guías creadas ✓**
- ✅ `CONFIGURACION_NUMERO_PRUEBA.md` - Cómo configurar
- ✅ `GUIA_VIDEO_META_ACTUALIZADA.md` - Qué grabar y cómo

---

## 📝 **PENDIENTE (En orden):**

### **HOY - Configuración (30 minutos):**

1. **Generar System User Token (NO EXPIRA):**
   - Ve a: https://business.facebook.com/settings/system-users
   - Add System User: "Evarisbot Production"
   - Generate Token con permisos:
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`
   - Expiration: **Never**
   - Copia el token

2. **Configurar en tu app:**
   - Login como admin
   - Settings → WhatsApp Configuration
   - Phone Number ID: `727639077099774`
   - Access Token: [el que generaste]
   - Business Account ID: `2962142497321275`
   - Verify Token: `evarisbot_verify_2025`
   - Click "Save" → "Test Connection"
   - Debe mostrar: ✅ Connected

3. **Agregar tu número como test number:**
   - Ve a: https://developers.facebook.com/apps/
   - Tu app → WhatsApp → API Setup
   - "To:" → Manage phone number list
   - Add phone number: [tu número personal]
   - Verificar con código

4. **Configurar webhook:**
   - WhatsApp → Configuration → Webhook
   - Callback URL: `https://tudominio.com/webhook/whatsapp`
   - Verify Token: `evarisbot_verify_2025`
   - Subscribe to: messages, message_deliveries, message_statuses

5. **Probar:**
   - Desde tu WhatsApp personal → Envía "Hola" a `+1 555 180 2633`
   - Debe aparecer en tu app
   - Desde tu app → Envía mensaje de respuesta
   - Debe llegar a tu WhatsApp

---

### **MAÑANA - Preparación del Video (2 horas):**

6. **Cambiar UI a inglés:**
   - Editar textos clave en español → inglés
   - O usar archivo `resources/lang/en.json` que ya creamos
   - Principales: Login, Conversations, Send, Settings

7. **Instalar herramientas:**
   - OBS Studio: https://obsproject.com/
   - scrcpy (Android): `winget install scrcpy`
   - O LonelyScreen (iPhone): https://www.lonelyscreen.com/

8. **Configurar OBS:**
   - Scene 1: Window Capture (tu navegador)
   - Scene 2: Display Capture (tu teléfono via scrcpy)
   - Layout: 50% app arriba, 50% WhatsApp abajo
   - Output: 1920x1080, 30fps, MP4

9. **Practicar el guion:**
   - Leer `GUIA_VIDEO_META_ACTUALIZADA.md`
   - Practicar narración 2-3 veces
   - Medir tiempos (máximo 5 minutos)

---

### **PASADO MAÑANA - Grabación (3 horas):**

10. **Preparativos finales:**
    - [ ] App con UI en inglés
    - [ ] Settings page con datos visibles
    - [ ] 1-2 conversaciones de prueba listas
    - [ ] WhatsApp abierto en tu teléfono
    - [ ] OBS configurado y testeado
    - [ ] Micrófono funcionando
    - [ ] Internet estable

11. **Grabar el video:**
    - Seguir estructura de `GUIA_VIDEO_META_ACTUALIZADA.md`
    - Mostrar:
      - ✅ Settings con Phone Number ID
      - ✅ Mensaje enviado desde app → WhatsApp
      - ✅ Mensaje recibido desde WhatsApp → app
      - ✅ Template o mensaje automático
      - ✅ Gestión de conversación
    - Duración: 4-5 minutos
    - Split screen siempre visible

12. **Editar video:**
    - Agregar subtítulos en inglés
    - Agregar anotaciones (flechas, textos)
    - Exportar en MP4, 1080p

---

### **DÍA 4 - Subir y Esperar (30 minutos):**

13. **Subir a Meta:**
    - Ve a: https://developers.facebook.com/apps/
    - Tu app → App Review → Permissions and Features
    - whatsapp_business_messaging → Edit
    - Upload video
    - Copiar descripción de `GUIA_VIDEO_META_ACTUALIZADA.md`
    - Submit for Review

14. **Esperar aprobación:**
    - Timeline: 24-48 horas
    - Revisa email y notificaciones de Meta
    - Si rechazan: Lee feedback y corrige
    - Si aprueban: 🎉 ¡Listo!

---

## ⚠️ **CRÍTICO - No olvidar en el video:**

1. **Phone Number ID VISIBLE:**
   - ZOOM IN en Settings
   - Debe verse: `727639077099774`

2. **Split Screen SIMULTÁNEO:**
   - NO grabar app y WhatsApp separados
   - Deben verse AMBOS al mismo tiempo
   - Especialmente al enviar/recibir mensajes

3. **Mensajes IDÉNTICOS:**
   - El texto debe ser exactamente igual
   - Timestamps deben coincidir
   - ZOOM IN para que se vea claramente

4. **Tiempo REAL:**
   - No acelerar el video
   - Mostrar la demora natural (2-5 segundos)
   - Meta quiere ver que es en vivo, no simulado

5. **Narración en INGLÉS:**
   - O subtítulos en inglés
   - UI de la app en inglés

---

## 📊 **Checklist Final:**

### **Antes de grabar:**
- [ ] Código sin referencias a Twilio
- [ ] Número de prueba configurado
- [ ] Token generado (System User - Never expires)
- [ ] Test Connection: Success ✅
- [ ] Tu número agregado como test number
- [ ] Webhook configurado y verificado
- [ ] Prueba exitosa: Mensaje enviado app → WhatsApp
- [ ] Prueba exitosa: Mensaje recibido WhatsApp → app
- [ ] UI cambiada a inglés
- [ ] OBS instalado y configurado
- [ ] scrcpy/LonelyScreen funcionando
- [ ] Guion practicado

### **Durante la grabación:**
- [ ] Split screen visible siempre
- [ ] Phone Number ID mostrado claramente
- [ ] Mensajes idénticos en ambas pantallas
- [ ] Timestamps visibles
- [ ] Narración clara en inglés
- [ ] Duración: 4-5 minutos
- [ ] Audio sin ruidos

### **Antes de subir:**
- [ ] Video editado con subtítulos
- [ ] Exportado en 1080p, 30fps
- [ ] Descripción preparada
- [ ] Notas para reviewer listas
- [ ] Todo verificado contra checklist de Meta

---

## 🎯 **Resultado Esperado:**

**Después de seguir este plan:**
- ✅ Video perfecto según especificaciones de Meta
- ✅ Aprobación en 24-48 horas
- ✅ WhatsApp Business API funcionando con cualquier número
- ✅ Hospital puede empezar a recibir mensajes de pacientes reales
- ✅ Bot en producción

---

## 📞 **Si necesitas ayuda:**

- **Configuración:** Lee `CONFIGURACION_NUMERO_PRUEBA.md`
- **Video:** Lee `GUIA_VIDEO_META_ACTUALIZADA.md`
- **Problemas:** Revisa sección Troubleshooting

---

## ⏱️ **Timeline Total:**

| Día | Tarea | Tiempo |
|-----|-------|--------|
| **Hoy** | Configurar número de prueba | 30 min |
| **Mañana** | Preparar video (herramientas + práctica) | 2 hrs |
| **Pasado mañana** | Grabar + editar video | 3 hrs |
| **Día 4** | Subir a Meta | 30 min |
| **Día 5-6** | Esperar aprobación | - |
| **TOTAL** | | **6 horas de trabajo** |

---

**¡Éxito! 🚀**

**Fecha:** 30 oct 2025
