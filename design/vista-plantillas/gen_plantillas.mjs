// Plantillas (/admin/templates) rediseñada dentro de la carcasa "Marco navy", en el mismo lenguaje que
// Usuarios, Configuración, Estadísticas, Citas y Envío masivo.
//
// OJO: aquí son las plantillas de RESPUESTA RÁPIDA de la app (las que el equipo inserta en el chat
// escribiendo «/»), no las de Meta de Envío masivo. Institucionales (las ve todo el equipo, las gestiona
// un administrador), asignadas a algunas personas, y personales (las crea cada asesor desde el chat con
// «Guardar como plantilla personal»). En la misma pantalla vive el menú de bienvenida del bot.
//
// Idea: una lista a la izquierda y, a la derecha, la plantilla elegida tal como queda en el chat, con
// quién la ve, cuánto se usa y lo que se puede hacer con ella. Debajo, en la misma página, el menú de
// bienvenida dibujado paso a paso como lo vive el paciente.
//
// Escribe:
//   Main.dc.html       1440x900: la lista vista por un administrador (menú fijado, isla 1190x880).
//   Asesor.dc.html     1440x900: lo que ve un asesor (las suyas + las del hospital).
//   Completa.dc.html   1190 x alto: la página entera de administrador, con el menú de bienvenida.
//   Dialogos.dc.html   1190 x alto: editar plantilla, eliminar, confirmar envío, flujo de bienvenida.
//   Enviar.dc.html     1440x900: enviar una plantilla a varios contactos (send).
//
// TODO es de EJEMPLO e inventado: plantillas, textos, archivos, contactos, teléfonos y cifras.
// Forma real de las props de TemplateController@index / @sendForm y WelcomeFlowSection. "Hoy" = 13 sept 2026.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { T, icono, documento, NAV, VISOR, NO_LEIDOS, iniciales } from '../usuarios/_comun.mjs';
import { carcasaMarco, ISLA, RADIO_ISLA } from '../usuarios/_marco.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));

// ══ Paleta (la de Estadísticas, Citas y Envío masivo) ══════════════════════════════════════════════
// Marcas contra blanco (mín. 3:1): esmeralda 600 3,77 · rojo 600 4,83 · ámbar 600 3,19 · cielo 600 4,10.
// Texto con color (mín. 4,5:1): esmeralda 700 5,48 · ámbar 700 5,02 · rojo 700 6,47 · cielo 700 5,93 ·
// pizarra 600 7,58. Botón de WhatsApp #0271a6 sobre blanco 5,3:1. Hora #54656f sobre #d9fdd3 5,2:1.
const GRAF = { ok: '#059669', aviso: '#d97706', mal: '#dc2626', curso: '#0284c7', neutro: '#94a3b8' };
const TXT = { ok: '#047857', aviso: '#b45309', mal: '#b91c1c', curso: '#0369a1', neutro: '#475569' };
const FONDO = { ok: '#ecfdf5', okBorde: '#a7f3d0', mal: '#fef2f2', malBorde: '#fecaca', aviso: '#fffbeb', avisoBorde: '#fde68a', curso: '#f0f9ff', cursoBorde: '#bae6fd' };
const WA = { fondo: '#efeae2', sale: '#d9fdd3', texto: '#111b21', hora: '#54656f', boton: '#0271a6' };

const miles = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// ══ Datos de EJEMPLO ══════════════════════════════════════════════════════════════════════════════
// Forma de TemplateController@index: name, subject, content, is_active, message_type, is_global,
// assigned_users, media_files, created_by, updated_by, updated_at, usage_stats.total_sends (= usos en
// el chat: usage_count sube cada vez que alguien la inserta con «/»).
const P = (n, tipo, usos, c, extra = {}) => ({ n, tipo, usos, c, act: true, scope: 'global', files: [], by: 'Sofía Quintero Ramos', upd: '02 sept 2026', updBy: 'Hernán Ocampo Díaz', ...extra });
const GLOBALES = [
  P('AGENDAR CITA', 'text', 2590, 'Para agendar su cita necesitamos: nombre completo del paciente, número de documento, EPS y especialidad. Por favor envíelos en un solo mensaje.'),
  P('SALUDO INICIAL', 'text', 1874, 'Buen día. Gracias por comunicarse con el Hospital Universitario del Valle. ¿En qué le podemos ayudar?'),
  P('DESPEDIDA', 'text', 1420, 'Ha sido un gusto atenderle. Si necesita algo más, escríbanos por este mismo medio. Que tenga un buen día.'),
  P('HORARIO DE ATENCIÓN', 'text', 1102, 'Nuestro horario de atención por WhatsApp es de lunes a viernes, de 7:00 a. m. a 5:00 p. m. Los mensajes que lleguen fuera de ese horario se responden el siguiente día hábil.'),
  P('DOCUMENTOS PARA CIRUGÍA', 'document', 846, 'Le compartimos los requisitos para su cirugía programada. Preséntelos impresos el día de la admisión.', { files: [{ f: 'requisitos_cirugia_programada.pdf', tipo: 'document' }] }),
  P('UBICACIÓN CONSULTA EXTERNA', 'image', 731, 'La consulta externa queda en el primer piso del edificio principal, con entrada por la Calle 5. Le compartimos el mapa para que llegue sin contratiempos. Recuerde llegar 30 minutos antes de su cita.', { files: [{ f: 'mapa_consulta_externa.png', tipo: 'image' }], upd: '28 ago 2026' }),
  P('RESULTADOS DE LABORATORIO', 'text', 688, 'Los resultados de laboratorio se consultan en el portal del paciente con el número de documento. Si no aparecen después de 3 días hábiles, escríbanos.'),
  P('CANCELAR CITA', 'text', 512, 'Para cancelar su cita envíenos el nombre del paciente, el número de documento y la fecha de la cita. Le confirmaremos por este medio.'),
  P('AUTORIZACIÓN EPS', 'text', 455, 'Recuerde que la autorización de su EPS debe estar vigente el día de la cita. Si aún no la tiene, solicítela en su EPS con la orden médica.'),
  P('REPROGRAMAR CITA', 'text', 402, 'Con gusto le ayudamos a reprogramar. Indíquenos la especialidad y la fecha que tenía asignada, y le ofrecemos las fechas disponibles.'),
  P('PREPARACIÓN COLONOSCOPIA', 'document', 301, 'Adjuntamos la preparación para su colonoscopia y la dieta de los dos días anteriores. Léala con tiempo.', { files: [{ f: 'preparacion_colonoscopia.pdf', tipo: 'document' }, { f: 'dieta_previa_colonoscopia.pdf', tipo: 'document' }] }),
  P('REQUISITOS HISTORIA CLÍNICA', 'document', 266, 'Para solicitar copia de la historia clínica diligencie el formato adjunto y envíelo con la copia del documento del paciente.', { files: [{ f: 'formato_solicitud_historia.docx', tipo: 'document' }] }),
  P('TELÉFONOS DE CONTACTO', 'text', 244, 'Conmutador: (602) 555 0100. Citas: (602) 555 0123. Estos números son de ejemplo para la muestra.'),
  P('ESPERA DE ASESOR', 'text', 231, 'En este momento todos los asesores están ocupados. Su mensaje quedó registrado y le responderemos en orden de llegada.'),
  P('SEDES Y DIRECCIONES', 'image', 198, 'Estas son nuestras sedes y sus direcciones. Verifique en su orden a cuál debe dirigirse.', { files: [{ f: 'sedes_huv.jpg', tipo: 'image' }] }),
  P('URGENCIAS 24 HORAS', 'text', 175, 'El servicio de urgencias atiende las 24 horas por la entrada de la Calle 5. Si es una emergencia, no espere respuesta por este medio.'),
  P('CITA PRIORITARIA GESTANTES', 'text', 150, 'Las gestantes tienen asignación prioritaria. Envíenos la orden del control prenatal y la semana de gestación.'),
  P('ENTREGA DE MEDICAMENTOS', 'text', 133, 'La entrega de medicamentos se hace en la farmacia del primer piso, de lunes a sábado. Traiga la fórmula y el documento del paciente.'),
  P('VIDEO LAVADO DE MANOS', 'video', 97, 'Le compartimos cómo lavarse las manos correctamente antes de visitar a un paciente hospitalizado.', { act: false, files: [{ f: 'lavado_de_manos.mp4', tipo: 'video' }] }),
  P('ENCUESTA DE SATISFACCIÓN', 'text', 88, 'Su opinión nos ayuda a mejorar. Al terminar la conversación recibirá una breve encuesta de satisfacción.'),
  P('FUERA DE HORARIO', 'text', 64, 'Gracias por escribirnos. Estamos fuera del horario de atención; le responderemos el siguiente día hábil desde las 7:00 a. m.', { act: false }),
  P('PARQUEADERO VISITANTES', 'image', 41, 'El parqueadero de visitantes está sobre la Carrera 36. Tarifa y horarios en la imagen.', { files: [{ f: 'parqueadero_visitantes.png', tipo: 'image' }] }),
  P('COPAGOS Y CUOTAS MODERADORAS', 'text', 37, 'El valor del copago o de la cuota moderadora depende de su EPS y de su nivel. Consúltelo en su EPS antes de la cita.'),
  P('JORNADA DE VACUNACIÓN', 'image', 12, 'Este sábado habrá jornada de vacunación en el primer piso. Traiga el carné de vacunas.', { act: false, files: [{ f: 'jornada_vacunacion.png', tipo: 'image' }] }),
];
const ASIGNADAS = [
  P('CONFIRMACIÓN CIRUGÍA PEDIÁTRICA', 'text', 140, 'Le confirmamos la cirugía del menor. El acompañante debe presentarse con el documento del niño y el carné de vacunas.', { scope: 'asig', pers: ['Paola Andrea Viveros Solarte', 'Valentina Ospina Toro', 'Camila Andrea Rincón Pérez'] }),
  P('PROTOCOLO QUEJAS Y RECLAMOS', 'text', 26, 'Lamentamos lo ocurrido. Para radicar su queja envíenos nombre, documento, fecha y una descripción breve. Tendrá respuesta en máximo 15 días hábiles.', { scope: 'asig', pers: ['María Fernanda Loaiza Cruz', 'Juan Pablo Restrepo Vélez'] }),
  P('mi cierre de turno', 'text', 19, 'Termino mi turno; su conversación queda asignada a un compañero que le seguirá atendiendo. Gracias por su paciencia.', { scope: 'propia', by: 'Sofía Quintero Ramos', updBy: '', upd: '11 sept 2026' }),
];
const TODAS = [...GLOBALES, ...ASIGNADAS];
const MIAS_ASESOR = [
  P('espera un momento', 'text', 386, 'Un momento por favor, estoy revisando la agenda de la especialidad. Ya le confirmo.', { scope: 'propia', by: 'Andrea Carolina Muñoz Paz', updBy: '', upd: '20 jul 2026' }),
  P('pedir foto de orden médica', 'text', 214, 'Por favor envíenos una foto clara de la orden médica completa, donde se lea el nombre del paciente, la especialidad y la firma del médico.', { scope: 'propia', by: 'Andrea Carolina Muñoz Paz', updBy: '', upd: '14 ago 2026' }),
  P('sin agenda ortopedia', 'text', 57, 'En este momento no hay agenda disponible en ortopedia. Le recomendamos escribirnos de nuevo el lunes desde las 7:00 a. m., cuando se abre la agenda del mes.', { scope: 'propia', by: 'Andrea Carolina Muñoz Paz', updBy: '', upd: '09 sept 2026' }),
];
const conAdjunto = (l) => l.filter((p) => p.files.length).length;
const activas = (l) => l.filter((p) => p.act).length;

