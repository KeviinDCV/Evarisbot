# INNOVACIÓN Y DESARROLLO - HOSPITAL UNIVERSITARIO DEL VALLE
# EVARISBOT

# REGISTRO HISTÓRICO DE INTERACCIONES Y CONTROL DE CAMBIOS

**Proyecto:** Sistema de Gestión de WhatsApp Business para Servicios Ambulatorios
**Código Interno:** PROY-IYD-2025-Evarisbot
**Inicio del Proyecto:** 01 de Septiembre de 2025
**Fecha de Última Actualización:** 06 de Febrero de 2026

---

## 1. PROPÓSITO DEL DOCUMENTO

Este documento tiene como finalidad mantener una bitácora cronológica, detallada e inmutable de todas las interacciones, decisiones técnicas, hitos de desarrollo y cambios significativos ocurridos durante el ciclo de vida del proyecto **Evarisbot**. Sirve como evidencia de la evolución del software, justificación de las decisiones de arquitectura y base de conocimiento para el equipo de mantenimiento futuro.

---

## 2. LÍNEA DE TIEMPO DEL PROYECTO

### FASE 1: Análisis y Factibilidad (Septiembre 2025)

| Fecha | Evento / Hito | Descripción | Responsable |
| :--- | :--- | :--- | :--- |
| **01/09/2025** | **Inicio del Proyecto** | Reunión estratégica con Coordinación Ambulatoria. Se plantea el problema de alto ausentismo y falta de canal oficial de WhatsApp. | Dirección TIC / I+D |
| **05/09/2025** | Definición de Scope | Se limita el alcance inicial a: Envío de recordatorios (Unidireccional) y Chat de Soporte (Bidireccional). | Líder I+D |
| **10/09/2025** | Selección de Proveedor API | Evaluación de proveedores (Twilio vs MessageBird vs Meta Cloud API). Se elige **Meta Cloud API** por costos (mensajes de servicio más económicos) y control directo. | Arq. Software |
| **20/09/2025** | Aprobación de Cuenta | Verificación del negocio (HUV) en Meta Business Manager. Obtención de `WhatsApp Business Account ID`. | Admin TIC |

### FASE 2: Desarrollo del Core y Conectividad (Octubre 2025)

| Fecha | Evento / Hito | Descripción | Responsable |
| :--- | :--- | :--- | :--- |
| **01/10/2025** | **Setup del Repositorio** | Inicialización con **Laravel 12** y **React 19**. Configuración de Docker y CI/CD básico. | DevOps |
| **10/10/2025** | Integración Webhook | Desarrollo del endpoint `POST /webhook` para recibir eventos de Meta. Reto superado: Validación de firma SHA256 y manejo de reintentos. | Backend Dev |
| **25/10/2025** | Motor de Mensajería | Creación de modelos `Conversation` y `Message`. Lógica para asociar mensajes entrantes a hilos existentes o crear nuevos. | Backend Dev |
| **30/10/2025** | Implementación Real-Time | Integración de **Laravel Reverb** (WebSockets) para que los mensajes aparezcan instantáneamente en la pantalla del asesor sin recargar. | Fullstack Dev |

### FASE 3: Módulos Avanzados e IA (Noviembre - Diciembre 2025)

| Fecha | Evento / Hito | Descripción | Responsable |
| :--- | :--- | :--- | :--- |
| **10/11/2025** | Módulo de "Tandas" | Desarrollo del importador de Excel para citas masivas (`Maatwebsite/Excel`). Implementación de Job Queue para respetar límites de tasa de la API (80 msg/seg). | Backend Dev |
| **01/12/2025** | Integración IA (Groq) | Implementación de transcripción de audios (Whisper on Groq). Solución crítica para asesores que no pueden escuchar audios en oficina. | AI Engineer |
| **15/12/2025** | Gestión de Plantillas | Creación de interfaz para sincronizar plantillas (HSM) aprobadas desde Meta hacia el panel administrativo local. | Frontend Dev |
| **20/12/2025** | Seguridad | Implementación de autenticación de dos factores (2FA) y roles/permisos (`Spatie/Permission`) para separar Admins de Asesores. | Security Ops |

