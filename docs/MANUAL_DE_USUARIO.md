# INNOVACIÓN Y DESARROLLO - HOSPITAL UNIVERSITARIO DEL VALLE
# EVARISBOT

# MANUAL DE USUARIO

## 1. INTRODUCCIÓN Y ACCESO

Bienvenido al sistema **Evarisbot**, la plataforma oficial de gestión de comunicaciones por WhatsApp del Hospital Universitario del Valle. Esta herramienta le permitirá gestionar citas, recordatorios y consultas de pacientes de manera eficiente y centralizada.

### 1.1 Ingreso al Sistema
1.  Abra su navegador web (Google Chrome o Microsoft Edge recomendado).
2.  Ingrese a la dirección: `https://evarisbot.huv.gov.co` (o la IP interna asignada).
3.  Verá la pantalla de inicio de sesión.
4.  Ingrese su **Correo Electrónico Institucional** y **Contraseña**.
5.  Si tiene activada la autenticación en dos pasos (2FA), ingrese el código de su aplicación autenticadora.

### 1.2 Recuperación de Contraseña
Si olvidó su contraseña, haga clic en "¿Olvidaste tu contraseña?" y siga las instrucciones enviadas a su correo institucional.

---

## 2. INTERFAZ PRINCIPAL (CHAT)

Al ingresar, será dirigido automáticamente al **Panel de Chat**. Esta interfaz está diseñada para ser familiar, similar a WhatsApp Web.

### 2.1 Zonas de la Pantalla
*   **Barra Lateral Izquierda (Lista de Chats):** Muestra todas las conversaciones activas. Los chats con mensajes no leídos aparecerán resaltados y con un círculo verde indicando la cantidad.
    *   *Filtros:* Puede filtrar por "Mis Chats", "Sin Asignar" o "Todos".
    *   *Buscador:* Use la lupa para buscar pacientes por nombre o número de teléfono.
*   **Panel Central (Conversación):** Muestra el historial de mensajes con el paciente seleccionado.
*   **Panel Derecho (Información del Paciente):** Muestra datos del paciente, historial de citas y opciones de gestión.

### 2.2 Gestión de Conversaciones
*   **Responder un mensaje:** Escriba en la caja de texto inferior y presione Enter o el botón de enviar.
*   **Enviar Archivos:** Haga clic en el icono de "Clip" (+) para adjuntar imágenes o documentos PDF.
*   **Usar Plantillas:** Para respuestas rápidas o saludos formales, haga clic en el icono de "Plantilla" y seleccione una opción predefinida.
*   **Mensajes de Audio:** Puede escuchar los audios enviados por los pacientes directamente en el navegador. El sistema intentará transcribir automáticamente el audio a texto para facilitar la lectura.

### 2.3 Asignación de Chats
Los chats pueden estar en estado "Sin Asignar".
*   Para tomar un chat, ábralo y haga clic en el botón **"Asignarme"** en la parte superior.
*   Para transferir un chat a otro compañero, use la opción **"Reasignar"** en el menú de opciones del chat y seleccione el nombre del asesor.

---

## 3. MÓDULO DE CITAS Y RECORDATORIOS (TANDAS)

Este módulo es vital para la reducción del ausentismo. Permite cargar listados de citas para enviar recordatorios automáticos.

### 3.1 Carga de Archivos (Excel)
1.  Diríjase al menú lateral y seleccione **"Citas"** o **"Recordatorios"**.
2.  Haga clic en **"Importar Citas"**.
3.  Descargue la **Plantilla de Excel** si no la tiene. Es crucial no modificar los encabezados de las columnas.
4.  Llene la información: `Paciente`, `Telefono`, `Fecha`, `Hora`, `Doctor`, `Especialidad`.
5.  Suba el archivo completado.

### 3.2 Procesamiento de Tandas
Una vez cargado el archivo:
1.  El sistema validará los números de teléfono.
2.  Verá un resumen de la carga (Total registros, Válidos, Errores).
3.  Haga clic en **"Iniciar Envío"** para comenzar la "Tanda".
4.  El sistema enviará los mensajes uno a uno para evitar bloqueos por spam. Puede monitorear el progreso en la barra de porcentaje.

### 3.3 Gestión de Respuestas
*   Los pacientes recibirán un mensaje con botones: `CONFIRMAR` y `CANCELAR` (si la plantilla lo permite) o se les pedirá responder con texto.
*   En la vista de "Citas", podrá ver en tiempo real el estado:
    *   🟢 **Confirmada:** El paciente asistirá.
    *   🔴 **Cancelada:** El paciente notificó que no irá (Libera el cupo).
    *   🟡 **Pendiente:** Mensaje enviado pero sin respuesta.
    *   ⚪ **Sin Enviar:** En cola de espera.

---

## 4. REPORTES Y ESTADÍSTICAS

Para los supervisores y coordinadores, el módulo de estadísticas ofrece visión del rendimiento.

1.  Vaya a **"Estadísticas"**.
2.  Seleccione el rango de fechas (Hoy, Esta Semana, Este Mes, Personalizado).
3.  **Métricas Disponibles:**
    *   Total de Mensajes Enviados/Recibidos.
    *   Tiempos de Respuesta Promedio.
    *   Porcentaje de Confirmación de Citas.
    *   Volumen de atención por Asesor.
4.  **Exportar:** Use el botón "Exportar a Excel" para descargar la data cruda y realizar análisis externos.

---

## 5. SOLUCIÓN DE PROBLEMAS COMUNES

### 5.1 "No recibo mensajes nuevos"
*   Verifique su conexión a internet.
*   Asegúrese de que el indicador de "Estado del Sistema" (esquina superior derecha) esté en verde (Conectado). Si está rojo, recargue la página.

### 5.2 "Error al enviar archivo"
*   Verifique que el archivo pese menos de 10MB.
*   Formatos permitidos: JPG, PNG, PDF. Word y Excel no son enviados directamente por WhatsApp Business API por defecto.

### 5.3 "El paciente dice que no le llegó el mensaje"
*   Verifique el número de teléfono en el perfil del paciente.
*   Si han pasado más de 24 horas desde el último mensaje del paciente, WhatsApp cierra la "Ventana de Conversación". En este caso, **solo puede enviar Plantillas**. Intente enviar una plantilla para reactivar la charla.

### 5.4 Soporte Técnico
Si el problema persiste, contacte al área de **Innovación y Desarrollo** del HUV reportando el error y capturas de pantalla si es posible.

---

**ÁREA DE INNOVACIÓN Y DESARROLLO**
**HOSPITAL UNIVERSITARIO DEL VALLE**