// Menú de bienvenida (WelcomeFlow + WelcomeFlowStep). El bot usa los PASOS si el flujo los tiene.
const PASOS = [
  { k: 'inicio', tipo: 'interactive_buttons', entrada: true, msg: 'Hola, bienvenido a la línea de WhatsApp del Hospital Universitario del Valle. ¿En qué le podemos ayudar?', ops: [['Citas médicas', 'citas'], ['Resultados', 'resultados'], ['Otra consulta', 'otra_consulta']] },
  { k: 'citas', tipo: 'interactive_list', msg: 'Para ayudarle con su cita, seleccione su EPS en la lista.', ops: [['Emssanar', 'documento'], ['Asmet Salud', 'documento'], ['Nueva EPS', 'documento'], ['Coosalud', 'documento'], ['Otra EPS', 'documento']] },
  { k: 'documento', tipo: 'wait_response', msg: 'Escriba el número de documento del paciente, sin puntos ni espacios.', sig: 'fin_citas' },
  { k: 'fin_citas', tipo: 'text', msg: 'Gracias. Un asesor revisará su solicitud y le escribirá por este medio de lunes a viernes, de 7:00 a. m. a 5:00 p. m.' },
  { k: 'resultados', tipo: 'text', msg: 'Los resultados de laboratorio se consultan en el portal del paciente con el número de documento. Si necesita ayuda, escriba su pregunta.' },
  { k: 'otra_consulta', tipo: 'wait_response', msg: 'Cuéntenos brevemente su consulta y un asesor le atenderá en un momento.', sig: '__complete__' },
];
const FLUJOS = [
  { n: 'Menú principal HUV', act: true, trig: 'Solo primer contacto', pasos: PASOS.length, by: 'Sofía Quintero Ramos', upd: '05 sept 2026' },
  { n: 'Aviso de días festivos', act: false, trig: 'Siempre', botones: 2, by: 'Hernán Ocampo Díaz', upd: '30 jun 2026' },
];
const TIPO_PASO = { interactive_buttons: ['mouse-pointer-click', 'Botones'], interactive_list: ['list', 'Lista'], wait_response: ['keyboard', 'Espera texto'], text: ['message-square', 'Texto'] };

// Contactos para Enviar (TemplateSendService::getAvailableRecipients: conversaciones con número,
// de la más reciente a la más antigua: contact_name, phone_number, last_message_at, unread_count).
const CONTACTOS = [
  ['LUZ MARINA CUERO VIDAL', '57 315 772 0418', 'hace 4 minutos', 2, true],
  ['ROSA AMELIA MINA SOLÍS', '57 300 418 9036', 'hace 12 minutos', 0, true],
  ['JHON FREDY PERLAZA MOSQUERA', '57 316 204 5571', 'hace 25 minutos', 1, true],
  ['GLORIA INÉS VALENCIA ARBOLEDA', '57 312 880 1943', 'hace 1 hora', 0, false],
  ['KAREN VIVIANA LOZANO BENÍTEZ', '57 318 066 7720', 'hace 2 horas', 0, true],
  ['Sin nombre', '57 320 511 3084', 'hace 3 horas', 0, false],
  ['CARLOS ANDRÉS TRUJILLO ZÚÑIGA', '57 301 947 2265', 'hace 5 horas', 0, true],
  ['OLGA LUCÍA SINISTERRA CASTILLO', '57 313 729 4410', 'hace 9 horas', 0, false],
  ['YOLANDA PALACIOS QUIÑÓNEZ', '57 304 385 6192', 'ayer', 0, false],
  ['DIANA CAROLINA LONDOÑO RENGIFO', '57 317 612 0057', 'ayer', 0, true],
  ['MARTHA CECILIA OBANDO SOLÍS', '57 310 244 8871', 'hace 2 días', 0, false],
];
const TOTAL_CONTACTOS = 1842;
const ELEGIDOS = 12;

// ══ Tintas y geometría ════════════════════════════════════════════════════════════════════════════
const navyA = (a) => `rgba(46,63,132,${a})`;
const C = { hoja: '#ffffff', filete: navyA(0.08), fileteFondo: navyA(0.12), banda: navyA(0.028), campo: navyA(0.035), borde: navyA(0.58), panel: '#f7f8fb', sel: navyA(0.06) };
const MONO = "font-family: ui-monospace, 'Cascadia Mono', 'SF Mono', Consolas, monospace;";
const truncar = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
const num = 'font-variant-numeric: tabular-nums;';
const PAD = 28, PH = 20, RANURA = 32, X_TXT = PH + RANURA + 12; // 64
const GAP = 24;
const ANCHO_DET = 452;
const H = { cab: 58, franja: 76, banda: 64, thead: 34, grupo: 32, fila: 56 };
const sombraHoja = `0 0 0 1px ${navyA(0.07)}, 0 1px 2px ${navyA(0.05)}, 0 14px 32px -18px ${navyA(0.22)}`;
const sombraDialogo = `0 0 0 1px ${navyA(0.1)}, 0 6px 14px ${navyA(0.1)}, 0 30px 60px -20px ${navyA(0.55)}`;

// ══ Piezas (las de Envío masivo) ══════════════════════════════════════════════════════════════════
const t = (px, lh, peso, color, extra = '') => `font-size: ${px}px; line-height: ${lh}px; font-weight: ${peso}; color: ${color}; ${extra}`;
const punto = (color, d = 8, r = 9999) => `<span style="width: ${d}px; height: ${d}px; flex-shrink: 0; border-radius: ${r}px; background: ${color};"></span>`;
const divisor = (color = C.fileteFondo) => `<div style="width: 1px; align-self: stretch; background: ${color};"></div>`;
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
const nombrePropio = (n) => n.toLocaleLowerCase('es').split(' ').filter(Boolean)
  .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toLocaleUpperCase('es') + p.slice(1))).join(' ');
const ico = (nombre, color, s = 14, sw = 2) => `<span style="display: flex; color: ${color};">${icono(nombre, s, sw)}</span>`;
const tit = (x) => (x ? ` title="${x}"` : '');

const rotulo = (titulo, apoyo = '') => `
              <div style="height: 16px; display: flex; align-items: baseline; gap: 10px;">
                <span style="${t(11, 16, 600, T.muted, 'text-transform: uppercase; letter-spacing: .07em; white-space: nowrap;')}">${titulo}</span>${apoyo ? `
                <span style="${t(12, 16, 400, T.muted, truncar + num)}">${apoyo}</span>` : ''}
              </div>`;

const btnBase = 'height: 36px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 16px 0 14px; border-radius: 10px; font-size: 13px; line-height: 18px; font-weight: 600; white-space: nowrap;';
const botonPrimario = (i, texto, titulo = '', extra = '') =>
  `<div${tit(titulo)} style="${btnBase} background: ${T.btnPrimary}; box-shadow: 0 1px 2px ${navyA(0.3)}, 0 6px 16px -6px ${navyA(0.55)}, inset 0 1px 0 rgba(255,255,255,.14); color: #ffffff; ${extra}">${icono(i, 15, 2)}${texto}</div>`;
const botonSecundario = (i, texto, titulo = '', extra = '') =>
  `<div${tit(titulo)} style="${btnBase} background: #ffffff; box-shadow: inset 0 0 0 1px ${navyA(0.2)}, 0 1px 2px ${navyA(0.08)}; color: ${T.navy}; ${extra}">${icono(i, 15, 1.9)}${texto}</div>`;
const botonPeligro = (i, texto, titulo = '', extra = '') =>
  `<div${tit(titulo)} style="${btnBase} background: #ffffff; box-shadow: inset 0 0 0 1px rgba(220,38,38,.55), 0 1px 2px rgba(220,38,38,.12); color: ${TXT.mal}; ${extra}">${icono(i, 15, 2)}${texto}</div>`;
const botonPeligroLleno = (i, texto) =>
  `<div style="${btnBase} background: ${GRAF.mal}; box-shadow: 0 1px 2px rgba(185,28,28,.35), 0 6px 16px -6px rgba(220,38,38,.55), inset 0 1px 0 rgba(255,255,255,.14); color: #ffffff;">${icono(i, 15, 2)}${texto}</div>`;
const botonTexto = (i, texto, color = T.navy, titulo = '') =>
  `<span${tit(titulo)} style="height: 30px; display: inline-flex; align-items: center; gap: 6px; padding: 0 8px; border-radius: 8px; ${t(12.5, 16, 600, color, 'white-space: nowrap;')}">${icono(i, 14, 2)}${texto}</span>`;
const botonIcono = (i, color, titulo, s = 30) =>
  `<div title="${titulo}" style="width: ${s}px; height: ${s}px; flex-shrink: 0; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: ${color};">${icono(i, 16, 2)}</div>`;

const opcion = ([, texto, n], activa) => {
  const cuenta = n !== undefined ? `<span style="${t(12, 16, 600, T.muted, num)}">${miles(n)}</span>` : '';
  return activa
    ? `<div style="height: 30px; display: flex; align-items: center; gap: 7px; padding: 0 11px; border-radius: 8px; background: #ffffff; box-shadow: 0 0 0 1px ${navyA(0.08)}, 0 1px 2px ${navyA(0.12)}, 0 2px 6px -2px ${navyA(0.12)}; ${t(13, 16, 600, T.navy, 'white-space: nowrap;')}">${texto}${cuenta}</div>`
    : `<div style="height: 30px; display: flex; align-items: center; gap: 7px; padding: 0 11px; border-radius: 8px; ${t(13, 16, 600, T.muted, 'white-space: nowrap;')}">${texto}${cuenta}</div>`;
};
const segmentado = (opciones, activa, etiqueta = '') =>
  `<div${tit(etiqueta)} style="display: flex; align-items: center; gap: 2px; padding: 3px; border-radius: 11px; background: ${navyA(0.055)}; flex-shrink: 0;">${opciones.map((o) => opcion(o, o[0] === activa)).join('')}</div>`;

const buscador = (texto, ancho) => `
              <div style="position: relative; ${typeof ancho === 'number' ? `width: ${ancho}px; flex-shrink: 0;` : 'flex: 1; min-width: 0;'}">
                <span style="position: absolute; left: 12px; top: 10px; color: ${T.muted};">${icono('search', 16, 1.75)}</span>
                <div style="height: 36px; border-radius: 10px; padding: 0 12px 0 38px; background: ${C.campo}; box-shadow: inset 0 0 0 1px ${navyA(0.1)}; ${t(13, 18, 400, T.muted, truncar)} display: flex; align-items: center;">${texto}</div>
              </div>`;