### FASE 4: Estabilización y Despliegue (Enero 2026)

| Fecha | Evento / Hito | Descripción | Responsable |
| :--- | :--- | :--- | :--- |
| **10/01/2026** | **Pruebas de Carga** | Simulación de envío de 5.000 recordatorios simultáneos. Optimización de Workers de Redis para evitar cuellos de botella. | QA Team |
| **15/01/2026** | Capacitación Piloto | Entrenamiento con grupo selecto de 5 secretarias. Feedback: "La letra es muy pequeña". Ajuste de UI en Tailwind. | Líder I+D |
| **25/01/2026** | Hardening de Servidor | Configuración final de firewall, SSL y rotación de logs en servidor de producción Windows Server. | SysAdmin |
| **30/01/2026** | Migración Definitiva | Pase a producción. Inicio de operación real con línea oficial del hospital. | Todos |

### FASE 5: Entrega Final (Febrero 2026)

| Fecha | Evento / Hito | Descripción | Responsable |
| :--- | :--- | :--- | :--- |
| **06/02/2026** | **Entrega Oficial** | Generación de documentación final y entrega de credenciales maestras. Cierre del proyecto de desarrollo. | Gerente I+D |

---

## 3. REGISTRO DE DECISIONES TÉCNICAS (ADRs)

### ADR-001: Uso de "Meta Cloud API" Directa
*   **Contexto:** Existen intermediarios (BSPs) como Twilio que simplifican la API pero cobran comisión por mensaje.
*   **Decisión:** Conectar directamente a la Graph API de Meta.
*   **Consecuencias:** Desarrollo inicial más complejo (manejo de tokens, renovaciones), pero ahorro operativo del 30-40% mensual recurrente.

### ADR-002: Laravel Reverb para WebSockets
*   **Contexto:** Se necesitaba comunicación en tiempo real. Pusher es caro y Socket.io requiere un servidor Node.js separado difícil de mantener en Windows.
*   **Decisión:** Usar Laravel Reverb (Nativo en Laravel 11/12).
*   **Consecuencias:** Simplificación de la infraestructura. El mismo PHP maneja todo. Requiere PHP 8.2+.

### ADR-003: Transcripción de Audio con Groq
*   **Contexto:** Los pacientes envían muchos audios. OpenAI Whisper API es bueno pero tiene costo y latencia.
*   **Decisión:** Usar Groq Cloud (Modelos Whisper/Llama) por su velocidad extrema.
*   **Consecuencias:** Transcripciones casi instantáneas (<1s). Dependencia de un proveedor externo de IA.

### ADR-004: Inserción de "Tandas" vía Excel
*   **Contexto:** No hay integración directa (API) con el HIS (Sistema Hospitalario) legacy del hospital por restricciones de seguridad.
*   **Decisión:** Interfaz de "Carga Plana" (Excel).
*   **Consecuencias:** Proceso semi-manual diario para las secretarias, pero elimina riesgos de seguridad de exponer la base de datos principal del hospital.

---

## 4. CONTROL DE CAMBIOS (VERSIONAMIENTO)

### Versión 1.0.0 (06/02/2026)
*   **Lanzamiento de Producción (RTM).**
*   Soporte completo para mensajes de Texto, Imagen, Documento y Audio.
*   Dashboard de estadísticas de atención.
*   Sistema de roles (Admin, Asesor).

### Versión 0.9.0-rc (20/01/2026)
*   *Feat:* Transcripción automática de notas de voz.
*   *Fix:* Corrección de error donde los mensajes salientes se duplicaban en la vista si el internet era inestable.

### Versión 0.8.0-beta (15/12/2025)
*   *Feat:* Módulo de envío masivo (Tandas) operativo.
*   *Feat:* Gestión de Plantillas HSM.

---

**ÁREA DE INNOVACIÓN Y DESARROLLO**
**HOSPITAL UNIVERSITARIO DEL VALLE**
