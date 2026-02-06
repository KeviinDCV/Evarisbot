# INNOVACIÓN Y DESARROLLO - HOSPITAL UNIVERSITARIO DEL VALLE
# EVARISBOT

# ACTA DE ENTREGA DE SOFTWARE

**FECHA:** 6 de Febrero de 2026
**PROYECTO:** EVARISBOT - Sistema de Gestión de WhatsApp Business y Recordatorios
**LUGAR:** Cali, Valle del Cauca - Hospital Universitario del Valle
**ENTREGA:** Área de Innovación y Desarrollo

---

## 1. OBJETO

El presente documento formaliza la entrega técnica y funcional del software denominado **"EVARISBOT"**, desarrollado por el área de Innovación y Desarrollo interna del Hospital Universitario del Valle (HUV), para su puesta en producción y operación por parte de las áreas asistenciales y administrativas correspondientes.

---

## 2. DESCRIPCIÓN DEL PRODUCTO ENTREGADO

**Evarisbot** es una plataforma web integral para la gestión de mensajería instantánea institucional.

**Versión Entregada:** 1.0.0 (Producción)
**Licenciamiento:** Software Propio (Propiedad Intelectual del HUV).

### Módulos Incluidos:
1.  **Módulo de Chat Multicente:** Atención centralizada de múltiples líneas de WhatsApp.
2.  **Módulo de Recordatorios Automáticos (Tandas):** Envío masivo de notificaciones de citas basado en carga de archivos planos/Excel.
3.  **Módulo de Administración:** Gestión de usuarios, roles, permisos y plantillas HSM.
4.  **Módulo de Estadísticas:** Dashboards de rendimiento y exportación de datos.
5.  **Integración IA:** Transcripción de audios y asistencia de respuesta.

---

## 3. ENTREGABLES TÉCNICOS

Se hace entrega de los siguientes componentes digitales y documentales alojados en los repositorios y servidores institucionales:

### 3.1 Código Fuente
*   Repositorio completo del proyecto (Backend Laravel + Frontend React).
*   Scripts de base de datos (Migraciones SQL).
*   Scripts de automatización y despliegue (.bat, .sh).

### 3.2 Documentación (Carpeta /docs)
1.  `CREDENCIALES_Y_CONFIGURACION.md`: Guía de despliegue y claves.
2.  `DOCUMENTACION_TECNICA.md`: Arquitectura, diccionario de datos y diagramas.
3.  `MANUAL_DE_USUARIO.md`: Guía para asesores y coordinadores.
4.  `MATERIAL_ENTRENAMIENTO.md`: Guiones de capacitación.
5.  `REGISTRO_HISTORICO_INTERACCIONES.md`: Políticas de auditoría.

### 3.3 Credenciales
Las credenciales de acceso de "Super Administrador" han sido configuradas y entregadas al líder del área responsable. Se recomienda su cambio inmediato.

---

## 4. ESTADO DE PRUEBAS

El software ha sido sometido a las siguientes pruebas con resultado SATISFACTORIO:

*   [x] **Pruebas de Conectividad:** Integración exitosa con WhatsApp Cloud API (Envío/Recepción).
*   [x] **Pruebas de Carga:** Envío de lotes de 500+ recordatorios sin bloqueos.
*   [x] **Pruebas de Seguridad:** Validación de Login, Roles, Protección CSRF y datos encriptados.
*   [x] **Pruebas de WebSockets:** Chat en tiempo real funcional.

---

## 5. GARANTÍA Y SOPORTE

El área de **Innovación y Desarrollo** del HUV, como creadora del software, garantizará el soporte técnico de nivel 3 (Corrección de bugs, mantenimiento de servidores, actualizaciones de API de Meta) de manera indefinida mientras el software sea el oficial de la institución.

**Exclusiones:**
*   El soporte no incluye la operación diaria (responder chats) ni la limpieza de bases de datos por mal uso del usuario final.
*   Costos asociados a la API de WhatsApp (Meta) o servicios de IA (Groq) son costos operativos asumidos por la institución, no por el desarrollo.

---

---

**ÁREA DE INNOVACIÓN Y DESARROLLO**
**HOSPITAL UNIVERSITARIO DEL VALLE**