const campo = ({ i = '', valor = '', ejemplo = '', mono = false, ancho = '100%', select = false, alto = 38, foco = false, extra = '' }) => `
                <div style="width: ${typeof ancho === 'number' ? ancho + 'px' : ancho}; min-width: 0; height: ${alto}px; flex-shrink: 0; border-radius: 9px; background: #ffffff; box-shadow: inset 0 0 0 1px ${foco ? T.navy : C.borde}${foco ? `, 0 0 0 3px ${navyA(0.14)}` : ''}; display: flex; align-items: center; gap: 9px; padding: 0 11px; ${extra}">
                  ${i ? ico(i, T.muted, 15, 1.75) : ''}<span style="min-width: 0; flex: 1; ${valor ? `${t(13, 18, 500, T.navy)} ${mono ? MONO + ' font-size: 12.5px;' : ''}` : t(13, 18, 400, T.muted)} ${truncar}">${valor || ejemplo}</span>${select ? ico('chevron-down', T.muted, 16, 2) : ''}
                </div>`;
const etiqueta = (texto, opc = '') => `<span style="${t(12.5, 16, 600, T.navy, 'white-space: nowrap;')}">${texto}${opc ? `<span style="font-weight: 400; color: ${T.muted};"> ${opc}</span>` : ''}</span>`;
const conEtiqueta = (etq, dentro, ayuda = '') => `
                <div style="min-width: 0; display: flex; flex-direction: column; gap: 7px;">${etq}${dentro}${ayuda ? `
                  <span style="${t(12, 16, 400, T.muted)}">${ayuda}</span>` : ''}
                </div>`;
const casilla = (on) => on
  ? `<span style="width: 18px; height: 18px; flex-shrink: 0; border-radius: 5px; background: ${T.navy}; color: #ffffff; display: flex; align-items: center; justify-content: center;">${icono('check', 12, 3)}</span>`
  : `<span style="width: 18px; height: 18px; flex-shrink: 0; border-radius: 5px; background: #ffffff; box-shadow: inset 0 0 0 1.5px ${T.slate500};"></span>`;
const radio = (on) => on
  ? `<span style="width: 18px; height: 18px; flex-shrink: 0; border-radius: 9999px; box-shadow: inset 0 0 0 5px ${T.navy}; background: #ffffff;"></span>`
  : `<span style="width: 18px; height: 18px; flex-shrink: 0; border-radius: 9999px; background: #ffffff; box-shadow: inset 0 0 0 1.5px ${T.slate500};"></span>`;
/** Interruptor: esmeralda = activa; pizarra = inactiva. */
const interruptor = (on) =>
  `<span style="position: relative; display: inline-flex; align-items: center; width: 40px; height: 22px; flex-shrink: 0; border-radius: 9999px; background: ${on ? GRAF.ok : T.slate400};"><span style="display: block; width: 16px; height: 16px; border-radius: 9999px; background: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,.2); transform: translateX(${on ? 21 : 3}px);"></span></span>`;

const aviso = (tipo, titulo, texto, { i = null } = {}) => {
  const c = { aviso: [FONDO.aviso, FONDO.avisoBorde, TXT.aviso, '#92400e', 'triangle-alert'], mal: [FONDO.mal, FONDO.malBorde, TXT.mal, '#991b1b', 'circle-x'], info: [FONDO.curso, FONDO.cursoBorde, TXT.curso, '#075985', 'info'], ok: [FONDO.ok, FONDO.okBorde, TXT.ok, '#065f46', 'circle-check'] }[tipo];
  return `
                <div style="display: flex; align-items: flex-start; gap: 10px; padding: 11px 14px 12px 12px; border-radius: 10px; background: ${c[0]}; box-shadow: inset 0 0 0 1px ${c[1]};">
                  <span style="display: flex; margin-top: 1px; color: ${c[2]};">${icono(i || c[4], 16, 2)}</span>
                  <div style="min-width: 0; display: flex; flex-direction: column; gap: 3px;">
                    ${titulo ? `<span style="${t(13, 18, 600, c[3])}">${titulo}</span>` : ''}
                    <span style="${t(12.5, 18, 400, c[3], num)}">${texto}</span>
                  </div>
                </div>`;
};

// Estados siempre con marca + texto del color de su significado (nunca solo color).
const estadoTpl = (act, tam = 12.5) => act
  ? `<span style="display: inline-flex; align-items: center; gap: 6px; ${t(tam, 16, 600, TXT.ok, 'white-space: nowrap;')}">${punto(GRAF.ok, 7)}Activa</span>`
  : `<span title="No aparece en el «/» del chat" style="display: inline-flex; align-items: center; gap: 6px; ${t(tam, 16, 600, TXT.neutro, 'white-space: nowrap;')}">${punto(GRAF.neutro, 7)}Inactiva</span>`;
const TIPO = { text: ['message-square', 'Texto'], image: ['image', 'Imagen'], video: ['video', 'Video'], document: ['file-text', 'Documento'] };
const alcance = (p, visor = 'admin') => {
  if (p.scope === 'global') return visor === 'admin' ? ['building-2', 'Todo el equipo'] : ['building-2', 'Del hospital'];
  if (p.scope === 'propia') return ['user-round', 'Solo tú'];
  return ['users', `${p.pers.length} personas`];
};

const banda = ({ i, titulo, texto, derecha = '', cuenta = '' }) => `
            <div style="height: ${H.banda}px; flex-shrink: 0; padding: 0 ${PH}px; display: flex; align-items: center; gap: 12px; background: ${C.banda}; border-bottom: 1px solid ${C.filete};">
              <span style="width: ${RANURA}px; flex-shrink: 0; display: flex; justify-content: center; color: ${T.navy};">${icono(i, 18, 1.75)}</span>
              <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 3px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <h2 style="${t(15, 20, 600, T.navy, 'letter-spacing: -.01em; white-space: nowrap;')}">${titulo}</h2>${cuenta ? `<span style="height: 20px; padding: 0 7px; border-radius: 6px; background: ${navyA(0.07)}; display: inline-flex; align-items: center; ${t(12, 16, 600, T.navy, num)}">${cuenta}</span>` : ''}
                </div>
                <p style="${t(12.5, 16, 400, T.muted, truncar + num)}">${texto}</p>
              </div>${derecha ? `
              <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">${derecha}</div>` : ''}
            </div>`;

// ══ Cabecera y franja ═════════════════════════════════════════════════════════════════════════════
const cabecera = ({ sub, derecha = '' }) => `
        <div style="height: ${H.cab}px; flex-shrink: 0; display: flex; align-items: flex-start; justify-content: space-between; gap: 24px;">
          <div style="min-width: 0; display: flex; flex-direction: column; gap: 4px;">
            <h1 style="${t(28, 34, 600, T.navy, 'letter-spacing: -.025em; white-space: nowrap;')}">Plantillas</h1>
            <p style="${t(14, 20, 400, T.muted, 'white-space: nowrap;')}">${sub}</p>
          </div>
          <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0; padding-top: 1px;">${derecha}</div>
        </div>`;
const cifra = ({ marca, etq, valor, detalle }) => `
          <div style="min-width: 0; display: flex; flex-direction: column;">
            <div style="height: 16px; display: flex; align-items: center; gap: 8px;">${marca}<span style="${t(12, 16, 500, T.muted, truncar)}">${etq}</span></div>
            <span style="margin-top: 7px; ${t(28, 32, 500, T.navy, num + 'letter-spacing: -.03em; white-space: nowrap;')}">${valor}</span>
            <span style="margin-top: 5px; height: 16px; display: flex; align-items: center; gap: 6px; ${t(12.5, 16, 400, T.muted, num + truncar)}">${detalle}</span>
          </div>`;
const franja = (cifras) => `
        <div style="height: ${H.franja}px; flex-shrink: 0; display: grid; grid-template-columns: repeat(${cifras.length - 1}, minmax(0, 1fr) 1px) minmax(0, 1fr); column-gap: 24px;">
          ${cifras.map(cifra).join(divisor())}
        </div>`;

const SUB_ADMIN = 'Respuestas rápidas del chat: el equipo las inserta escribiendo «/» y el nombre. Aquí vive también el menú de bienvenida del bot.';
const SUB_ASESOR = 'Las del hospital y las tuyas. En el chat, escribe «/» y el nombre para usarlas.';

const franjaAdmin = franja([
  { marca: ico('message-square-text', T.navy), etq: 'Plantillas', valor: miles(TODAS.length), detalle: `${activas(TODAS)} activas · ${TODAS.length - activas(TODAS)} inactivas` },
  { marca: ico('paperclip', GRAF.curso), etq: 'Con adjuntos', valor: miles(conAdjunto(TODAS)), detalle: 'imagen, video o documento' },
  { marca: ico('users', T.navy), etq: 'Solo para algunas personas', valor: miles(ASIGNADAS.length), detalle: `las otras ${GLOBALES.length} las ve todo el equipo` },
  { marca: ico('bot', GRAF.ok), etq: 'Menú de bienvenida', valor: `${FLUJOS.length} flujos`, detalle: `${punto(GRAF.ok, 7)}<span style="color: ${TXT.ok}; font-weight: 500;">Activo: ${FLUJOS[0].n}</span>` },
]);
const PARA_ASESOR = [...MIAS_ASESOR, ...GLOBALES];
const franjaAsesor = franja([
  { marca: ico('message-square-text', T.navy), etq: 'Disponibles para ti', valor: miles(PARA_ASESOR.length), detalle: `${activas(PARA_ASESOR)} activas · ${PARA_ASESOR.length - activas(PARA_ASESOR)} inactivas` },
  { marca: ico('user-round', GRAF.curso), etq: 'Tuyas', valor: miles(MIAS_ASESOR.length), detalle: 'solo tú las ves' },
  { marca: ico('paperclip', T.navy), etq: 'Con adjuntos', valor: miles(conAdjunto(PARA_ASESOR)), detalle: 'imagen, video o documento' },
]);

// ══ Lista ═════════════════════════════════════════════════════════════════════════════════════════
const COLS = '32px minmax(0, 1fr) 118px 52px 74px';
const th = (x, der = false) => `<span style="${t(11, 16, 600, T.muted, 'text-transform: uppercase; letter-spacing: .07em; white-space: nowrap;' + (der ? ' text-align: right;' : ''))}">${x}</span>`;
const barraFiltros = ({ busca = 'Busca en nombre, asunto o texto', estado = 'all', tipo = 'Todos los tipos', n = TODAS.length, act = activas(TODAS) } = {}) => `
            <div style="height: 60px; flex-shrink: 0; padding: 0 ${PH}px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid ${C.filete};">
              ${buscador(busca)}
              ${segmentado([['all', 'Todas'], ['active', 'Activas'], ['inactive', 'Inactivas']], estado, 'Filtrar por estado').replace(/padding: 0 11px/g, 'padding: 0 9px')}
              ${campo({ i: 'layout-grid', valor: tipo, select: true, ancho: 176, alto: 36 })}
            </div>`;
const cabezaLista = `
            <div style="height: ${H.thead}px; flex-shrink: 0; padding: 0 ${PH}px; display: grid; grid-template-columns: ${COLS}; column-gap: 12px; align-items: center; border-bottom: 1px solid ${C.filete};">
              <span></span>${th('Plantilla')}${th('Quién la ve')}${th('Usos', true)}${th('Estado')}
            </div>`;
const grupoCab = (i, titulo, n, nota = '') => `
            <div style="height: ${H.grupo}px; flex-shrink: 0; padding: 0 ${PH}px; display: flex; align-items: center; gap: 8px; background: ${C.banda}; border-bottom: 1px solid ${C.filete};">
              ${ico(i, T.muted, 14, 1.9)}<span style="${t(12.5, 16, 600, T.navy, 'white-space: nowrap;')}">${titulo}</span><span style="${t(12.5, 16, 500, T.muted, num)}">${n}</span>${nota ? `<span style="margin-left: auto; ${t(12, 16, 400, T.muted, truncar)}">${nota}</span>` : ''}
            </div>`;
const fila = (p, { sel = false, visor = 'admin', final = false } = {}) => {
  const [ai, at] = alcance(p, visor);
  const [ti, tt] = TIPO[p.tipo];
  const nAdj = p.files.length;
  return `
            <div title="Ver cómo queda y qué se puede hacer" style="position: relative; height: ${H.fila}px; flex-shrink: 0; padding: 0 ${PH}px; display: grid; grid-template-columns: ${COLS}; column-gap: 12px; align-items: center;${final ? '' : ` border-bottom: 1px solid ${C.filete};`}${sel ? ` background: ${C.sel}; box-shadow: inset 0 0 0 1px ${navyA(0.16)};` : ''}">
              <span title="${tt}" style="width: 32px; height: 32px; border-radius: 9px; background: ${sel ? '#ffffff' : navyA(0.055)}; ${sel ? `box-shadow: inset 0 0 0 1px ${navyA(0.14)};` : ''} color: ${p.act ? T.navy : T.muted}; display: flex; align-items: center; justify-content: center;">${icono(ti, 16, 1.9)}</span>
              <div style="min-width: 0; display: flex; flex-direction: column; gap: 2px;">
                <span style="display: flex; align-items: center; gap: 7px; min-width: 0;"><span style="${t(13.5, 18, 600, p.act ? T.navy : T.muted, truncar)}">${p.n}</span>${nAdj ? `<span title="${nAdj} ${nAdj === 1 ? 'adjunto' : 'adjuntos'}" style="flex-shrink: 0; display: inline-flex; align-items: center; gap: 3px; ${t(12, 16, 600, T.muted, num)}">${icono('paperclip', 12, 2)}${nAdj}</span>` : ''}</span>
                <span style="${t(12.5, 16, 400, T.muted, truncar)}">${p.c}</span>
              </div>
              <span style="display: inline-flex; align-items: center; gap: 6px; min-width: 0; ${t(12.5, 16, 500, p.scope === 'global' ? T.muted : T.navy, truncar)}">${ico(ai, p.scope === 'global' ? T.muted : T.navy, 14, 1.9)}${at}</span>
              <span style="${t(13, 18, 600, T.navy, num + 'text-align: right;')}">${miles(p.usos)}</span>
              ${estadoTpl(p.act)}
            </div>`;
};

// ══ Burbujas de WhatsApp ══════════════════════════════════════════════════════════════════════════
const adjuntoBurbuja = (f) => {
  if (f.tipo === 'image') return `
                    <div style="position: relative; height: 112px; margin: -3px -5px 6px; border-radius: 7px; background: linear-gradient(135deg, #dbe3ee, #c9d4e3); overflow: hidden; display: flex; align-items: center; justify-content: center; color: ${T.slate500};">
                      ${icono('image', 30, 1.5)}
                      <span style="position: absolute; left: 8px; bottom: 8px; height: 22px; padding: 0 8px; border-radius: 6px; background: rgba(17,27,33,.62); display: inline-flex; align-items: center; ${t(11.5, 16, 500, '#ffffff', MONO)}">${f.f}</span>
                    </div>`;
  if (f.tipo === 'video') return `
                    <div style="position: relative; height: 112px; margin: -3px -5px 6px; border-radius: 7px; background: linear-gradient(135deg, #cfd8e3, #b8c4d4); display: flex; align-items: center; justify-content: center;">
                      <span style="width: 44px; height: 44px; border-radius: 9999px; background: rgba(17,27,33,.55); color: #ffffff; display: flex; align-items: center; justify-content: center;">${icono('play', 20, 2)}</span>
                      <span style="position: absolute; left: 8px; bottom: 8px; height: 22px; padding: 0 8px; border-radius: 6px; background: rgba(17,27,33,.62); display: inline-flex; align-items: center; ${t(11.5, 16, 500, '#ffffff', MONO)}">${f.f}</span>
                    </div>`;
  const ext = f.f.split('.').pop().toUpperCase();
  return `
                    <div style="margin: -2px -4px 7px; padding: 9px 10px; border-radius: 7px; background: rgba(17,27,33,.05); display: flex; align-items: center; gap: 10px;">
                      <span style="width: 30px; height: 36px; flex-shrink: 0; border-radius: 4px; background: #ffffff; box-shadow: inset 0 0 0 1px rgba(17,27,33,.12); color: ${T.navy}; display: flex; align-items: center; justify-content: center;">${icono('file-text', 16, 1.75)}</span>
                      <div style="min-width: 0; display: flex; flex-direction: column; gap: 1px;">
                        <span style="${t(12.5, 16, 500, WA.texto, truncar)}">${f.f}</span>
                        <span style="${t(11, 14, 400, WA.hora)}">${ext}</span>
                      </div>
                    </div>`;
};
/** Mensaje que manda el asesor (burbuja verde a la derecha). */
const burbujaSale = (p, { hora = '10:24', ancho = '88%' } = {}) => `
                <div style="padding: 14px 14px 16px; border-radius: 12px; background: ${WA.fondo}; box-shadow: inset 0 0 0 1px rgba(0,0,0,.05); display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                  ${p.files.slice(1).map((f) => `<div style="width: ${ancho}; padding: 8px 10px 6px; border-radius: 10px; background: ${WA.sale}; box-shadow: 0 1px 1px rgba(0,0,0,.1);">${adjuntoBurbuja(f).replace('margin: -2px -4px 7px;', 'margin: 0;')}</div>`).join('')}
                  <div style="width: ${ancho}; padding: 8px 10px 6px; border-radius: 10px 3px 10px 10px; background: ${WA.sale}; box-shadow: 0 1px 1px rgba(0,0,0,.1);">
                    ${p.files[0] ? adjuntoBurbuja(p.files[0]) : ''}
                    <p style="${t(13.5, 20, 400, WA.texto)}">${p.c}</p>
                    <span style="display: flex; justify-content: flex-end; align-items: center; gap: 3px; margin-top: 2px; ${t(11, 14, 400, WA.hora, num)}">${hora}${ico('check', '#53bdeb', 13, 2.25)}</span>
                  </div>
                </div>`;
/** Mensaje que recibe el paciente (burbuja blanca a la izquierda). */
const burbujaEntra = (html, { hora = '9:41', extra = '', botones = [] } = {}) => `
                <div style="padding: 12px 12px 14px; border-radius: 12px; background: ${WA.fondo}; box-shadow: inset 0 0 0 1px rgba(0,0,0,.05); ${extra}">
                  <div style="max-width: 92%; display: flex; flex-direction: column; gap: 2px;">
                    <div style="padding: 8px 10px 6px; border-radius: 3px 10px 10px 10px; background: #ffffff; box-shadow: 0 1px 1px rgba(0,0,0,.1);">
                      <p style="${t(13, 19, 400, WA.texto)}">${html}</p>
                      <span style="display: block; margin-top: 2px; text-align: right; ${t(11, 14, 400, WA.hora, num)}">${hora}</span>
                    </div>${botones.map((b) => `
                    <div style="height: 34px; border-radius: 10px; background: #ffffff; box-shadow: 0 1px 1px rgba(0,0,0,.1); display: flex; align-items: center; justify-content: center; gap: 6px; ${t(13, 18, 500, WA.boton, 'white-space: nowrap;')}">${b}</div>`).join('')}
                  </div>
                </div>`;

// ══ Detalle (panel derecho) ═══════════════════════════════════════════════════════════════════════
const dato = (etq, valor) => `
                  <div style="min-height: 30px; display: grid; grid-template-columns: 128px minmax(0, 1fr); column-gap: 12px; align-items: baseline; padding: 6px 0; border-bottom: 1px solid ${C.filete};">
                    <span style="${t(12.5, 18, 500, T.muted, 'white-space: nowrap;')}">${etq}</span>
                    <span style="min-width: 0; ${t(13, 18, 500, T.navy, num)}">${valor}</span>
                  </div>`;
const chipBarra = (n) => `<span style="display: inline-flex; align-items: center; height: 22px; padding: 0 7px; border-radius: 6px; background: #ffffff; box-shadow: inset 0 0 0 1px ${navyA(0.16)}; ${MONO} ${t(12, 16, 600, T.navy, 'white-space: nowrap;')}">/${n.toLocaleLowerCase('es').split(' ')[0]}</span>`;
const quienLaVe = (p, visor) => {
  if (p.scope === 'global') return visor === 'admin' ? 'Todo el equipo: asesores y administradores' : 'Todo el equipo (institucional)';
  if (p.scope === 'propia') return 'Solo tú. Nadie más la ve';
  return p.pers.map(nombrePropio).join(', ');
};
const panelDetalle = (p, { visor = 'admin' } = {}) => {
  const [ti, tt] = TIPO[p.tipo];
  const [ai, at] = alcance(p, visor);
  const puedeGestionar = visor === 'admin' || p.scope === 'propia';
  const acciones = visor === 'admin' ? `
                <div style="display: flex; flex-direction: column; gap: 10px;">
                  <div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); column-gap: 10px;">
                    ${botonPrimario('edit-3', 'Editar', 'Nombre, texto, adjuntos, quién la ve y si está activa')}
                    ${p.act ? botonSecundario('send', 'Enviar a contactos', 'Abre la pantalla para elegir contactos; nada sale sin confirmar') : `<div title="Actívala para poder enviarla" style="${btnBase} background: ${navyA(0.05)}; box-shadow: inset 0 0 0 1px ${navyA(0.1)}; color: ${T.muted};">${icono('send', 15, 1.9)}Enviar a contactos</div>`}
                  </div>
                  <div style="display: flex; align-items: center; justify-content: space-between;">
                    ${p.act ? botonTexto('power-off', 'Desactivar', T.navy, 'Deja de aparecer en el «/» del chat; no se borra') : botonTexto('power', 'Activar', TXT.ok, 'Vuelve a aparecer en el «/» del chat')}
                    ${botonTexto('trash-2', 'Eliminar…', TXT.mal, 'Pide confirmación')}
                  </div>
                </div>` : p.scope === 'propia' ? `
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                  ${botonPrimario('edit-3', 'Editar', 'Nombre y texto', 'flex: 1;')}
                  ${botonPeligro('trash-2', 'Eliminar…', 'Pide confirmación')}
                </div>` : `
                <div style="display: flex; align-items: flex-start; gap: 9px; ${t(12.5, 18, 400, T.muted)}">${ico('lock', T.muted, 14, 2)}<span>La gestiona un administrador. Tú puedes usarla en el chat, no cambiarla.</span></div>`;
  return `
            <div style="width: ${ANCHO_DET}px; flex-shrink: 0; display: flex; flex-direction: column; background: ${C.panel}; border-left: 1px solid ${C.filete};">
              <div style="padding: 18px 24px 16px; display: flex; flex-direction: column; gap: 6px; border-bottom: 1px solid ${C.filete};">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                  <h3 style="min-width: 0; ${t(17, 22, 600, T.navy, 'letter-spacing: -.01em;' + truncar)}">${p.n}</h3>
                  ${estadoTpl(p.act, 13)}
                </div>
                <div style="display: flex; align-items: center; gap: 14px; ${t(12.5, 16, 500, T.muted, 'white-space: nowrap;')}">
                  <span style="display: inline-flex; align-items: center; gap: 6px;">${icono(ti, 14, 1.9)}${tt}</span>
                  <span style="display: inline-flex; align-items: center; gap: 6px;">${icono(ai, 14, 1.9)}${at}</span>
                  <span style="display: inline-flex; align-items: center; gap: 6px;">${icono('message-square', 14, 1.9)}${miles(p.usos)} usos en el chat</span>
                </div>
                <div style="margin-top: 8px;">${acciones}
                </div>
              </div>
              <div style="padding: 16px 24px 0; display: flex; flex-direction: column; gap: 14px;">
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  ${rotulo('Así queda en el chat')}
                  ${burbujaSale(p)}
                </div>
                <div style="display: flex; flex-direction: column; border-top: 1px solid ${C.filete};">
                  ${dato('Para usarla', `<span style="display: inline-flex; align-items: center; gap: 8px;">${chipBarra(p.n)}<span style="color: ${T.muted}; font-weight: 400;">en la caja de texto del chat</span></span>`)}
                  ${dato('Quién la ve', quienLaVe(p, visor))}
                  ${p.files.length ? dato(p.files.length === 1 ? 'Adjunto' : 'Adjuntos', p.files.map((f) => `<span style="${MONO} font-size: 12px;">${f.f}</span>`).join('<br>')) : ''}
                  ${dato('Actualizada', `${p.upd}${p.updBy ? ` · ${p.updBy}` : ''}`)}
                  ${visor === 'admin' ? dato('Creada por', p.by) : ''}
                </div>
              </div>
            </div>`;
};

// ══ Hoja del catálogo ═════════════════════════════════════════════════════════════════════════════
const hojaCatalogo = ({ visor = 'admin', sel, filas = 9, entera = false }) => {
  const lista = visor === 'admin'
    ? [
      grupoCab('building-2', 'Para todo el equipo', GLOBALES.length, 'las más usadas primero'),
      ...GLOBALES.slice(0, entera ? GLOBALES.length : filas).map((p, k, a) => fila(p, { sel: p === sel, final: false })),
      grupoCab('users', 'Solo para algunas personas', ASIGNADAS.length, 'asignadas o creadas por ti desde el chat'),
      ...ASIGNADAS.map((p, k, a) => fila(p, { sel: p === sel, final: k === a.length - 1 })),
    ]
    : [
      grupoCab('user-round', 'Tuyas', MIAS_ASESOR.length, 'solo tú las ves'),
      ...MIAS_ASESOR.map((p) => fila(p, { sel: p === sel, visor })),
      grupoCab('building-2', 'Del hospital', GLOBALES.length, 'las gestiona un administrador'),
      ...GLOBALES.slice(0, entera ? GLOBALES.length : filas).map((p, k, a) => fila(p, { sel: p === sel, visor, final: entera && k === a.length - 1 })),
    ];
  const textoBanda = visor === 'admin'
    ? 'Pulsa una para ver cómo queda en el chat, quién la ve y qué puedes hacer con ella.'
    : 'Para guardar una tuya: escribe el mensaje en el chat y pulsa «Guardar como plantilla personal».';
  const derecha = visor === 'admin' ? '' : '';
  return `
            ${banda({ i: 'message-square-text', titulo: visor === 'admin' ? 'Respuestas rápidas' : 'Tus respuestas rápidas', cuenta: String(visor === 'admin' ? TODAS.length : PARA_ASESOR.length), texto: textoBanda, derecha })}
            <div style="display: flex; align-items: stretch; flex: 1; min-height: 0;">
              <div style="min-width: 0; flex: 1; display: flex; flex-direction: column;">
                ${barraFiltros(visor === 'admin' ? {} : { busca: 'Busca en nombre o texto' })}
                ${cabezaLista}
                ${lista.join('')}
              </div>
              ${panelDetalle(sel, { visor })}
            </div>`;
};

const VELO = 44;
const hojaRecortada = (html) => `
        <div style="position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; border-radius: 16px 16px 0 0; background: ${C.hoja}; box-shadow: ${sombraHoja}; overflow: hidden;">
          ${html}
          <div style="position: absolute; left: 0; right: ${ANCHO_DET}px; bottom: 0; height: ${VELO}px; z-index: 5; background: linear-gradient(180deg, rgba(255,255,255,0), #ffffff 88%); pointer-events: none;"></div>
        </div>`;
const pantalla = (html) => `
      <div style="position: absolute; inset: 0; padding: ${PAD}px ${PAD}px 0; display: flex; flex-direction: column; gap: ${GAP}px;">${html}
      </div>`;

const escribir = (nombre, html, medida) => {
  fs.writeFileSync(path.join(DIR, nombre), html);
  console.log(`  ${nombre.padEnd(20)} ${String(Buffer.byteLength(html)).padStart(7)} bytes  (${medida})`);
};

const SEL_ADMIN = GLOBALES.find((p) => p.n === 'UBICACIÓN CONSULTA EXTERNA');
const derechaAdmin = botonSecundario('bot', 'Menú de bienvenida', 'Baja a la sección del menú de bienvenida, en esta misma página') + botonPrimario('plus', 'Nueva plantilla');

// ══ Main (administrador) ══════════════════════════════════════════════════════════════════════════
escribir('Main.dc.html', documento(carcasaMarco({ activo: 'templates', ancho: 1440, contenido: pantalla(`
        ${cabecera({ sub: SUB_ADMIN, derecha: derechaAdmin })}
        ${franjaAdmin}
        ${hojaRecortada(hojaCatalogo({ visor: 'admin', sel: SEL_ADMIN, filas: 9 }))}`) })), `1440x900, isla ${ISLA.ancho}x${ISLA.alto}`);

// ══ Asesor ════════════════════════════════════════════════════════════════════════════════════════
// El menú de un asesor: sin el grupo GESTIÓN (adminOnly) y con su nombre. Envío masivo se ve porque
// esta asesora de ejemplo tiene el permiso (can_bulk_send). Se restauran tras generar.
{
  const gestion = NAV.splice(1, 1);
  const visor = { ...VISOR }, leidos = { ...NO_LEIDOS };
  Object.assign(VISOR, { nombre: 'Andrea Carolina Muñoz Paz', rol: 'Asesora' });
  Object.assign(NO_LEIDOS, { chat: 6, internal: 1 });
  const SEL_ASESOR = MIAS_ASESOR[1];
  escribir('Asesor.dc.html', documento(carcasaMarco({ activo: 'templates', ancho: 1440, contenido: pantalla(`
        ${cabecera({ sub: SUB_ASESOR })}
        ${franjaAsesor}
        ${hojaRecortada(hojaCatalogo({ visor: 'asesor', sel: SEL_ASESOR, filas: 6 }))}`) })), '1440x900');
  NAV.splice(1, 0, ...gestion);
  Object.assign(VISOR, visor); Object.assign(NO_LEIDOS, leidos);
}

// ══ Menú de bienvenida ════════════════════════════════════════════════════════════════════════════
const chip = (i, texto, tono = 'navy') => {
  const c = tono === 'ok' ? `background: ${FONDO.ok}; box-shadow: inset 0 0 0 1px ${FONDO.okBorde}; color: ${TXT.ok};` : `background: ${navyA(0.05)}; box-shadow: inset 0 0 0 1px ${navyA(0.1)}; color: ${T.navy};`;
  return `<span style="height: 22px; padding: 0 8px 0 7px; border-radius: 6px; ${c} display: inline-flex; align-items: center; gap: 5px; ${t(12, 16, 600, 'inherit', 'white-space: nowrap;')}">${icono(i, 12, 2.25)}${texto}</span>`;
};
const destino = (k) => k === '__complete__'
  ? `<span style="display: inline-flex; align-items: center; gap: 5px; ${t(12, 16, 600, T.muted, 'white-space: nowrap;')}">${icono('flag', 12, 2)}Fin</span>`
  : `<span style="${MONO} ${t(12, 16, 600, T.navy, 'white-space: nowrap;')}">${k}</span>`;
const tarjetaPaso = (p, k) => {
  const [ti, tt] = TIPO_PASO[p.tipo];
  const salidas = p.tipo === 'interactive_buttons' ? '' : p.ops
    ? p.ops.map(([b, d]) => `
                    <div style="height: 30px; display: flex; align-items: center; gap: 8px; border-top: 1px solid ${C.filete};">
                      ${ico(p.tipo === 'interactive_list' ? 'list' : 'mouse-pointer-click', T.muted, 13, 2)}<span style="min-width: 0; flex: 1; ${t(12.5, 16, 500, T.navy, truncar)}">${b}</span>${ico('arrow-right', T.muted, 13, 2)}${destino(d)}
                    </div>`).join('')
    : p.sig ? `
                    <div style="height: 30px; display: flex; align-items: center; gap: 8px; border-top: 1px solid ${C.filete};">
                      ${ico('keyboard', T.muted, 13, 2)}<span style="min-width: 0; flex: 1; ${t(12.5, 16, 500, T.navy, truncar)}">Cuando el paciente escribe</span>${ico('arrow-right', T.muted, 13, 2)}${destino(p.sig)}
                    </div>` : `
                    <div style="height: 30px; display: flex; align-items: center; gap: 8px; border-top: 1px solid ${C.filete}; ${t(12.5, 16, 400, T.muted)}">
                      ${ico('corner-down-right', T.muted, 13, 2)}Aquí termina este camino; sigue un asesor
                    </div>`;
  return `
                <div style="min-width: 0; padding: 12px 14px 8px; border-radius: 12px; background: #ffffff; box-shadow: inset 0 0 0 1px ${navyA(0.12)}; display: flex; flex-direction: column; gap: 10px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="width: 22px; height: 22px; flex-shrink: 0; border-radius: 9999px; background: ${p.entrada ? GRAF.ok : T.navy}; color: #ffffff; display: flex; align-items: center; justify-content: center; ${t(11.5, 14, 700, '#ffffff', num)}">${k + 1}</span>
                    <span style="min-width: 0; flex: 1; ${MONO} ${t(12.5, 16, 600, T.navy, truncar)}">${p.k}</span>
                    ${p.entrada ? chip('circle-dot', 'Entrada', 'ok') : ''}${chip(ti, tt)}
                  </div>
                  ${burbujaEntra(p.msg, { botones: p.tipo === 'interactive_buttons' ? p.ops.map(([b, d]) => `<span style="flex: 1; padding-left: 10px;">${b}</span><span title="Lleva al paso ${d}" style="display: inline-flex; align-items: center; gap: 5px; padding-right: 10px; color: ${T.muted};">${icono('arrow-right', 12, 2)}${destino(d)}</span>`) : p.tipo === 'interactive_list' ? [`${icono('list', 14, 2)}Ver opciones`] : [] })}
                  ${salidas ? `<div style="display: flex; flex-direction: column;">${salidas}
                  </div>` : ''}
                </div>`;
};
const filaFlujo = (f, abierto = false) => `
            <div style="height: 68px; flex-shrink: 0; padding: 0 ${PH}px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid ${C.filete};${abierto ? ` background: ${C.sel};` : ''}">
              <span style="width: ${RANURA}px; flex-shrink: 0; display: flex; justify-content: center;">${botonIcono(abierto ? 'chevron-up' : 'chevron-down', T.navy, abierto ? 'Ocultar pasos' : 'Ver pasos')}</span>
              <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 3px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <span style="${t(14, 20, 600, f.act ? T.navy : T.muted, 'white-space: nowrap;')}">${f.n}</span>
                  ${f.act ? `<span style="display: inline-flex; align-items: center; gap: 6px; ${t(12.5, 16, 600, TXT.ok)}">${punto(GRAF.ok, 7)}Activo</span>` : `<span style="display: inline-flex; align-items: center; gap: 6px; ${t(12.5, 16, 600, TXT.neutro)}">${punto(GRAF.neutro, 7)}Inactivo</span>`}
                </div>
                <span style="${t(12.5, 16, 400, T.muted, truncar + num)}">Se envía: ${f.trig.toLocaleLowerCase('es')} · ${f.pasos ? `${f.pasos} pasos` : `mensaje con ${f.botones} botones`} · creado por ${f.by} · actualizado ${f.upd}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                <span title="${f.act ? 'El bot deja de responder solo a los nuevos contactos' : 'Al activarlo se desactiva «' + FLUJOS[0].n + '»: solo puede haber uno activo'}" style="display: inline-flex; align-items: center; gap: 8px; padding: 0 10px 0 4px; ${t(12.5, 16, 600, f.act ? TXT.ok : TXT.neutro, 'white-space: nowrap;')}">${interruptor(f.act)}${f.act ? 'Encendido' : 'Apagado'}</span>
                ${botonTexto('edit-3', 'Editar')}
                ${botonTexto('trash-2', 'Eliminar…', TXT.mal, 'Pide confirmación')}
              </div>
            </div>`;
const hojaBienvenida = `
            ${banda({ i: 'bot', titulo: 'Menú de bienvenida', cuenta: String(FLUJOS.length), texto: 'Lo que el bot contesta solo cuando un paciente escribe. Solo puede haber un flujo encendido a la vez.',
    derecha: botonPrimario('plus', 'Nuevo flujo') })}
            ${filaFlujo(FLUJOS[0], true)}
            <div style="padding: 16px ${PH}px 20px ${X_TXT}px; display: flex; flex-direction: column; gap: 12px; background: ${C.panel}; border-bottom: 1px solid ${C.filete};">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
                ${rotulo('Así lo vive el paciente', `${PASOS.length} pasos · empieza en el verde; cada opción dice a qué paso lleva`)}
              </div>
              <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; align-items: start;">
                ${PASOS.map(tarjetaPaso).join('')}
              </div>
            </div>
            ${filaFlujo(FLUJOS[1], false)}
            <div style="height: 44px; flex-shrink: 0; padding: 0 ${PH}px 0 ${X_TXT}px; display: flex; align-items: center; gap: 8px; ${t(12.5, 16, 400, T.muted)}">${ico('info', T.muted, 14, 2)}Encender «${FLUJOS[1].n}» apaga «${FLUJOS[0].n}»: el bot solo usa uno.</div>`;

// ══ Completa ══════════════════════════════════════════════════════════════════════════════════════
const ALTOS = { Completa: 2885, Dialogos: 2572 };
const islaSuelta = (nombre, html) => `
<div data-artboard="${nombre}" style="position: relative; width: ${ISLA.ancho}px;${ALTOS[nombre] ? ` height: ${ALTOS[nombre]}px;` : ''} overflow: hidden; border-radius: ${RADIO_ISLA}px; background: ${T.bg}; font-family: ${T.font};">
      <div style="padding: ${PAD}px; display: flex; flex-direction: column; gap: ${GAP}px;">${html}
      </div>
</div>`;
const hojaEntera = (html) => `
        <div style="display: flex; flex-direction: column; border-radius: 16px; background: ${C.hoja}; box-shadow: ${sombraHoja}; overflow: hidden;">${html}
        </div>`;

escribir('Completa.dc.html', documento(islaSuelta('Completa', `
        ${cabecera({ sub: SUB_ADMIN, derecha: derechaAdmin })}
        ${franjaAdmin}
        ${hojaEntera(hojaCatalogo({ visor: 'admin', sel: SEL_ADMIN, entera: true }))}
        ${hojaEntera(hojaBienvenida)}`)), `${ISLA.ancho} x ${ALTOS.Completa || '?'}`);

// ══ Enviar a varios contactos (send) ══════════════════════════════════════════════════════════════
const PLANTILLA_ENVIO = GLOBALES.find((p) => p.n === 'HORARIO DE ATENCIÓN');
const filaContacto = ([n, tel, cuando, noLeidos, elegido], final = false) => `
            <div style="height: 50px; flex-shrink: 0; padding: 0 ${PH}px 0 ${PH + 7}px; display: grid; grid-template-columns: 18px minmax(0, 1fr) 150px 120px 90px; column-gap: 16px; align-items: center;${final ? '' : ` border-bottom: 1px solid ${C.filete};`}${elegido ? ` background: ${C.sel};` : ''}">
              ${casilla(elegido)}
              <span style="${t(13.5, 18, n === 'Sin nombre' ? 400 : 600, n === 'Sin nombre' ? T.muted : T.navy, truncar)}">${n === 'Sin nombre' ? n : nombrePropio(n)}</span>
              <span style="${MONO} ${t(12.5, 16, 500, T.navy, num + 'white-space: nowrap;')}">${tel}</span>
              <span style="${t(12.5, 16, 400, T.muted, 'white-space: nowrap;')}">${cuando}</span>
              ${noLeidos ? `<span style="justify-self: start; height: 22px; padding: 0 8px; border-radius: 9999px; background: ${navyA(0.07)}; display: inline-flex; align-items: center; ${t(12, 16, 600, T.navy, num + 'white-space: nowrap;')}">${noLeidos} sin leer</span>` : '<span></span>'}
            </div>`;
const comprobacion = (tipo, texto) => {
  const [i, c, x] = { ok: ['circle-check', GRAF.ok, T.navy], aviso: ['triangle-alert', GRAF.aviso, TXT.aviso], info: ['info', GRAF.curso, T.navy] }[tipo];
  return `<div style="display: flex; align-items: flex-start; gap: 9px; ${t(12.5, 18, tipo === 'aviso' ? 500 : 400, x)}"><span style="display: flex; margin-top: 1px; color: ${c};">${icono(i, 15, 2)}</span><span>${texto}</span></div>`;
};
const panelEnvio = `
            <div style="width: 424px; flex-shrink: 0; display: flex; flex-direction: column; background: ${C.panel}; border-left: 1px solid ${C.filete};">
              <div style="height: 52px; flex-shrink: 0; padding: 0 24px; display: flex; align-items: center; gap: 10px;">
                ${ico('send', T.navy, 17, 1.9)}<h3 style="${t(15, 20, 600, T.navy, 'letter-spacing: -.01em;')}">Revisar y enviar</h3>
              </div>
              <div style="padding: 0 24px 24px; display: flex; flex-direction: column; gap: 16px;">
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <span style="${t(12.5, 16, 500, T.muted, truncar)}">Así le llegará a <span style="color: ${T.navy}; font-weight: 600;">${nombrePropio(CONTACTOS[0][0])}</span>:</span>
                  ${burbujaEntra(PLANTILLA_ENVIO.c, { hora: '10:31' })}
                </div>
                <div style="display: flex; align-items: baseline; gap: 10px;">
                  <span style="${t(30, 36, 500, T.navy, num + 'letter-spacing: -.03em;')}">${ELEGIDOS}</span>
                  <span style="${t(13.5, 20, 400, T.muted, num)}">contactos elegidos de ${miles(TOTAL_CONTACTOS)}</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 9px;">
                  ${rotulo('Antes de enviar')}
                  ${comprobacion('ok', 'Plantilla activa y con texto')}
                  ${comprobacion('info', 'Sale en segundo plano: puedes seguir trabajando mientras tanto')}
                  ${comprobacion('aviso', 'Sale como mensaje normal, no como plantilla de Meta: a quien no haya escrito en las últimas 24 horas puede no llegarle')}
                </div>
                <div style="height: 1px; background: ${C.fileteFondo};"></div>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                  ${botonPrimario('send', `Enviar a ${ELEGIDOS} contactos…`, 'Abre la confirmación', 'width: 100%; height: 42px; font-size: 14px;')}
                  <span style="${t(12, 17, 400, T.muted)}">Al pulsar se abre una confirmación con el mensaje y a quién va. Nada sale sin confirmar.</span>
                </div>
              </div>
            </div>`;
const hojaEnvio = `
            ${banda({ i: 'users', titulo: 'Contactos', cuenta: miles(TOTAL_CONTACTOS), texto: 'Todas las conversaciones con número, de la más reciente a la más antigua.' })}
            <div style="display: flex; align-items: stretch; flex: 1; min-height: 0;">
              <div style="min-width: 0; flex: 1; display: flex; flex-direction: column;">
                <div style="height: 60px; flex-shrink: 0; padding: 0 ${PH}px; display: flex; align-items: center; gap: 14px; border-bottom: 1px solid ${C.filete};">
                  ${buscador('Buscar por nombre o teléfono')}
                  <span style="${t(12.5, 16, 500, T.muted, num + 'white-space: nowrap;')}"><span style="color: ${T.navy}; font-weight: 600;">${ELEGIDOS} elegidos</span></span>
                  ${botonTexto('x', 'Quitar selección', T.navy, 'Desmarca todos')}
                </div>
                <div style="height: 58px; flex-shrink: 0; padding: 0 ${PH}px 0 ${PH + 7}px; display: flex; align-items: center; gap: 16px; border-bottom: 1px solid ${C.fileteFondo}; background: ${C.banda};">
                  ${casilla(false)}
                  <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px;">
                    <span style="${t(13.5, 18, 600, T.navy)}">Enviar a todos los contactos</span>
                    <span style="${t(12.5, 16, 400, T.muted, num)}">Se enviaría a los ${miles(TOTAL_CONTACTOS)}. Al marcarla, la lista de abajo se bloquea.</span>
                  </div>
                  ${ico('triangle-alert', GRAF.aviso, 16, 2)}
                </div>
                ${CONTACTOS.map((c, k, a) => filaContacto(c, k === a.length - 1)).join('')}
              </div>
              ${panelEnvio}
            </div>`;
escribir('Enviar.dc.html', documento(carcasaMarco({ activo: 'templates', ancho: 1440, contenido: `
      <div style="position: absolute; inset: 0; padding: ${PAD - 4}px ${PAD}px 0; display: flex; flex-direction: column; gap: 20px;">
        <div style="flex-shrink: 0; display: flex; flex-direction: column; gap: 10px;">
          <span style="display: inline-flex; align-items: center; gap: 6px; ${t(13, 18, 600, T.navy, 'white-space: nowrap;')}">${icono('arrow-left', 15, 2)}Volver a Plantillas</span>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <h1 style="${t(28, 34, 600, T.navy, 'letter-spacing: -.025em; white-space: nowrap;')}">Enviar a varios contactos</h1>
              <span style="height: 28px; padding: 0 11px 0 9px; border-radius: 8px; background: ${navyA(0.06)}; display: inline-flex; align-items: center; gap: 7px; ${t(13, 18, 600, T.navy, 'white-space: nowrap;')}">${icono('message-square-text', 14, 2)}${PLANTILLA_ENVIO.n}</span>
            </div>
            <p style="${t(14, 20, 400, T.muted, 'white-space: nowrap;')}">Elige a quién va. El texto de la plantilla sale como un mensaje de WhatsApp a cada contacto elegido.</p>
          </div>
        </div>
        <div style="position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; border-radius: 16px 16px 0 0; background: ${C.hoja}; box-shadow: ${sombraHoja}; overflow: hidden;">
          ${hojaEnvio}
          <div style="position: absolute; left: 0; right: 424px; bottom: 0; height: ${VELO}px; z-index: 5; background: linear-gradient(180deg, rgba(255,255,255,0), #ffffff 88%); pointer-events: none;"></div>
        </div>
      </div>` })), '1440x900');

// ══ Diálogos ══════════════════════════════════════════════════════════════════════════════════════
const pie = (n, titulo, texto) => `
          <div style="display: flex; align-items: baseline; gap: 12px; padding: 0 4px; margin-bottom: -10px;">
            <span style="${t(12, 16, 600, T.navy, num + 'white-space: nowrap;')}">${n}</span>
            <span style="${t(14, 20, 600, T.navy, 'white-space: nowrap;')}">${titulo}</span>
            <span style="${t(13, 18, 400, T.muted, truncar)}">${texto}</span>
          </div>`;
const dialogo = ({ ancho, i, tono = 'navy', titulo, sub = '', cuerpo, botones, cerrar = false, izq = '' }) => {
  const ic = tono === 'mal' ? `background: ${FONDO.mal}; box-shadow: inset 0 0 0 1px ${FONDO.malBorde}; color: ${TXT.mal};` : `background: ${navyA(0.08)}; color: ${T.navy};`;
  return `
            <div style="width: ${ancho}px; flex-shrink: 0; border-radius: 16px; background: #ffffff; box-shadow: ${sombraDialogo}; overflow: hidden;">
              <div style="padding: 20px 24px 0; display: flex; align-items: center; gap: 14px;">
                <span style="width: 38px; height: 38px; flex-shrink: 0; border-radius: 10px; ${ic} display: flex; align-items: center; justify-content: center;">${icono(i, 18, 2)}</span>
                <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
                  <span style="${t(16.5, 22, 600, T.navy, 'letter-spacing: -.01em;')}">${titulo}</span>${sub ? `
                  <span style="${t(12.5, 16, 400, T.muted, truncar)}">${sub}</span>` : ''}
                </div>
                ${cerrar ? botonIcono('x', T.muted, 'Cerrar') : ''}
              </div>
              <div style="padding: 16px 24px 20px; display: flex; flex-direction: column; gap: 14px;">${cuerpo}
              </div>
              <div style="padding: 14px 24px; display: flex; align-items: center; justify-content: ${izq ? 'space-between' : 'flex-end'}; gap: 8px; background: ${C.banda}; border-top: 1px solid ${C.filete};">${izq}<div style="display: flex; gap: 8px;">${botones}</div>
              </div>
            </div>`;
};
const velo = (html, extra = '') => `
        <div style="display: flex; align-items: flex-start; gap: 20px; padding: 20px; border-radius: 16px; background: ${navyA(0.28)}; ${extra}">${html}
        </div>`;
const areaTexto = (texto, contador, max, alto = 104, foco = true) => `
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <div style="height: ${alto}px; border-radius: 9px; background: #ffffff; box-shadow: inset 0 0 0 1px ${foco ? T.navy : C.borde}${foco ? `, 0 0 0 3px ${navyA(0.14)}` : ''}; padding: 10px 12px; ${t(13, 20, 400, T.navy)} overflow: hidden;">${texto}</div>
                  <div style="display: flex; justify-content: flex-end; ${t(12, 16, 400, T.muted, num)}"><span>${miles(contador)} / ${miles(max)}</span></div>
                </div>`;
const archivo = (f, nuevo = false) => {
  const [ti, tt] = TIPO[f.tipo];
  return `
                    <div style="height: 46px; padding: 0 6px 0 8px; border-radius: 10px; background: #ffffff; box-shadow: inset 0 0 0 1px ${nuevo ? FONDO.okBorde : navyA(0.14)}; display: flex; align-items: center; gap: 10px;">
                      <span style="width: 32px; height: 32px; flex-shrink: 0; border-radius: 8px; background: ${nuevo ? FONDO.ok : navyA(0.06)}; color: ${nuevo ? TXT.ok : T.navy}; display: flex; align-items: center; justify-content: center;">${icono(ti, 16, 1.9)}</span>
                      <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 1px;">
                        <span style="${MONO} ${t(12.5, 16, 600, T.navy, truncar)}">${f.f}</span>
                        <span style="${t(12, 16, 400, nuevo ? TXT.ok : T.muted, 'white-space: nowrap;')}">${tt}${nuevo ? ' · nuevo, se sube al guardar' : ' · ya guardado'}</span>
                      </div>
                      ${botonIcono('x', T.muted, 'Quitar este archivo')}
                    </div>`;
};
const opcionAlcance = (on, i, titulo, texto) => `
                    <div style="min-width: 0; padding: 10px 12px; border-radius: 10px; background: ${on ? navyA(0.04) : '#ffffff'}; box-shadow: inset 0 0 0 ${on ? 1.5 : 1}px ${on ? T.navy : navyA(0.16)}; display: flex; align-items: flex-start; gap: 10px;">
                      <span style="margin-top: 1px;">${radio(on)}</span>
                      <div style="min-width: 0; display: flex; flex-direction: column; gap: 2px;">
                        <span style="display: flex; align-items: center; gap: 6px; ${t(13, 18, 600, T.navy)}">${icono(i, 14, 2)}${titulo}</span>
                        <span style="${t(12, 16, 400, T.muted)}">${texto}</span>
                      </div>
                    </div>`;
const persona = (n, rol, on) => `
                      <div style="height: 38px; padding: 0 10px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid ${C.filete};">
                        ${casilla(on)}
                        <span style="width: 24px; height: 24px; flex-shrink: 0; border-radius: 9999px; background: ${T.navy}; color: #ffffff; display: flex; align-items: center; justify-content: center; ${t(11, 14, 700, '#ffffff')}">${iniciales(n)}</span>
                        <span style="min-width: 0; flex: 1; ${t(13, 18, on ? 600 : 500, T.navy, truncar)}">${nombrePropio(n)}</span>
                        <span style="${t(12, 16, 500, T.muted, 'white-space: nowrap;')}">${rol}</span>
                      </div>`;

// 1. Editar plantilla (institucional o asignada). Crear es el mismo formulario vacío, sin «Asunto».
const EDITADA = { ...ASIGNADAS[0], files: [{ f: 'indicaciones_ayuno_pediatrico.pdf', tipo: 'document' }] };
const dialogoEditar = dialogo({ ancho: 752, i: 'edit-3', titulo: 'Editar plantilla', sub: 'Los cambios se ven en el «/» de quien la tenga en cuanto guardes.', cerrar: true,
  cuerpo: `
                <div style="display: grid; grid-template-columns: minmax(0, 1fr) 262px; column-gap: 22px; align-items: start;">
                  <div style="min-width: 0; display: flex; flex-direction: column; gap: 14px;">
                    ${conEtiqueta(etiqueta('Nombre'), campo({ valor: EDITADA.n }), 'Es lo que se escribe después de la «/» en el chat.')}
                    ${conEtiqueta(etiqueta('Asunto', '(opcional)'), campo({ ejemplo: 'Breve descripción' }))}
                    ${conEtiqueta(etiqueta('Mensaje'), areaTexto(EDITADA.c, EDITADA.c.length, 4096))}
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                      <div style="display: flex; align-items: baseline; justify-content: space-between;">${etiqueta('Adjuntos', '(opcional)')}<span style="${t(12, 16, 400, T.muted, num)}">2 archivos</span></div>
                      ${archivo(EDITADA.files[0])}
                      ${archivo({ f: 'mapa_cirugia_pediatrica.png', tipo: 'image' }, true)}
                      <div style="height: 38px; border-radius: 10px; border: 1.5px dashed ${navyA(0.26)}; display: flex; align-items: center; justify-content: center; gap: 8px; ${t(12.5, 16, 600, T.navy)}">${icono('paperclip', 14, 2)}Añadir archivos</div>
                      <span style="${t(12, 16, 400, T.muted)}">JPG, PNG, GIF, WEBP, MP4, MOV, AVI, 3GP, PDF, DOC o DOCX, hasta 20 MB cada uno. Las WEBP se guardan como PNG.</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                      ${etiqueta('Quién la ve')}
                      <div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 10px;">
                        ${opcionAlcance(false, 'building-2', 'Todo el equipo', 'Asesores y administradores')}
                        ${opcionAlcance(true, 'users', 'Solo algunas personas', 'Las que marques abajo')}
                      </div>
                      <div style="border-radius: 10px; box-shadow: inset 0 0 0 1px ${navyA(0.14)}; overflow: hidden;">
                        ${persona('PAOLA ANDREA VIVEROS SOLARTE', 'Asesor', true)}
                        ${persona('VALENTINA OSPINA TORO', 'Asesor', true)}
                        ${persona('CAMILA ANDREA RINCÓN PÉREZ', 'Asesor', true)}
                        ${persona('JUAN PABLO RESTREPO VÉLEZ', 'Asesor', false)}
                        ${persona('Hernán Ocampo Díaz', 'Administrador', false).replace(`border-bottom: 1px solid ${C.filete};`, '')}
                      </div>
                      <span style="${t(12, 16, 400, T.muted, num)}">3 elegidas · la lista sigue con las 33 personas del equipo.</span>
                    </div>
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${rotulo('Vista previa en el chat')}
                    ${burbujaSale(EDITADA, { ancho: '94%' }).replace('padding: 14px 14px 16px;', 'padding: 12px 10px 14px;')}
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-radius: 10px; background: ${FONDO.ok}; box-shadow: inset 0 0 0 1px ${FONDO.okBorde};">
                      <div style="display: flex; flex-direction: column; gap: 2px;">
                        <span style="${t(13, 18, 600, '#065f46')}">Activa</span>
                        <span style="${t(12, 16, 400, '#065f46')}">Aparece en el «/» del chat</span>
                      </div>
                      ${interruptor(true)}
                    </div>
                  </div>
                </div>`,
  botones: botonSecundario('x', 'Cancelar') + botonPrimario('save', 'Guardar cambios') });

// 2. Eliminar plantilla (ya existe hoy; se conserva: qué se borra, cuánto se usa y el freno si es muy usada).
const BORRAR = GLOBALES[0];
const dialogoEliminar = dialogo({ ancho: 318, i: 'trash-2', tono: 'mal', titulo: '¿Eliminar plantilla?',
  cuerpo: `
                <span style="${t(13.5, 20, 400, T.muted)}">Desaparece del «/» de todo el equipo. No se puede deshacer.</span>
                <div style="padding: 10px 12px; border-radius: 10px; background: ${navyA(0.04)}; box-shadow: inset 0 0 0 1px ${navyA(0.1)}; display: flex; flex-direction: column; gap: 2px;">
                  <span style="${t(13.5, 18, 600, T.navy, truncar)}">${BORRAR.n}</span>
                  <span style="${t(12.5, 16, 400, T.muted, num)}">Se ha usado ${miles(BORRAR.usos)} veces</span>
                </div>
                ${aviso('aviso', '', 'Es de las más usadas del equipo. Si solo quieres dejar de ofrecerla, desactívala en lugar de eliminarla.')}`,
  botones: botonSecundario('x', 'Cancelar') + botonPeligroLleno('trash-2', 'Sí, eliminar') });

// 3. Confirmar el envío a varios contactos (PROPUESTA: hoy sale al primer clic).
const dialogoEnviar = dialogo({ ancho: 540, i: 'send', titulo: `¿Enviar «${PLANTILLA_ENVIO.n}» a ${ELEGIDOS} contactos?`, cerrar: true,
  cuerpo: `
                <span style="${t(13.5, 20, 400, T.muted, num)}">A <span style="color: ${T.navy}; font-weight: 600;">${nombrePropio(CONTACTOS[0][0])}</span>, <span style="color: ${T.navy}; font-weight: 600;">${nombrePropio(CONTACTOS[1][0])}</span>, <span style="color: ${T.navy}; font-weight: 600;">${nombrePropio(CONTACTOS[2][0])}</span> y ${ELEGIDOS - 3} más. Cada uno recibe este mensaje:</span>
                ${burbujaEntra(PLANTILLA_ENVIO.c, { hora: '10:31' })}
                ${aviso('aviso', '', 'Los mensajes salen en cuanto confirmes y no se pueden retirar del WhatsApp del paciente.')}`,
  botones: botonSecundario('x', 'Cancelar') + botonPrimario('send', `Sí, enviar a ${ELEGIDOS}`) });

// 4. Flujo del menú de bienvenida (crear y editar: mismo formulario de hoy).
const FLUJO_FORM = { n: 'Aviso de días festivos', msg: 'Hoy es festivo y la línea de WhatsApp no tiene asesores. Si su caso es urgente, acuda al servicio de urgencias. Si no, déjenos su mensaje y le respondemos el próximo día hábil.', botones: [['Urgencias', 'urgencias', 'Urgencias atiende las 24 horas por la entrada de la Calle 5.'], ['Dejar mensaje', 'dejar_mensaje', 'Escriba su mensaje: un asesor le responderá el próximo día hábil desde las 7:00 a. m.']] };
const bloqueBoton = ([texto, id, resp], k) => `
                    <div style="padding: 12px 12px 12px; border-radius: 10px; background: #ffffff; box-shadow: inset 0 0 0 1px ${navyA(0.14)}; display: flex; flex-direction: column; gap: 10px;">
                      <div style="display: flex; align-items: center; gap: 8px;">
                        ${ico('mouse-pointer-click', T.navy, 14, 2)}<span style="flex: 1; ${t(13, 18, 600, T.navy)}">Botón ${k + 1}</span>
                        ${botonIcono('trash-2', TXT.mal, 'Quitar este botón (se quita del formulario al guardar)')}
                      </div>
                      <div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 10px;">
                        ${conEtiqueta(etiqueta('Texto', `(${texto.length}/20)`), campo({ valor: texto, alto: 34 }))}
                        ${conEtiqueta(etiqueta('ID'), campo({ valor: id, mono: true, alto: 34 }))}
                      </div>
                      ${conEtiqueta(etiqueta('Respuesta automática'), `<div style="border-radius: 9px; background: #ffffff; box-shadow: inset 0 0 0 1px ${C.borde}; padding: 8px 11px; ${t(13, 19, 400, T.navy)}">${resp}</div>`)}
                    </div>`;
const dialogoFlujo = dialogo({ ancho: 752, i: 'bot', titulo: 'Editar flujo de bienvenida', sub: 'El mensaje, cuándo se envía y los botones que ve el paciente.', cerrar: true,
  cuerpo: `
                <div style="display: grid; grid-template-columns: minmax(0, 1fr) 262px; column-gap: 22px; align-items: start;">
                  <div style="min-width: 0; display: flex; flex-direction: column; gap: 14px;">
                    <div style="display: grid; grid-template-columns: minmax(0, 1fr) 200px; column-gap: 12px;">
                      ${conEtiqueta(etiqueta('Nombre del flujo'), campo({ valor: FLUJO_FORM.n }))}
                      ${conEtiqueta(etiqueta('¿Cuándo se envía?'), campo({ valor: 'Siempre', select: true }))}
                    </div>
                    <span style="margin-top: -6px; ${t(12, 16, 400, T.muted)}">Opciones: solo primer contacto, cada conversación nueva o siempre.</span>
                    ${conEtiqueta(etiqueta('Mensaje de bienvenida'), areaTexto(FLUJO_FORM.msg, FLUJO_FORM.msg.length, 4096, 84, false).replace(/<div style="display: flex; justify-content: flex-end;[^]*?<\/div>\n/, ''))}
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                      <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span style="display: flex; align-items: baseline; gap: 8px;">${etiqueta('Botones')}<span style="${t(12, 16, 400, T.muted, num)}">2 de 3 · WhatsApp admite 3 como máximo</span></span>
                        ${botonTexto('plus', 'Añadir botón')}
                      </div>
                      ${FLUJO_FORM.botones.map(bloqueBoton).join('')}
                    </div>
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${rotulo('Así lo recibe el paciente')}
                    ${burbujaEntra(FLUJO_FORM.msg, { botones: FLUJO_FORM.botones.map((b) => b[0]) })}
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-radius: 10px; background: #ffffff; box-shadow: inset 0 0 0 1px ${navyA(0.14)};">
                      <div style="display: flex; flex-direction: column; gap: 2px;">
                        <span style="${t(13, 18, 600, T.navy)}">Encender este flujo</span>
                        <span style="${t(12, 16, 400, T.muted)}">Solo puede haber uno encendido</span>
                      </div>
                      ${interruptor(false)}
                    </div>
                    ${aviso('info', '', `Si lo enciendes, se apaga «${FLUJOS[0].n}».`)}
                  </div>
                </div>`,
  botones: botonSecundario('x', 'Cancelar') + botonPrimario('save', 'Guardar flujo') });

// 5. Eliminar flujo (PROPUESTA: hoy es el confirm() del navegador).
const dialogoEliminarFlujo = dialogo({ ancho: 318, i: 'trash-2', tono: 'mal', titulo: '¿Eliminar este flujo?',
  cuerpo: `
                <span style="${t(13.5, 20, 400, T.muted)}">Se borra con sus pasos y botones. No se puede deshacer.</span>
                <div style="padding: 10px 12px; border-radius: 10px; background: ${navyA(0.04)}; box-shadow: inset 0 0 0 1px ${navyA(0.1)}; display: flex; flex-direction: column; gap: 2px;">
                  <span style="${t(13.5, 18, 600, T.navy, truncar)}">${FLUJOS[0].n}</span>
                  <span style="${t(12.5, 16, 400, T.muted, num)}">${FLUJOS[0].pasos} pasos · encendido</span>
                </div>
                ${aviso('aviso', '', 'Es el flujo encendido: al borrarlo, el bot deja de responder solo a los pacientes que escriban.')}`,
  botones: botonSecundario('x', 'Cancelar') + botonPeligroLleno('trash-2', 'Sí, eliminar') });

// 6. Editar una plantilla personal (asesor). Mismos límites que PersonalTemplateController.
const MIA = MIAS_ASESOR[1];
const dialogoPersonal = dialogo({ ancho: 470, i: 'user-round', titulo: 'Editar plantilla personal', sub: 'Solo tú la ves en tu «/».', cerrar: true,
  cuerpo: `
                ${conEtiqueta(etiqueta('Nombre', `(${MIA.n.length}/60)`), campo({ valor: MIA.n, foco: true }), 'Corto, para llamarla rápido con «/». No puede repetirse entre las tuyas.')}
                ${conEtiqueta(etiqueta('Texto'), areaTexto(MIA.c, MIA.c.length, 4096, 84, false))}`,
  botones: botonSecundario('x', 'Cancelar') + botonPrimario('save', 'Guardar') });

escribir('Dialogos.dc.html', documento(islaSuelta('Dialogos', `
        ${pie('1', 'Editar plantilla y eliminar', 'Un solo formulario con la vista previa al lado. Crear es el mismo, vacío. Eliminar dice qué se borra y cuánto se usa.')}
        ${velo(dialogoEditar + dialogoEliminar)}
        ${pie('2', 'Menú de bienvenida', 'El formulario del flujo con el mensaje tal como lo recibe el paciente. Eliminar pregunta en la app (hoy es la ventanita del navegador).')}
        ${velo(dialogoFlujo + dialogoEliminarFlujo)}
        ${pie('3', 'Enviar y plantilla personal', 'Enviar a varios contactos pide confirmación (hoy sale al primer clic). A la derecha, lo que edita un asesor.')}
        ${velo(dialogoEnviar + dialogoPersonal)}`)), `${ISLA.ancho} x ${ALTOS.Dialogos || '?'}`);
