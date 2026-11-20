// Envío masivo (/admin/bulk-sends y /admin/bulk-sends/{id}) rediseñado dentro de la carcasa "Marco navy",
// en el mismo lenguaje que Usuarios, Configuración, Estadísticas y Citas.
//
// Idea: preparar un envío se lee como cuatro pasos numerados en una sola hoja. A la izquierda, lo que se
// va eligiendo (1 plantilla, 2 destinatarios, 3 de dónde sale cada dato del mensaje); a la derecha, fijo,
// el paso 4: el mensaje tal como le llegará al primer paciente, las comprobaciones y el único botón de
// enviar, que siempre abre una confirmación. El historial va debajo en la misma hoja. Las plantillas de
// Meta son la otra pestaña, junto al título.
//
// Escribe:
//   Main.dc.html       1440x900: preparando un envío (menú fijado, isla 1190x880).
//   Completa.dc.html   1190 x alto necesario: la pestaña Enviar entera, con el historial.
//   Detalle.dc.html    1440x900: el detalle de un envío (show).
//   Plantillas.dc.html 1440x900: la pestaña Plantillas.
//   Estados.dc.html    1190 x alto: envío en curso, detener, confirmar envío, faltan datos, avisos de
//                      plantilla, búsqueda en el historial y vacíos.
//   Dialogos.dc.html   1190 x alto: crear plantilla en Meta y eliminar plantilla.
//
// TODO es de EJEMPLO e inventado: pacientes, teléfonos, archivos, plantillas, textos, errores y cifras.
// Forma real de las props de BulkSendController@index, @search y @show. "Hoy" = domingo 13 sept 2026.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { T, icono, documento } from '../usuarios/_comun.mjs';
import { carcasaMarco, ISLA, RADIO_ISLA } from '../usuarios/_marco.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));

// ══ Paleta (la de Estadísticas y Citas) ═══════════════════════════════════════════════════════════
// Marcas contra blanco (mín. 3:1): esmeralda 600 3,77 · rojo 600 4,83 · ámbar 600 3,19 · cielo 600 4,10.
// Texto con color (mín. 4,5:1): esmeralda 700 5,48 · ámbar 700 5,02 · rojo 700 6,47 · cielo 700 5,93 ·
// pizarra 600 7,58. Borde de campo navy al 58 % sobre blanco: 3,15:1.
const GRAF = { ok: '#059669', aviso: '#d97706', mal: '#dc2626', curso: '#0284c7', neutro: '#94a3b8', pista: 'rgba(46,63,132,.08)' };
const TXT = { ok: '#047857', aviso: '#b45309', mal: '#b91c1c', curso: '#0369a1', neutro: '#475569' };
const FONDO = { ok: '#ecfdf5', okBorde: '#a7f3d0', mal: '#fef2f2', malBorde: '#fecaca', aviso: '#fffbeb', avisoBorde: '#fde68a', curso: '#f0f9ff', cursoBorde: '#bae6fd' };

const miles = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// ══ Datos de EJEMPLO ══════════════════════════════════════════════════════════════════════════════
let semilla = 20260913;
const azar = () => ((semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648);
const uno = (lista) => lista[Math.floor(azar() * lista.length)];
const digitos = (n) => Array.from({ length: n }, () => Math.floor(azar() * 10)).join('');
const NOMBRES = ['MARÍA JOSÉ', 'LUZ MARINA', 'ANA LUCÍA', 'GLORIA INÉS', 'ROSA AMELIA', 'MARTHA CECILIA', 'BLANCA NUBIA',
  'CLAUDIA PATRICIA', 'NANCY ESTELLA', 'OLGA LUCÍA', 'YOLANDA', 'LEIDY JOHANA', 'DIANA CAROLINA', 'SANDRA MILENA', 'KAREN VIVIANA'];
const APELLIDOS = ['RENGIFO', 'OBANDO', 'CARABALÍ', 'VALENCIA', 'MINA', 'PERLAZA', 'CASTILLO', 'MOSQUERA', 'LOZANO',
  'BENÍTEZ', 'CUERO', 'TRUJILLO', 'SINISTERRA', 'ARBOLEDA', 'SOLÍS', 'PALACIOS', 'QUIÑÓNEZ', 'LONDOÑO', 'VIDAL', 'ZÚÑIGA'];
const persona = () => { const a = uno(APELLIDOS); let b = uno(APELLIDOS); while (b === a) b = uno(APELLIDOS); return `${uno(NOMBRES)} ${a} ${b}`; };
const telefono = () => `3${uno(['00', '01', '04', '10', '12', '13', '14', '15', '16', '17', '18', '20'])} ${digitos(3)} ${digitos(4)}`;
const MEDICOS_GINE = ['MÓNICA LILIANA ERAZO', 'SANDRA PATRICIA CHAVES', 'JULIÁN ANDRÉS PARDO'];
const HORAS = ['6:40 AM', '7:00 AM', '7:20 AM', '7:40 AM', '8:00 AM', '8:20 AM', '9:00 AM', '9:40 AM', '10:20 AM', '2:00 PM', '2:40 PM', '3:20 PM'];
const SEDES = ['Consulta externa, piso 2', 'Torre materno infantil'];

// Plantilla elegida en el ejemplo. {{2}} va tras «cita de» (especialidad), {{3}} tras «el día» (fecha),
// {{4}} tras «a las» (hora) y {{5}} tras «DR.(A)» (médico): así lo detecta la pantalla de hoy.
const PLANTILLA = {
  nombre: 'Recordatorio de cita por especialidad', meta: 'recordatorio_cita_especialidad', idioma: 'es_CO', idiomaTxt: 'Español (Colombia)', cat: 'Utilidad',
  cuerpo: 'Hola {{1}}, le recordamos su cita de {{2}} el día {{3}} a las {{4}} con DR.(A) {{5}}. Si no puede asistir, responda a este mensaje para reprogramarla.',
};
const ENVIO = { nombre: 'Citas de ginecología · semana 38', archivo: 'citas_gineco_sem38.xlsx', total: 1284, extra: ['especialidad', 'fecha', 'hora', 'medico', 'sede'] };
const DESTINATARIOS = Array.from({ length: 6 }, () => ({ n: persona(), tel: telefono(), p: ['ginecología', `2${uno(['1', '2', '3', '4', '5'])}/09/2026`, uno(HORAS), uno(MEDICOS_GINE), uno(SEDES)] }));
DESTINATARIOS[0] = { n: 'MARÍA JOSÉ RENGIFO OBANDO', tel: '300 418 2765', p: ['ginecología', '22/09/2026', '7:40 AM', 'MÓNICA LILIANA ERAZO', 'Consulta externa, piso 2'] };
const PRIMERO = DESTINATARIOS[0];

// Mapeo (column_mapping) tal como lo deja el auto-mapeo de hoy con esas columnas.
const MAPEO = [
  { idx: 1, antes: 'Hola', despues: ', le recordamos', origen: 'Nombre del contacto', tipo: 'nombre', valor: PRIMERO.n },
  { idx: 2, antes: 'su cita de', despues: 'el día', origen: 'Columna: especialidad', tipo: 'col', valor: PRIMERO.p[0] },
  { idx: 3, antes: 'el día', despues: 'a las', origen: 'Columna: fecha', tipo: 'col', valor: PRIMERO.p[1] },
  { idx: 4, antes: 'a las', despues: 'con DR.(A)', origen: 'Columna: hora', tipo: 'col', valor: PRIMERO.p[2] },
  { idx: 5, antes: 'con DR.(A)', despues: '. Si no puede', origen: 'Columna: medico', tipo: 'col', valor: PRIMERO.p[3] },
];
const GUIA = [['telefono', '300 000 0000'], ['nombre', 'PEREZ LOPEZ, MARIA'], ['especialidad', 'dermatologia'], ['fecha', '20/06/2026'], ['hora', '8:30 AM'], ['medico', 'CARLOS GOMEZ RIOS']];

// Cifras de la pestaña Enviar (props bulkSends / whatsappTemplates / allTemplates).
const CIFRAS = { campanas: 48, completadas: 45, activas: 0, destinatarios: 61240, enviados: 59214, fallidos: 2026, pendientes: 0, bloqueadas: 3, utiles: 9, revision: 2, rechazadas: 1 };

// Historial (orden: created_at desc). Nombres de responsables: los asesores de ejemplo de Usuarios.
const HISTORIAL = [
  { n: ENVIO.nombre, tpl: 'recordatorio_cita_especialidad', st: 'completed', total: 1284, ok: 1231, mal: 53, quien: 'Paola Andrea Viveros Solarte', f: '12 sept 2026, 7:52' },
  { n: 'Resultados de laboratorio listos', tpl: 'resultados_disponibles_portal', st: 'completed', total: 642, ok: 630, mal: 12, quien: 'Valentina Ospina Toro', f: '11 sept 2026, 15:10' },
  { n: 'Jornada de vacunación octubre', tpl: 'jornada_vacunacion_octubre', st: 'cancelled', total: 2027, ok: 804, mal: 1223, quien: 'Sofía Quintero Ramos', f: '10 sept 2026, 9:05' },
  { n: 'Envío 2026-09-09 16:21', tpl: 'aviso_reprogramacion_cita', st: 'completed', total: 87, ok: 85, mal: 2, quien: 'Andrea Carolina Muñoz Paz', f: '9 sept 2026, 16:21', sinNombre: true },
  { n: 'Preparación examen de laboratorio', tpl: 'preparacion_examen_laboratorio', st: 'completed', total: 318, ok: 309, mal: 9, quien: 'María Fernanda Loaiza Cruz', f: '8 sept 2026, 11:37' },
  { n: 'Control prenatal · semana 37', tpl: 'recordatorio_control_prenatal', st: 'completed', total: 1106, ok: 1070, mal: 36, quien: 'Paola Andrea Viveros Solarte', f: '5 sept 2026, 7:48' },
  { n: 'Encuesta de satisfacción agosto', tpl: 'encuesta_satisfaccion_atencion', st: 'failed', total: 450, ok: 0, mal: 450, quien: 'Camila Andrea Rincón Pérez', f: '4 sept 2026, 10:02' },
  { n: 'Cirugías programadas · semana 36', tpl: 'instrucciones_cirugia_programada', st: 'completed', total: 64, ok: 64, mal: 0, quien: 'Valentina Ospina Toro', f: '3 sept 2026, 14:15' },
  { n: 'Citas de ortopedia · semana 37', tpl: 'recordatorio_cita_especialidad', st: 'cancelled', total: 930, ok: 412, mal: 518, quien: 'Andrea Carolina Muñoz Paz', f: '2 sept 2026, 8:10' },
  { n: 'Citas de ginecología · semana 37', tpl: 'recordatorio_cita_especialidad', st: 'completed', total: 1190, ok: 1152, mal: 38, quien: 'Paola Andrea Viveros Solarte', f: '1 sept 2026, 7:55' },
];

// Plantillas (allTemplates), en el orden del controlador: aprobadas, rechazadas, en revisión y el resto.
const PLANTILLAS = [
  ['Aviso de reprogramación de cita', 'aviso_reprogramacion_cita', 'UTILITY', 'es_CO', 'APPROVED', 'Hola {{1}}, su cita del {{2}} fue reprogramada para el {{3}} a las {{4}}…', '14 mar 2026'],
  ['Código de verificación', 'codigo_verificacion_portal', 'AUTHENTICATION', 'es', 'APPROVED', '{{1}} es su código de verificación. No lo comparta con nadie.', '2 feb 2026'],
  ['Encuesta de satisfacción', 'encuesta_satisfaccion_atencion', 'MARKETING', 'es', 'APPROVED', 'Hola {{1}}, cuéntenos cómo fue su atención en el hospital…', '20 jul 2026'],
  ['Instrucciones de cirugía programada', 'instrucciones_cirugia_programada', 'UTILITY', 'es_CO', 'APPROVED', 'Hola {{1}}, adjuntamos las indicaciones para su cirugía del {{2}}…', '9 may 2026'],
  ['Jornada de vacunación', 'jornada_vacunacion_octubre', 'MARKETING', 'es_CO', 'APPROVED', 'Este sábado {{1}} habrá jornada de vacunación en la sede…', '28 ago 2026'],
  ['Preparación para examen de laboratorio', 'preparacion_examen_laboratorio', 'UTILITY', 'es', 'APPROVED', 'Hola {{1}}, para su examen del {{2}} debe venir en ayunas…', '11 abr 2026'],
  ['Recordatorio control prenatal', 'recordatorio_control_prenatal', 'UTILITY', 'es_CO', 'APPROVED', 'Hola {{1}}, le recordamos su control prenatal el día {{2}}…', '6 jun 2026'],
  [PLANTILLA.nombre, PLANTILLA.meta, 'UTILITY', 'es_CO', 'APPROVED', PLANTILLA.cuerpo, '22 jun 2026'],
  ['Resultados disponibles en el portal', 'resultados_disponibles_portal', 'UTILITY', 'es_CO', 'APPROVED', 'Hola {{1}}, sus resultados ya están disponibles en el portal…', '30 jun 2026'],
  ['Cambio de horario de consulta externa', 'cambio_horario_consulta', 'MARKETING', 'es_CO', 'REJECTED', 'Desde el lunes {{1}} la consulta externa atiende de…', '1 sept 2026'],
  ['Aviso de entrega de medicamentos', 'aviso_entrega_medicamentos', 'UTILITY', 'es_CO', 'PENDING', 'Hola {{1}}, sus medicamentos están listos para recoger…', '12 sept 2026'],
  ['Recordatorio de terapia física', 'recordatorio_terapia_fisica', 'UTILITY', 'es_CO', 'PENDING', 'Hola {{1}}, le esperamos en terapia física el {{2}} a las {{3}}…', '12 sept 2026'],
  ['Campaña de donación de sangre', 'campana_donacion_sangre', 'MARKETING', 'es_CO', 'PAUSED', 'Done sangre y salve vidas: este {{1}} en el primer piso…', '15 may 2026'],
  ['Bienvenida a la línea de atención', 'bienvenida_linea_atencion', 'UTILITY', 'es', 'DISABLED', 'Bienvenido a la línea de WhatsApp del hospital…', '10 nov 2025'],
];

// Detalle: el primer envío del historial. Destinatarios en el orden del controlador: fallidos, pendientes, enviados.
const ERRORES = [
  '131026 · Mensaje no entregable: el número no tiene WhatsApp',
  '131021 · El número de destino no es válido',
  '131049 · Meta no entregó el mensaje para cuidar la experiencia del usuario',
  '131026 · Mensaje no entregable: el número no tiene WhatsApp',
  '100 · Parámetro no válido: el valor de {{3}} llegó vacío',
  '131021 · El número de destino no es válido',
];
const DET = { ...HISTORIAL[0], pendientes: 0, conError: 53, exito: Math.round((1231 / 1284) * 100) };
const FILAS_DET = [
  ...ERRORES.map((e) => ({ n: persona(), tel: telefono(), st: 'failed', err: e, cuando: '' })),
  ...Array.from({ length: 10 }, () => ({ n: persona(), tel: telefono(), st: 'sent', err: '', cuando: `12 sept 2026, ${uno(['7:53', '7:54', '7:56', '7:58', '8:01', '8:03'])}:${digitos(2).replace(/^[6-9]/, '4')}` })),
].map((r) => ({ ...r, p: ['ginecología', `2${uno(['1', '2', '3', '4', '5'])}/09/2026`, uno(HORAS), uno(MEDICOS_GINE), uno(SEDES)] }));
FILAS_DET[4].p[1] = '';

// ══ Tintas y geometría ════════════════════════════════════════════════════════════════════════════
const navyA = (a) => `rgba(46,63,132,${a})`;
const C = { hoja: '#ffffff', filete: navyA(0.08), fileteFondo: navyA(0.12), banda: navyA(0.028), campo: navyA(0.035), borde: navyA(0.58), panel: '#f7f8fb' };
const MONO = "font-family: ui-monospace, 'Cascadia Mono', 'SF Mono', Consolas, monospace;";
const truncar = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
const num = 'font-variant-numeric: tabular-nums;';
const PAD = 28, PH = 20, RANURA = 32, X_TXT = PH + RANURA + 12; // 64
const GAP = 24;
const ANCHO_PANEL = 424;
const H = { cab: 58, franja: 76, banda: 64, paso: 52, thead: 36, fila: 54 };
const sombraHoja = `0 0 0 1px ${navyA(0.07)}, 0 1px 2px ${navyA(0.05)}, 0 14px 32px -18px ${navyA(0.22)}`;
const sombraDialogo = `0 0 0 1px ${navyA(0.1)}, 0 6px 14px ${navyA(0.1)}, 0 30px 60px -20px ${navyA(0.55)}`;

// ══ Piezas ════════════════════════════════════════════════════════════════════════════════════════
const t = (px, lh, peso, color, extra = '') => `font-size: ${px}px; line-height: ${lh}px; font-weight: ${peso}; color: ${color}; ${extra}`;
const punto = (color, d = 8, r = 9999) => `<span style="width: ${d}px; height: ${d}px; flex-shrink: 0; border-radius: ${r}px; background: ${color};"></span>`;
const divisor = (color = C.fileteFondo) => `<div style="width: 1px; align-self: stretch; background: ${color};"></div>`;
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
const nombrePropio = (n) => n.toLocaleLowerCase('es').split(' ').filter(Boolean)
  .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toLocaleUpperCase('es') + p.slice(1))).join(' ');
const ico = (nombre, color, s = 14, sw = 2) => `<span style="display: flex; color: ${color};">${icono(nombre, s, sw)}</span>`;

const rotulo = (titulo, apoyo = '') => `
              <div style="height: 16px; display: flex; align-items: baseline; gap: 10px;">
                <span style="${t(11, 16, 600, T.muted, 'text-transform: uppercase; letter-spacing: .07em; white-space: nowrap;')}">${titulo}</span>${apoyo ? `
                <span style="${t(12, 16, 400, T.muted, truncar + num)}">${apoyo}</span>` : ''}
              </div>`;

// Botones (los de Citas). El de peligro es contorno rojo y el definitivo, dentro del diálogo, rojo lleno.
const btnBase = 'height: 36px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 16px 0 14px; border-radius: 10px; font-size: 13px; line-height: 18px; font-weight: 600; white-space: nowrap;';
const tit = (x) => (x ? ` title="${x}"` : '');
const botonPrimario = (i, texto, titulo = '', extra = '') =>
  `<div${tit(titulo)} style="${btnBase} background: ${T.btnPrimary}; box-shadow: 0 1px 2px ${navyA(0.3)}, 0 6px 16px -6px ${navyA(0.55)}, inset 0 1px 0 rgba(255,255,255,.14); color: #ffffff; ${extra}">${icono(i, 15, 2)}${texto}</div>`;
const botonSecundario = (i, texto, titulo = '', extra = '') =>
  `<div${tit(titulo)} style="${btnBase} background: #ffffff; box-shadow: inset 0 0 0 1px ${navyA(0.2)}, 0 1px 2px ${navyA(0.08)}; color: ${T.navy}; ${extra}">${icono(i, 15, 1.9)}${texto}</div>`;
const botonPeligro = (i, texto, titulo = '') =>
  `<div${tit(titulo)} style="${btnBase} background: #ffffff; box-shadow: inset 0 0 0 1px rgba(220,38,38,.55), 0 1px 2px rgba(220,38,38,.12); color: ${TXT.mal};">${icono(i, 15, 2)}${texto}</div>`;
const botonPeligroLleno = (i, texto) =>
  `<div style="${btnBase} background: ${GRAF.mal}; box-shadow: 0 1px 2px rgba(185,28,28,.35), 0 6px 16px -6px rgba(220,38,38,.55), inset 0 1px 0 rgba(255,255,255,.14); color: #ffffff;">${icono(i, 15, 2)}${texto}</div>`;
const botonApagado = (i, texto, titulo, extra = '') =>
  `<div title="${titulo}" style="${btnBase} background: ${navyA(0.05)}; box-shadow: inset 0 0 0 1px ${navyA(0.1)}; color: ${T.muted}; ${extra}">${icono(i, 15, 1.9)}${texto}</div>`;
const botonTexto = (i, texto, color = T.navy, titulo = '') =>
  `<span${tit(titulo)} style="height: 30px; display: inline-flex; align-items: center; gap: 6px; padding: 0 8px; border-radius: 8px; ${t(12.5, 16, 600, color, 'white-space: nowrap;')}">${icono(i, 14, 2)}${texto}</span>`;
const botonIcono = (i, color, titulo, s = 30) =>
  `<div title="${titulo}" style="width: ${s}px; height: ${s}px; flex-shrink: 0; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: ${color};">${icono(i, 16, 2)}</div>`;

// Segmentado (el de Usuarios, Estadísticas y Citas), con cuenta opcional.
const opcion = ([, texto, n], activa) => {
  const cuenta = n ? `<span style="${t(12, 16, 600, activa ? T.muted : T.muted, num)}">${miles(n)}</span>` : '';
  return activa
    ? `<div style="height: 30px; display: flex; align-items: center; gap: 7px; padding: 0 12px; border-radius: 8px; background: #ffffff; box-shadow: 0 0 0 1px ${navyA(0.08)}, 0 1px 2px ${navyA(0.12)}, 0 2px 6px -2px ${navyA(0.12)}; ${t(13, 16, 600, T.navy, 'white-space: nowrap;')}">${texto}${cuenta}</div>`
    : `<div style="height: 30px; display: flex; align-items: center; gap: 7px; padding: 0 12px; border-radius: 8px; ${t(13, 16, 600, T.muted, 'white-space: nowrap;')}">${texto}${cuenta}</div>`;
};
const segmentado = (opciones, activa, etiqueta = '') =>
  `<div${tit(etiqueta)} style="display: flex; align-items: center; gap: 2px; padding: 3px; border-radius: 11px; background: ${navyA(0.055)}; flex-shrink: 0;">${opciones.map((o) => opcion(o, o[0] === activa)).join('')}</div>`;

const buscador = (texto, ancho) => `
              <div style="position: relative; width: ${ancho}px; flex-shrink: 0;">
                <span style="position: absolute; left: 12px; top: 10px; color: ${T.muted};">${icono('search', 16, 1.75)}</span>
                <div style="height: 36px; border-radius: 10px; padding: 0 12px 0 38px; background: ${C.campo}; box-shadow: inset 0 0 0 1px ${navyA(0.1)}; ${t(13, 18, 400, T.muted, truncar)} display: flex; align-items: center;">${texto}</div>
              </div>`;

/** Campo (entrada o desplegable). Sin valor: ejemplo en pizarra. error: borde rojo + halo. */
const campo = ({ i = '', valor = '', ejemplo = '', mono = false, ancho = '100%', select = false, error = false, alto = 38, extra = '' }) => `
                <div style="width: ${typeof ancho === 'number' ? ancho + 'px' : ancho}; min-width: 0; height: ${alto}px; border-radius: 9px; background: #ffffff; box-shadow: inset 0 0 0 1px ${error ? GRAF.mal : C.borde}${error ? ', 0 0 0 3px rgba(220,38,38,.14)' : ''}; display: flex; align-items: center; gap: 9px; padding: 0 11px; ${extra}">
                  ${i ? ico(i, error ? TXT.mal : T.muted, 15, 1.75) : ''}<span style="min-width: 0; flex: 1; ${valor ? `${t(13, 18, 500, T.navy)} ${mono ? MONO + ' font-size: 12.5px;' : ''}` : t(13, 18, 400, error ? TXT.mal : T.muted)} ${truncar}">${valor || ejemplo}</span>${select ? ico('chevron-down', error ? TXT.mal : T.muted, 16, 2) : ''}
                </div>`;
const etiqueta = (texto, opc = '') => `<span style="${t(12.5, 16, 600, T.navy, 'white-space: nowrap;')}">${texto}${opc ? `<span style="font-weight: 400; color: ${T.muted};"> ${opc}</span>` : ''}</span>`;
const conEtiqueta = (etq, dentro, ayuda = '') => `
                <div style="min-width: 0; display: flex; flex-direction: column; gap: 7px;">${etq}${dentro}${ayuda ? `
                  <span style="${t(12, 16, 400, T.muted)}">${ayuda}</span>` : ''}
                </div>`;

/** Casilla (la de Configuración): marcada navy con visto blanco; vacía con contorno pizarra 500. */
const casilla = (on) => on
  ? `<span style="width: 18px; height: 18px; flex-shrink: 0; border-radius: 5px; background: ${T.navy}; color: #ffffff; display: flex; align-items: center; justify-content: center;">${icono('check', 12, 3)}</span>`
  : `<span style="width: 18px; height: 18px; flex-shrink: 0; border-radius: 5px; background: #ffffff; box-shadow: inset 0 0 0 1.5px ${T.slate500};"></span>`;

const token = (idx, tono = 'navy') => {
  const c = tono === 'mal' ? { f: FONDO.mal, b: FONDO.malBorde, x: TXT.mal } : { f: navyA(0.07), b: navyA(0.12), x: T.navy };
  return `<span style="display: inline-flex; align-items: center; height: 22px; padding: 0 7px; border-radius: 6px; background: ${c.f}; box-shadow: inset 0 0 0 1px ${c.b}; ${MONO} ${t(12, 16, 600, c.x, 'white-space: nowrap;')}">{{${idx}}}</span>`;
};

// Estados con icono + texto del color de su significado (nunca solo color).
const EST_ENVIO = {
  completed: ['circle-check', GRAF.ok, TXT.ok, 'Completado'], sent: ['circle-check', GRAF.ok, TXT.ok, 'Enviado'],
  processing: ['loader-circle', GRAF.curso, TXT.curso, 'Enviando'], failed: ['circle-x', GRAF.mal, TXT.mal, 'Fallido'],
  cancelled: ['ban', TXT.neutro, TXT.neutro, 'Cancelado'], draft: ['circle-dot', TXT.neutro, TXT.neutro, 'Borrador'],
};
const EST_DEST = { sent: ['circle-check', GRAF.ok, TXT.ok, 'Enviado'], failed: ['circle-x', GRAF.mal, TXT.mal, 'Fallido'], pending: ['clock', GRAF.aviso, TXT.aviso, 'Pendiente'] };
const EST_TPL = {
  APPROVED: ['circle-check', GRAF.ok, TXT.ok, 'Aprobada'], PENDING: ['clock', GRAF.aviso, TXT.aviso, 'En revisión'],
  REJECTED: ['circle-x', GRAF.mal, TXT.mal, 'Rechazada'], PAUSED: ['pause', GRAF.aviso, TXT.aviso, 'Pausada'], DISABLED: ['ban', TXT.neutro, TXT.neutro, 'Deshabilitada'],
};
const estado = ([i, cIco, cTxt, texto], tam = 13) =>
  `<span style="display: inline-flex; align-items: center; gap: 6px; ${t(tam, 18, 600, cTxt, 'white-space: nowrap;')}">${ico(i, cIco, 14, 2.25)}${texto}</span>`;
const CAT = { UTILITY: ['shield', 'Utilidad'], MARKETING: ['megaphone', 'Marketing'], AUTHENTICATION: ['key-round', 'Autenticación'] };

const banda = ({ i, titulo, texto, est = '', derecha = '', cuenta = '' }) => `
            <div style="height: ${H.banda}px; flex-shrink: 0; padding: 0 ${PH}px; display: flex; align-items: center; gap: 12px; background: ${C.banda}; border-bottom: 1px solid ${C.filete};">
              <span style="width: ${RANURA}px; flex-shrink: 0; display: flex; justify-content: center; color: ${T.navy};">${icono(i, 18, 1.75)}</span>
              <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 3px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <h2 style="${t(15, 20, 600, T.navy, 'letter-spacing: -.01em; white-space: nowrap;')}">${titulo}</h2>${cuenta ? `<span style="height: 20px; padding: 0 7px; border-radius: 6px; background: ${navyA(0.07)}; display: inline-flex; align-items: center; ${t(12, 16, 600, T.navy, num)}">${cuenta}</span>` : ''}${est}
                </div>
                <p style="${t(12.5, 16, 400, T.muted, truncar + num)}">${texto}</p>
              </div>${derecha ? `
              <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">${derecha}</div>` : ''}
            </div>`;

const aviso = (tipo, titulo, texto, { i = null, pad = X_TXT - RANURA - 12 } = {}) => {
  const c = { aviso: [FONDO.aviso, FONDO.avisoBorde, TXT.aviso, '#92400e', 'triangle-alert'], mal: [FONDO.mal, FONDO.malBorde, TXT.mal, '#991b1b', 'circle-x'], info: [FONDO.curso, FONDO.cursoBorde, TXT.curso, '#075985', 'info'] }[tipo];
  return `
                <div style="display: flex; align-items: flex-start; gap: 10px; padding: 11px 14px 12px ${Math.max(12, pad)}px; border-radius: 10px; background: ${c[0]}; box-shadow: inset 0 0 0 1px ${c[1]};">
                  <span style="display: flex; margin-top: 1px; color: ${c[2]};">${icono(i || c[4], 16, 2)}</span>
                  <div style="min-width: 0; display: flex; flex-direction: column; gap: 3px;">
                    ${titulo ? `<span style="${t(13, 18, 600, c[3])}">${titulo}</span>` : ''}
                    <span style="${t(12.5, 18, 400, c[3], num)}">${texto}</span>
                  </div>
                </div>`;
};

// ══ Cabecera y franja ═════════════════════════════════════════════════════════════════════════════
const PESTANAS = (n) => [['send', 'Enviar'], ['templates', 'Plantillas', n]];
const cabecera = (pestana = 'send', derecha = '') => `
        <div style="height: ${H.cab}px; flex-shrink: 0; display: flex; align-items: flex-start; justify-content: space-between; gap: 24px;">
          <div style="min-width: 0; display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; align-items: center; gap: 18px;">
              <h1 style="${t(28, 34, 600, T.navy, 'letter-spacing: -.025em; white-space: nowrap;')}">Envío masivo</h1>
              ${segmentado(PESTANAS(PLANTILLAS.length), pestana, 'Pestañas de Envío masivo')}
            </div>
            <p style="${t(14, 20, 400, T.muted, 'white-space: nowrap;')}">Campañas, plantillas aprobadas, progreso y resultados de destinatarios.</p>
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
const franjaEnvio = (activas = CIFRAS.activas) => franja([
  { marca: ico('send', T.navy), etq: 'Campañas', valor: miles(CIFRAS.campanas), detalle: `${CIFRAS.completadas} completadas · ${activas} ${activas === 1 ? 'activa' : 'activas'}` },
  { marca: ico('phone', GRAF.ok), etq: 'Destinatarios', valor: miles(CIFRAS.destinatarios), detalle: `${miles(CIFRAS.enviados)} enviados · ${miles(CIFRAS.pendientes)} pendientes` },
  { marca: ico('circle-alert', GRAF.mal), etq: 'Errores', valor: miles(CIFRAS.fallidos), detalle: `${CIFRAS.bloqueadas} campañas fallidas o canceladas` },
  { marca: ico('message-square-text', GRAF.curso), etq: 'Plantillas útiles', valor: miles(CIFRAS.utiles), detalle: `${punto(GRAF.aviso, 7)}<span style="color: ${TXT.aviso}; font-weight: 500;">${CIFRAS.revision} en revisión</span> · ${CIFRAS.rechazadas} rechazada` },
]);

// ══ Preparar un envío: pasos ══════════════════════════════════════════════════════════════════════
/** Número del paso: hecho = círculo esmeralda con visto; pendiente = número navy en círculo claro. */
const numeroPaso = (n, hecho) => hecho
  ? `<span title="Paso completo" style="width: 24px; height: 24px; border-radius: 9999px; background: ${GRAF.ok}; color: #ffffff; display: flex; align-items: center; justify-content: center;">${icono('check', 14, 3)}</span>`
  : `<span style="width: 24px; height: 24px; border-radius: 9999px; background: #ffffff; box-shadow: inset 0 0 0 1.5px ${C.borde}; display: flex; align-items: center; justify-content: center; ${t(12, 16, 600, T.navy, num)}">${n}</span>`;
const cabezaPaso = ({ n, titulo, hecho = false, estado: est = '', pad = PH }) => `
              <div style="height: ${H.paso}px; flex-shrink: 0; padding: 0 ${pad}px; display: flex; align-items: center; gap: 12px;">
                <span style="width: ${RANURA}px; flex-shrink: 0; display: flex; justify-content: center;">${numeroPaso(n, hecho)}</span>
                <h3 style="min-width: 0; flex: 1; ${t(15, 20, 600, T.navy, 'letter-spacing: -.01em; white-space: nowrap;')}">${titulo}</h3>
                ${est}
              </div>`;
const listo = (texto) => `<span style="display: inline-flex; align-items: center; gap: 6px; ${t(12.5, 16, 500, TXT.ok, 'white-space: nowrap;' + num)}">${punto(GRAF.ok, 7)}${texto}</span>`;
const falta = (texto) => `<span style="display: inline-flex; align-items: center; gap: 6px; ${t(12.5, 16, 600, TXT.mal, 'white-space: nowrap;' + num)}">${punto(GRAF.mal, 7)}${texto}</span>`;
const cuerpoPaso = (html, { final = false } = {}) => `
              <div style="padding: 0 28px 22px ${X_TXT}px; display: flex; flex-direction: column; gap: 16px;${final ? '' : ` border-bottom: 1px solid ${C.filete};`}">${html}
              </div>`;

// Paso 1 · Plantilla
const guiaExcel = () => `
                <div style="display: flex; flex-direction: column; gap: 10px; padding: 14px 16px 14px; border-radius: 12px; background: ${C.campo}; box-shadow: inset 0 0 0 1px ${C.filete};">
                  <div style="display: flex; align-items: center; gap: 8px;">${ico('file-spreadsheet', T.navy, 15, 1.9)}<span style="${t(13, 18, 600, T.navy)}">Así debe ser el Excel para esta plantilla</span></div>
                  <div style="display: grid; grid-template-columns: repeat(${GUIA.length - 1}, auto) minmax(0, 1fr); border-radius: 8px; overflow: hidden; box-shadow: 0 0 0 1px ${navyA(0.14)}; background: #ffffff;">
                    ${GUIA.map(([c], k) => `<span style="padding: 6px 8px; background: ${navyA(0.05)}; ${k ? `border-left: 1px solid ${navyA(0.12)};` : ''} border-bottom: 1px solid ${navyA(0.12)}; ${MONO} ${t(11.5, 16, 600, T.navy, 'white-space: nowrap;')}">${c}</span>`).join('')}
                    ${GUIA.map(([, v], k) => `<span style="padding: 6px 8px; ${k ? `border-left: 1px solid ${navyA(0.12)};` : ''} ${t(11.5, 16, 400, T.muted, truncar + num)}">${v}</span>`).join('')}
                  </div>
                  <span style="${t(12, 17, 400, T.muted)}">Cada columna va en su hueco: <span style="color: ${T.navy}; font-weight: 500;">especialidad</span> en «su cita de ___», <span style="color: ${T.navy}; font-weight: 500;">fecha</span> en «el día ___», <span style="color: ${T.navy}; font-weight: 500;">hora</span> en «a las ___» y <span style="color: ${T.navy}; font-weight: 500;">medico</span> en «con DR.(A) ___».</span>
                </div>`;
const paso1 = () => [
  cabezaPaso({ n: 1, titulo: 'Plantilla', hecho: true, estado: listo('Aprobada en Meta') }),
  cuerpoPaso(`
                <div style="display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); column-gap: 16px;">
                  ${conEtiqueta(etiqueta('Plantilla de WhatsApp'), campo({ i: 'message-square-text', valor: PLANTILLA.nombre, select: true }))}
                  ${conEtiqueta(etiqueta('Nombre del envío', '(opcional)'), campo({ i: 'edit-3', valor: ENVIO.nombre }))}
                </div>
                <div style="margin-top: -6px; display: flex; align-items: center; gap: 8px; ${t(12, 16, 400, T.muted, 'white-space: nowrap;')}">
                  <span style="${MONO} font-size: 12px; color: ${T.navy};">${PLANTILLA.meta}</span><span aria-hidden="true">·</span>${PLANTILLA.idiomaTxt}<span aria-hidden="true">·</span>${PLANTILLA.cat}
                  <span style="margin-left: auto; display: inline-flex; align-items: center; gap: 5px; ${t(12.5, 16, 600, T.navy)}">Ver texto original${icono('chevron-down', 14, 2)}</span>
                </div>
                ${guiaExcel()}`),
].join('');

// Paso 2 · Destinatarios
const archivoCargado = () => `
                <div style="display: flex; align-items: center; gap: 14px; padding: 12px 12px 12px 14px; border-radius: 12px; background: #ffffff; box-shadow: inset 0 0 0 1px ${navyA(0.14)};">
                  <span style="width: 38px; height: 38px; flex-shrink: 0; border-radius: 10px; background: ${FONDO.ok}; box-shadow: inset 0 0 0 1px ${FONDO.okBorde}; color: ${TXT.ok}; display: flex; align-items: center; justify-content: center;">${icono('file-spreadsheet', 18, 1.9)}</span>
                  <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 3px;">
                    <span style="display: flex; align-items: center; gap: 8px; ${t(13, 18, 500, T.navy, truncar + num)}"><span style="${MONO} font-size: 12.5px; font-weight: 600;">${ENVIO.archivo}</span><span style="color: ${TXT.ok}; font-weight: 600;">${miles(ENVIO.total)} números cargados</span></span>
                    <span style="${t(12, 16, 400, T.muted, truncar)}">Columnas extra: ${ENVIO.extra.join(', ')}</span>
                  </div>
                  ${botonSecundario('upload', 'Cambiar archivo', 'Arrastra otro archivo aquí o selecciónalo: reemplaza la lista')}
                </div>`;
const anadirMano = () => `
                <div style="display: grid; grid-template-columns: 150px minmax(0, 1fr) minmax(0, 1fr) auto; column-gap: 10px; align-items: center;">
                  ${etiqueta('Añadir un número')}
                  ${campo({ i: 'phone', ejemplo: '300 000 0000' })}
                  ${campo({ i: 'user', ejemplo: 'Nombre (opcional)' })}
                  ${botonSecundario('plus', 'Añadir')}
                </div>`;
const filaDestinatario = (d, k, final = false) => `
                    <div style="height: 46px; padding: 0 8px 0 12px; display: grid; grid-template-columns: 26px 118px minmax(0, 1fr) 30px; column-gap: 12px; align-items: center;${final ? '' : ` border-bottom: 1px solid ${C.filete};`}">
                      <span style="${t(12, 16, 500, T.muted, num + 'text-align: right;')}">${k}</span>
                      <span style="${MONO} ${t(12.5, 16, 600, T.navy, num + 'white-space: nowrap;')}">${d.tel}</span>
                      <div style="min-width: 0; display: flex; flex-direction: column; gap: 1px;">
                        <span style="${t(13, 18, 500, T.navy, truncar)}">${d.n}</span>
                        <span style="${t(12, 16, 400, TXT.curso, truncar + num)}">${d.p.join(' · ')}</span>
                      </div>
                      ${botonIcono('x', T.muted, 'Quitar de la lista')}
                    </div>`;
const listaDestinatarios = (n = 4) => `
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <div style="display: flex; align-items: center; justify-content: space-between;">
                    ${rotulo('Lista', `${miles(ENVIO.total)} destinatarios · se ven los primeros 100`)}
                    ${botonTexto('trash-2', 'Quitar todos', TXT.mal, 'Vacía la lista (no borra nada del archivo)')}
                  </div>
                  <div style="border-radius: 12px; box-shadow: inset 0 0 0 1px ${navyA(0.12)}; overflow: hidden;">
                    ${DESTINATARIOS.slice(0, n).map((d, k) => filaDestinatario(d, k + 1, k === n - 1)).join('')}
                  </div>
                  <span style="${t(12, 16, 400, T.muted, num)}">La lista enseña los primeros 100 para no hacer lenta la pantalla; el envío sale a los ${miles(ENVIO.total)}.</span>
                </div>`;
const paso2 = ({ filas = 4 } = {}) => [
  cabezaPaso({ n: 2, titulo: 'Destinatarios', hecho: true, estado: listo(`${miles(ENVIO.total)} destinatarios`) }),
  cuerpoPaso(`
                ${archivoCargado()}
                <span style="margin-top: -6px; display: flex; align-items: center; gap: 7px; ${t(12, 16, 400, T.muted)}">${ico('info', T.muted, 13, 2)}Excel o CSV. El teléfono puede venir como telefono, celular o pactel. Se quitan los repetidos y los de menos de 10 dígitos.</span>
                ${anadirMano()}
                ${listaDestinatarios(filas)}`),
].join('');

// Paso 3 · Datos del mensaje (column_mapping)
const filaMapeo = (m, { error = false, fijo = '' } = {}) => `
                  <div style="height: 50px; display: grid; grid-template-columns: 44px minmax(0, 1fr) 16px 260px; column-gap: 12px; align-items: center; border-bottom: 1px solid ${C.filete};">
                    ${token(m.idx, error ? 'mal' : 'navy')}
                    <span style="${t(12.5, 16, 400, T.muted, truncar)}">«…${m.antes} <span style="color: ${error ? TXT.mal : T.navy}; font-weight: 600;">___</span> ${m.despues}…»</span>
                    ${ico('arrow-right', T.muted, 15, 2)}
                    ${fijo ? `<div style="display: grid; grid-template-columns: 120px minmax(0, 1fr); column-gap: 8px;">${campo({ valor: 'Valor fijo', select: true, alto: 34 })}${campo({ valor: fijo, alto: 34 })}</div>`
                      : campo({ i: m.tipo === 'nombre' ? 'user' : 'columns-3', valor: error ? '' : m.origen, ejemplo: '— Selecciona el origen —', select: true, error, alto: 34 })}
                  </div>`;
const paso3 = ({ mapeo = MAPEO, errores = {}, avisos = ['La columna «sede» del archivo no se usará en el mensaje: verifica que no falte asignarla.'], estadoPaso = listo('5 de 5 con origen'), hecho = true, final = true, extraAvisos = '' } = {}) => [
  cabezaPaso({ n: 3, titulo: 'Datos de cada mensaje', hecho, estado: estadoPaso }),
  cuerpoPaso(`
                <span style="margin-top: -4px; ${t(12.5, 18, 400, T.muted)}">Cada hueco de la plantilla toma su valor de una columna del Excel, del nombre del contacto o de un valor fijo. Se asignan solos por su significado; revísalos.</span>
                <div style="display: flex; flex-direction: column; border-top: 1px solid ${C.filete};">
                  ${mapeo.map((m) => filaMapeo(m, errores[m.idx] || {})).join('')}
                </div>${avisos.map((a) => `
                <span style="display: flex; align-items: flex-start; gap: 7px; ${t(12.5, 18, 500, TXT.aviso)}"><span style="display: flex; margin-top: 1px; color: ${GRAF.aviso};">${icono('triangle-alert', 14, 2)}</span>${a}</span>`).join('')}${extraAvisos}`, { final }),
].join('');

// Paso 4 · Revisar y enviar (columna derecha)
const resaltar = (v) => `<span style="font-weight: 600; background: rgba(46,63,132,.07); border-radius: 3px; padding: 0 2px;">${v}</span>`;
const textoFinal = (valores = MAPEO.map((m) => m.valor), marca = {}) => PLANTILLA.cuerpo.replace(/\{\{(\d)\}\}/g, (_, i) => {
  const v = valores[Number(i) - 1];
  if (marca[i] === 'unset') return `<span style="font-weight: 600; color: ${TXT.mal}; background: ${FONDO.mal}; border-radius: 3px; padding: 0 2px;">[sin asignar]</span>`;
  return resaltar(v);
});
const burbuja = (html, { ancho = '100%', hora = '9:41' } = {}) => `
                <div style="padding: 14px 14px 16px; border-radius: 12px; background: #efeae2; box-shadow: inset 0 0 0 1px rgba(0,0,0,.05);">
                  <div style="position: relative; max-width: ${ancho}; padding: 9px 11px 7px; border-radius: 3px 10px 10px 10px; background: #ffffff; box-shadow: 0 1px 1px rgba(0,0,0,.1);">
                    <p style="${t(13.5, 20, 400, '#111b21')}">${html}</p>
                    <span style="display: block; margin-top: 2px; text-align: right; ${t(11, 14, 400, '#54656f', num)}">${hora}</span>
                  </div>
                </div>`;
const comprobacion = (tipo, texto) => {
  const [i, c, x] = { ok: ['circle-check', GRAF.ok, T.navy], aviso: ['triangle-alert', GRAF.aviso, TXT.aviso], mal: ['circle-x', GRAF.mal, TXT.mal] }[tipo];
  return `<div style="display: flex; align-items: flex-start; gap: 9px; ${t(12.5, 18, tipo === 'ok' ? 400 : 500, x)}"><span style="display: flex; margin-top: 1px; color: ${c};">${icono(i, 15, 2)}</span><span>${texto}</span></div>`;
};
const COMPROBACIONES_OK = [
  ['ok', 'Plantilla aprobada y con 5 datos variables'],
  ['ok', 'Cada dato variable tiene de dónde salir'],
  ['ok', 'Fecha, hora y médico caen en su hueco'],
  ['aviso', 'La columna «sede» del archivo no se usa'],
];
const panelEnvio = ({ comprobaciones = COMPROBACIONES_OK, boton = null, texto = textoFinal(), nota = 'Al pulsar se abre la confirmación con esta vista previa. Nada sale sin confirmar.' } = {}) => `
            <div style="width: ${ANCHO_PANEL}px; flex-shrink: 0; display: flex; flex-direction: column; background: ${C.panel}; border-left: 1px solid ${C.filete};">
              ${cabezaPaso({ n: 4, titulo: 'Revisar y enviar', pad: 16 })}
              <div style="padding: 0 24px 24px ${16 + RANURA + 12}px; display: flex; flex-direction: column; gap: 16px;">
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <span style="${t(12.5, 16, 500, T.muted, truncar)}">Así le llegará a <span style="color: ${T.navy}; font-weight: 600;">${nombrePropio(PRIMERO.n)}</span>:</span>
                  ${burbuja(texto)}
                </div>
                <div style="display: flex; flex-direction: column; gap: 9px;">
                  ${rotulo('Comprobaciones')}
                  ${comprobaciones.map(([k, x]) => comprobacion(k, x)).join('')}
                </div>
                <div style="height: 1px; background: ${C.fileteFondo};"></div>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                  ${boton || botonPrimario('send', `Enviar a ${miles(ENVIO.total)} destinatarios…`, 'Abre la confirmación', 'width: 100%; height: 42px; font-size: 14px;')}
                  <span style="${t(12, 17, 400, T.muted)}">${nota}</span>
                </div>
              </div>
            </div>`;

const TXT_BANDA_PREP = 'Elige la plantilla, carga a quién va y revisa cómo llega. Solo puede haber un envío a la vez.';
const seccionPreparar = ({ filas = 4 } = {}) => `
            ${banda({ i: 'send', titulo: 'Preparar un envío', texto: TXT_BANDA_PREP })}
            <div style="display: flex; align-items: stretch;">
              <div style="min-width: 0; flex: 1; display: flex; flex-direction: column;">
                ${paso1()}
                ${paso2({ filas })}
                ${paso3()}
              </div>
              ${panelEnvio()}
            </div>`;

// ══ Historial ═════════════════════════════════════════════════════════════════════════════════════
const COLS_HIST = 'minmax(0, 1.8fr) 112px 150px 166px minmax(0, 1fr) 122px 16px';
const th = (x, der = false) => `<span style="${t(11, 16, 600, T.muted, 'text-transform: uppercase; letter-spacing: .07em; white-space: nowrap;' + (der ? ' text-align: right;' : ''))}">${x}</span>`;
const barra = (ok, mal, total, alto = 6) => `
                  <div style="height: ${alto}px; border-radius: 9999px; background: ${GRAF.pista}; overflow: hidden; display: flex; gap: 1px;">
                    <div style="width: ${(ok / total) * 100}%; background: ${GRAF.ok};"></div>
                    ${mal ? `<div style="width: ${(mal / total) * 100}%; min-width: 2px; background: ${GRAF.mal};"></div>` : ''}
                  </div>`;
const resultado = (ok, mal, pend) => `
                <div style="display: flex; align-items: center; gap: 12px; ${t(12.5, 16, 600, T.navy, num + 'white-space: nowrap;')}">
                  <span title="Enviados" style="display: inline-flex; align-items: center; gap: 5px; color: ${TXT.ok};">${icono('check', 13, 2.5)}${miles(ok)}</span>
                  <span title="Fallidos" style="display: inline-flex; align-items: center; gap: 5px; color: ${mal ? TXT.mal : T.muted};">${icono('x', 13, 2.5)}${miles(mal)}</span>
                  <span title="Pendientes" style="display: inline-flex; align-items: center; gap: 5px; color: ${pend ? TXT.aviso : T.muted};">${icono('clock', 13, 2.25)}${miles(pend)}</span>
                </div>`;
const filaHist = (h, final = false) => {
  const pct = Math.round(((h.ok + h.mal) / h.total) * 100);
  return `
            <div title="Ver el detalle del envío" style="height: 58px; flex-shrink: 0; padding: 0 ${PH}px 0 ${X_TXT}px; display: grid; grid-template-columns: ${COLS_HIST}; column-gap: 20px; align-items: center;${final ? '' : ` border-bottom: 1px solid ${C.filete};`}">
              <div style="min-width: 0; display: flex; flex-direction: column; gap: 2px;">
                <span style="${t(13.5, 18, 600, h.sinNombre ? T.muted : T.navy, truncar)}">${h.n}</span>
                <span style="${MONO} ${t(12, 16, 400, T.muted, truncar)}">${h.tpl}</span>
              </div>
              ${estado(EST_ENVIO[h.st])}
              <div style="display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; justify-content: space-between; ${t(12, 16, 500, T.muted, num)}"><span style="color: ${T.navy}; font-weight: 600;">${pct} %</span><span>${miles(h.total)} en total</span></div>
                ${barra(h.ok, h.mal, h.total)}
              </div>
              ${resultado(h.ok, h.mal, Math.max(0, h.total - h.ok - h.mal))}
              <span style="${t(13, 18, 400, T.navy, truncar)}">${h.quien}</span>
              <span style="${t(12.5, 16, 400, T.muted, num + 'white-space: nowrap;')}">${h.f}</span>
              ${ico('chevron-right', T.muted, 16, 2)}
            </div>`;
};
const FILTROS_HIST = [['all', 'Todos', 48], ['processing', 'Enviando', 0], ['completed', 'Completados', 45], ['failed', 'Fallidos', 1], ['cancelled', 'Cancelados', 2]];
const barraHist = (texto = 'Buscar nombre, teléfono o plantilla', activo = 'all', filtros = FILTROS_HIST) => `
            <div style="height: 60px; flex-shrink: 0; padding: 0 ${PH}px 0 ${X_TXT}px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid ${C.filete};">
              ${segmentado(filtros, activo, 'Filtrar por estado')}
              ${texto.trim().startsWith('<') ? texto : buscador(texto, 340)}
            </div>`;
const cabezaHist = `
            <div style="height: ${H.thead}px; flex-shrink: 0; padding: 0 ${PH}px 0 ${X_TXT}px; display: grid; grid-template-columns: ${COLS_HIST}; column-gap: 20px; align-items: center; background: ${C.banda}; border-bottom: 1px solid ${C.filete};">
              ${th('Envío')}${th('Estado')}${th('Progreso')}${th('Resultado')}${th('Responsable')}${th('Fecha')}<span></span>
            </div>`;
const seccionHistorial = () => `
            ${banda({ i: 'clock', titulo: 'Historial de envíos', cuenta: '48', texto: 'Ordenado desde el envío más reciente. Pulsa uno para ver sus destinatarios, uno por uno.' })}
            ${barraHist()}
            ${cabezaHist}
            ${HISTORIAL.map((h, k) => filaHist(h, false)).join('')}
            <div style="height: 48px; flex-shrink: 0; padding: 0 ${PH}px 0 ${X_TXT}px; display: flex; align-items: center; gap: 8px; ${t(12.5, 16, 400, T.muted, num)}">${ico('ellipsis', T.muted, 16, 2)}La lista sigue con los 38 envíos anteriores, del más reciente al más antiguo.</div>`;

// ══ Main y Completa ═══════════════════════════════════════════════════════════════════════════════
const VELO = 44;
const hojaRecortada = (html, { velo = true } = {}) => `
        <div style="position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; border-radius: 16px 16px 0 0; background: ${C.hoja}; box-shadow: ${sombraHoja}; overflow: hidden;">
          ${html}${velo ? `
          <div style="position: absolute; left: 0; right: ${ANCHO_PANEL}px; bottom: 0; height: ${VELO}px; z-index: 5; background: linear-gradient(180deg, rgba(255,255,255,0), #ffffff 88%); pointer-events: none;"></div>` : ''}
        </div>`;
const pantalla = (html) => `
      <div style="position: absolute; inset: 0; padding: ${PAD}px ${PAD}px 0; display: flex; flex-direction: column; gap: ${GAP}px;">${html}
      </div>`;

const escribir = (nombre, html, medida) => {
  fs.writeFileSync(path.join(DIR, nombre), html);
  console.log(`  ${nombre.padEnd(20)} ${String(Buffer.byteLength(html)).padStart(7)} bytes  (${medida})`);
};

escribir('Main.dc.html', documento(carcasaMarco({ activo: 'bulk', ancho: 1440, contenido: pantalla(`
        ${cabecera('send')}
        ${franjaEnvio()}
        ${hojaRecortada(seccionPreparar({ filas: 4 }))}`) })), `1440x900, isla ${ISLA.ancho}x${ISLA.alto}`);

// Altos medidos en el navegador (document.body.scrollHeight de la vista previa): se fijan para que el
// lienzo no baile. Si cambia el contenido, se vuelven a medir.
const ALTOS = { Completa: 2420, Estados: 2898, Dialogos: 1116 };
const islaSuelta = (nombre, html) => `
<div data-artboard="${nombre}" style="position: relative; width: ${ISLA.ancho}px;${ALTOS[nombre] ? ` height: ${ALTOS[nombre]}px;` : ''} overflow: hidden; border-radius: ${RADIO_ISLA}px; background: ${T.bg}; font-family: ${T.font};">
      <div style="padding: ${PAD}px; display: flex; flex-direction: column; gap: ${GAP}px;">${html}
      </div>
</div>`;
const hojaEntera = (html) => `
        <div style="display: flex; flex-direction: column; border-radius: 16px; background: ${C.hoja}; box-shadow: ${sombraHoja}; overflow: hidden;">${html}
        </div>`;

escribir('Completa.dc.html', documento(islaSuelta('Completa', `
        ${cabecera('send')}
        ${franjaEnvio()}
        ${hojaEntera(seccionPreparar({ filas: 6 }) + `<div style="height: 1px; background: ${C.fileteFondo};"></div>` + seccionHistorial())}`)), `${ISLA.ancho} x ${ALTOS.Completa || '?'}`);

// ══ Detalle (show) ════════════════════════════════════════════════════════════════════════════════
const cabeceraDetalle = `
        <div style="flex-shrink: 0; display: flex; flex-direction: column; gap: 10px;">
          <span style="display: inline-flex; align-items: center; gap: 6px; ${t(13, 18, 600, T.navy, 'white-space: nowrap;')}">${icono('arrow-left', 15, 2)}Volver a envíos masivos</span>
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 24px;">
            <div style="min-width: 0; display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; align-items: center; gap: 16px;">
                <h1 style="${t(28, 34, 600, T.navy, 'letter-spacing: -.025em; white-space: nowrap;')}">${DET.n}</h1>
                <span style="height: 28px; padding: 0 11px 0 9px; border-radius: 8px; background: ${FONDO.ok}; box-shadow: inset 0 0 0 1px ${FONDO.okBorde}; display: inline-flex; align-items: center;">${estado(EST_ENVIO.completed, 13)}</span>
              </div>
              <p style="display: flex; align-items: center; gap: 8px; ${t(14, 20, 400, T.muted, 'white-space: nowrap;' + num)}"><span style="${MONO} font-size: 13px; font-weight: 600; color: ${T.navy};">${DET.tpl}</span><span aria-hidden="true">·</span>${DET.quien}<span aria-hidden="true">·</span>${DET.f}</p>
            </div>
          </div>
        </div>`;
const franjaDetalle = franja([
  { marca: ico('phone', T.navy), etq: 'Total', valor: miles(DET.total), detalle: 'destinatarios en este envío' },
  { marca: ico('circle-check', GRAF.ok), etq: 'Enviados', valor: miles(DET.ok), detalle: `<span style="color: ${TXT.ok}; font-weight: 600;">${DET.exito} % de éxito</span>` },
  { marca: ico('circle-x', GRAF.mal), etq: 'Fallidos', valor: miles(DET.mal), detalle: 'no llegaron al paciente' },
  { marca: ico('clock', GRAF.aviso), etq: 'Pendientes', valor: miles(DET.pendientes), detalle: 'por salir' },
  { marca: ico('circle-alert', GRAF.mal), etq: 'Con error', valor: miles(DET.conError), detalle: 'con motivo registrado' },
]);
const mensajeEnviado = `
            <div style="flex-shrink: 0; padding: 14px ${PH}px 16px; display: flex; align-items: flex-start; gap: 12px; border-bottom: 1px solid ${C.filete};">
              <span style="width: ${RANURA}px; flex-shrink: 0; display: flex; justify-content: center; padding-top: 2px; color: ${T.navy};">${icono('message-square-text', 18, 1.75)}</span>
              <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 8px;">
                ${rotulo('Mensaje enviado', 'el texto de la plantilla; cada {{N}} se llenó con los datos de cada destinatario')}
                <p style="${t(13.5, 22, 400, T.navy)}">${PLANTILLA.cuerpo.replace(/\{\{(\d)\}\}/g, (_, i) => token(i))}</p>
              </div>
            </div>`;
const FILTROS_DET = [['all', 'Todos', DET.total], ['sent', 'Enviados', DET.ok], ['failed', 'Fallidos', DET.mal], ['pending', 'Pendientes', 0]];
const COLS_DET = '30px minmax(0, 1.25fr) 96px 84px 70px minmax(0, 1fr) minmax(0, .95fr) minmax(0, 1.55fr)';
const cabezaDet = `
            <div style="height: ${H.thead}px; flex-shrink: 0; padding: 0 ${PH}px; display: grid; grid-template-columns: ${COLS_DET}; column-gap: 16px; align-items: center; background: ${C.banda}; border-bottom: 1px solid ${C.filete};">
              ${th('#', true)}${th('Destinatario')}${th('especialidad')}${th('fecha')}${th('hora')}${th('medico')}${th('sede')}${th('Resultado')}
            </div>`;
const filaDet = (r, k) => {
  const [i, cI, cT, texto] = EST_DEST[r.st];
  return `
            <div style="height: ${H.fila}px; flex-shrink: 0; padding: 0 ${PH}px; display: grid; grid-template-columns: ${COLS_DET}; column-gap: 16px; align-items: center; border-bottom: 1px solid ${C.filete};">
              <span style="${t(12.5, 16, 500, T.muted, num + 'text-align: right;')}">${k}</span>
              <div style="min-width: 0; display: flex; flex-direction: column; gap: 2px;">
                <span style="${t(13, 18, 600, T.navy, truncar)}">${nombrePropio(r.n)}</span>
                <span style="display: flex; align-items: center; gap: 5px; ${MONO} ${t(12, 16, 400, T.muted, num + truncar)}">${icono('phone', 12, 2)}${r.tel}</span>
              </div>
              ${r.p.map((v, j) => `<span style="${t(12.5, 16, 400, v ? (j === 3 ? T.navy : T.muted) : T.muted, truncar + num)}">${v || '—'}</span>`).join('')}
              <div style="min-width: 0; display: flex; flex-direction: column; gap: 2px;">
                <span style="display: inline-flex; align-items: center; gap: 6px; ${t(12.5, 16, 600, cT, 'white-space: nowrap;')}">${ico(i, cI, 13, 2.25)}${texto}</span>
                ${r.err ? `<span title="${r.err.replace(/"/g, '')}" style="padding-left: 19px; ${t(12, 16, 400, TXT.mal, truncar)}">${r.err}</span>`
                  : `<span style="padding-left: 19px; ${t(12, 16, 400, T.muted, num + truncar)}">${r.cuando} · sin error</span>`}
              </div>
            </div>`;
};
const hojaDetalle = `
          ${mensajeEnviado}
          ${banda({ i: 'users', titulo: 'Destinatarios', cuenta: miles(DET.total), texto: 'Fallidos primero, luego pendientes y enviados.',
    derecha: segmentado(FILTROS_DET, 'all', 'Filtrar por estado') + buscador('Buscar nombre, teléfono, dato o error', 270) })}
          ${cabezaDet}
          ${FILAS_DET.map((r, k) => filaDet(r, k + 1)).join('')}`;
escribir('Detalle.dc.html', documento(carcasaMarco({ activo: 'bulk', ancho: 1440, contenido: `
      <div style="position: absolute; inset: 0; padding: ${PAD - 4}px ${PAD}px 0; display: flex; flex-direction: column; gap: 22px;">
        ${cabeceraDetalle}
        ${franjaDetalle}
        <div style="position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; border-radius: 16px 16px 0 0; background: ${C.hoja}; box-shadow: ${sombraHoja}; overflow: hidden;">
          ${hojaDetalle}
          <div style="position: absolute; left: 0; right: 0; bottom: 0; height: ${VELO}px; z-index: 5; background: linear-gradient(180deg, rgba(255,255,255,0), #ffffff 88%); pointer-events: none;"></div>
        </div>
      </div>` })), '1440x900');

// ══ Plantillas (pestaña) ══════════════════════════════════════════════════════════════════════════
const cuenta = (s) => PLANTILLAS.filter((p) => p[4] === s).length;
const franjaPlantillas = franja([
  { marca: ico('message-square-text', T.navy), etq: 'Registradas', valor: miles(PLANTILLAS.length), detalle: `${cuenta('REJECTED')} rechazada · ${cuenta('PAUSED')} pausada · ${cuenta('DISABLED')} deshabilitada` },
  { marca: ico('circle-check', GRAF.ok), etq: 'Aprobadas', valor: miles(cuenta('APPROVED')), detalle: 'aprobadas y activas' },
  { marca: ico('clock', GRAF.aviso), etq: 'En revisión', valor: miles(cuenta('PENDING')), detalle: `${punto(GRAF.aviso, 7)}<span style="color: ${TXT.aviso}; font-weight: 500;">Meta tarda de minutos a 24 horas</span>` },
  { marca: ico('send', GRAF.curso), etq: 'Usables en envío', valor: miles(CIFRAS.utiles), detalle: 'aparecen en el paso 1 de Enviar' },
]);
const COLS_TPL = 'minmax(0, 1.7fr) 116px 84px 124px minmax(0, 1.2fr) 100px 30px';
const cabezaTpl = `
            <div style="height: ${H.thead}px; flex-shrink: 0; padding: 0 ${PH}px 0 ${X_TXT}px; display: grid; grid-template-columns: ${COLS_TPL}; column-gap: 20px; align-items: center; background: ${C.banda}; border-bottom: 1px solid ${C.filete};">
              ${th('Plantilla')}${th('Categoría')}${th('Idioma')}${th('Estado en Meta')}${th('Vista previa')}${th('Creada')}<span></span>
            </div>`;
const filaTpl = ([nombre, meta, cat, idioma, st, prev, creada], resalte = false) => `
            <div style="height: ${H.fila}px; flex-shrink: 0; padding: 0 ${PH}px 0 ${X_TXT}px; display: grid; grid-template-columns: ${COLS_TPL}; column-gap: 20px; align-items: center; border-bottom: 1px solid ${C.filete};${resalte ? ` background: ${FONDO.mal};` : ''}">
              <div style="min-width: 0; display: flex; flex-direction: column; gap: 2px;">
                <span style="${t(13.5, 18, 600, T.navy, truncar)}">${nombre}</span>
                <span style="${MONO} ${t(12, 16, 400, T.muted, truncar)}">${meta}</span>
              </div>
              <span style="display: inline-flex; align-items: center; gap: 6px; ${t(12.5, 16, 500, T.navy, 'white-space: nowrap;')}">${ico(CAT[cat][0], T.muted, 14, 1.9)}${CAT[cat][1]}</span>
              <span style="display: inline-flex; align-items: center; gap: 6px; ${t(12.5, 16, 500, T.navy, 'white-space: nowrap;')}">${ico('globe', T.muted, 14, 1.9)}${idioma}</span>
              ${estado(EST_TPL[st], 12.5)}
              <span style="${t(12.5, 16, 400, T.muted, truncar)}">${prev}</span>
              <span style="${t(12.5, 16, 400, T.muted, num + 'white-space: nowrap;')}">${creada}</span>
              ${botonIcono('trash-2', T.muted, 'Eliminar plantilla… (pide confirmación)')}
            </div>`;
const hojaPlantillas = `
          ${banda({ i: 'message-square-text', titulo: 'Catálogo de plantillas', cuenta: String(PLANTILLAS.length), texto: 'Estados de Meta. Una plantilla nueva va a revisión; al aprobarse, sincroniza para poder usarla.',
    derecha: botonSecundario('refresh-cw', 'Sincronizar con Meta', 'Trae de Meta los estados y las plantillas nuevas') + botonPrimario('file-plus-2', 'Crear plantilla') })}
          ${cabezaTpl}
          ${PLANTILLAS.map((p) => filaTpl(p)).join('')}`;
escribir('Plantillas.dc.html', documento(carcasaMarco({ activo: 'bulk', ancho: 1440, contenido: pantalla(`
        ${cabecera('templates')}
        ${franjaPlantillas}
        <div style="position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; border-radius: 16px 16px 0 0; background: ${C.hoja}; box-shadow: ${sombraHoja}; overflow: hidden;">
          ${hojaPlantillas}
          <div style="position: absolute; left: 0; right: 0; bottom: 0; height: ${VELO}px; z-index: 5; background: linear-gradient(180deg, rgba(255,255,255,0), #ffffff 88%); pointer-events: none;"></div>
        </div>`) })), '1440x900');

// ══ Estados ═══════════════════════════════════════════════════════════════════════════════════════
const pie = (n, titulo, texto) => `
          <div style="display: flex; align-items: baseline; gap: 12px; padding: 0 4px; margin-bottom: -10px;">
            <span style="${t(12, 16, 600, T.navy, num + 'white-space: nowrap;')}">${n}</span>
            <span style="${t(14, 20, 600, T.navy, 'white-space: nowrap;')}">${titulo}</span>
            <span style="${t(13, 18, 400, T.muted, truncar)}">${texto}</span>
          </div>`;
const hoja = (html, extra = '') => `
          <div style="position: relative; display: flex; flex-direction: column; border-radius: 16px; background: ${C.hoja}; box-shadow: ${sombraHoja}; overflow: hidden; ${extra}">${html}
          </div>`;
const dialogo = ({ ancho, i, tono = 'navy', titulo, cuerpo, botones, cerrar = false }) => {
  const ic = tono === 'mal' ? `background: ${FONDO.mal}; box-shadow: inset 0 0 0 1px ${FONDO.malBorde}; color: ${TXT.mal};` : `background: ${navyA(0.08)}; color: ${T.navy};`;
  return `
            <div style="width: ${ancho}px; flex-shrink: 0; border-radius: 16px; background: #ffffff; box-shadow: ${sombraDialogo}; overflow: hidden;">
              <div style="padding: 20px 24px 0; display: flex; align-items: center; gap: 14px;">
                <span style="width: 38px; height: 38px; flex-shrink: 0; border-radius: 10px; ${ic} display: flex; align-items: center; justify-content: center;">${icono(i, 18, 2)}</span>
                <span style="flex: 1; ${t(16.5, 22, 600, T.navy, 'letter-spacing: -.01em;')}">${titulo}</span>
                ${cerrar ? botonIcono('x', T.muted, 'Cerrar') : ''}
              </div>
              <div style="padding: 16px 24px 20px; display: flex; flex-direction: column; gap: 14px;">${cuerpo}
              </div>
              <div style="padding: 14px 24px; display: flex; align-items: center; justify-content: flex-end; gap: 8px; background: ${C.banda}; border-top: 1px solid ${C.filete};">${botones}
              </div>
            </div>`;
};

// 1. Envío en curso (el formulario de preparar se oculta mientras tanto, como hoy).
const CURSO = { n: ENVIO.nombre, tpl: PLANTILLA.meta, total: 1284, ok: 771, mal: 15 };
CURSO.pend = CURSO.total - CURSO.ok - CURSO.mal; CURSO.pct = Math.round(((CURSO.ok + CURSO.mal) / CURSO.total) * 100);
const leyenda = (p) => `
                <div style="display: flex; align-items: center; gap: 22px; ${t(13, 18, 500, T.navy, num + 'white-space: nowrap;')}">
                  <span style="display: flex; align-items: center; gap: 8px;">${punto(GRAF.ok, 9, 2.5)}Enviados <span style="font-weight: 600;">${miles(p.ok)}</span></span>
                  <span style="display: flex; align-items: center; gap: 8px;">${punto(GRAF.mal, 9, 2.5)}Fallidos <span style="font-weight: 600;">${miles(p.mal)}</span></span>
                  <span style="display: flex; align-items: center; gap: 8px;"><span style="width: 9px; height: 9px; flex-shrink: 0; border-radius: 2.5px; background: ${GRAF.pista}; box-shadow: inset 0 0 0 1px ${navyA(0.32)};"></span>Pendientes <span style="font-weight: 600;">${miles(p.pend)}</span></span>
                </div>`;
const chipEnviando = `<span style="display: inline-flex; align-items: center; gap: 6px; ${t(12.5, 16, 600, TXT.curso, 'white-space: nowrap;')}">${ico('loader-circle', GRAF.curso, 14, 2.25)}Enviando</span>`;
const bloqueCurso = (conDialogo = false) => `
            ${banda({ i: 'send', titulo: 'Envío en curso', est: chipEnviando, texto: `${CURSO.n} · plantilla ${CURSO.tpl}. Sale en segundo plano: puedes salir de esta pantalla.`,
    derecha: botonPeligro('square', 'Detener…', 'Pide confirmación antes de detener') })}
            <div style="flex-shrink: 0; padding: 18px ${PH}px 20px ${X_TXT}px; display: flex; flex-direction: column; gap: 14px; border-bottom: 1px solid ${C.filete};">
              <div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 24px;">
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  ${rotulo('Progreso del envío', 'se actualiza solo cada 3 segundos')}
                  <div style="display: flex; align-items: baseline; gap: 12px;">
                    <span style="${t(30, 36, 500, T.navy, num + 'letter-spacing: -.03em;')}">${CURSO.pct} %</span>
                    <span style="${t(14, 20, 400, T.muted, num)}"><span style="font-weight: 600; color: ${T.navy};">${miles(CURSO.ok + CURSO.mal)}</span> de ${miles(CURSO.total)} mensajes procesados</span>
                  </div>
                </div>
                <div style="padding-bottom: 6px;">${leyenda(CURSO)}</div>
              </div>
              ${barra(CURSO.ok, CURSO.mal, CURSO.total, 10)}
            </div>
            <div style="height: 48px; flex-shrink: 0; padding: 0 ${PH}px; display: flex; align-items: center; gap: 12px;">
              <span style="width: ${RANURA}px; flex-shrink: 0; display: flex; justify-content: center; color: ${T.muted};">${icono('info', 15, 1.9)}</span>
              <span style="${t(12.5, 16, 400, T.muted)}">Mientras sale este envío no se puede preparar otro. Al terminar o al detenerlo vuelve el formulario.</span>
            </div>${conDialogo ? `
            <div style="position: absolute; inset: 0; z-index: 10; background: ${navyA(0.28)};"></div>
            <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 12;">${dialogo({ ancho: 480, i: 'square', tono: 'mal', titulo: '¿Detener este envío?',
    cuerpo: `
                <span style="${t(13.5, 20, 400, T.muted, num)}">Se cancelan los <span style="font-weight: 600; color: ${T.navy};">${miles(CURSO.pend)}</span> mensajes que faltan por salir. Los ${miles(CURSO.ok + CURSO.mal)} ya procesados no se deshacen.</span>
                <span style="${t(13.5, 20, 400, T.muted)}">Los cancelados quedan como fallidos con el motivo «Envío cancelado por el usuario».</span>`,
    botones: botonSecundario('play', 'Seguir enviando') + botonPeligroLleno('square', 'Sí, detener el envío') })}</div>` : ''}`;

// 2. Confirmar envío (hoy ya existe; se conserva entero).
const dialogoConfirmar = dialogo({ ancho: 620, i: 'send', titulo: 'Confirmar envío masivo', cerrar: true,
  cuerpo: `
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                  <span style="height: 28px; padding: 0 11px 0 9px; border-radius: 8px; background: ${navyA(0.06)}; display: inline-flex; align-items: center; gap: 7px; ${t(13, 18, 600, T.navy, num)}">${icono('phone', 14, 2)}${miles(ENVIO.total)} destinatarios</span>
                  <span style="height: 28px; padding: 0 11px 0 9px; border-radius: 8px; background: ${navyA(0.06)}; display: inline-flex; align-items: center; gap: 7px; ${t(13, 18, 600, T.navy)}">${icono('message-square-text', 14, 2)}${PLANTILLA.nombre}</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <span style="${t(12.5, 16, 500, T.muted)}">Así llegará el mensaje a <span style="color: ${T.navy}; font-weight: 600;">${PRIMERO.n}</span>:</span>
                  ${burbuja(textoFinal(), { ancho: '480px' })}
                </div>
                ${aviso('aviso', '', 'La columna «sede» del archivo no se usará en el mensaje: verifica que no falte asignarla.')}
                <div style="display: flex; align-items: flex-start; gap: 11px; padding: 12px 14px; border-radius: 10px; background: ${navyA(0.035)}; box-shadow: inset 0 0 0 1px ${navyA(0.12)};">
                  <span style="margin-top: 1px;">${casilla(true)}</span>
                  <span style="${t(13.5, 20, 400, T.navy)}">Leí la vista previa y confirmo que <span style="font-weight: 600;">fechas, horas y nombres están en su lugar correcto</span>.</span>
                </div>`,
  botones: botonSecundario('x', 'Cancelar') + botonPrimario('send', `Confirmar y enviar a ${miles(ENVIO.total)}`, 'Se activa al marcar la casilla') });

// 3. Faltan datos: un hueco sin origen, un valor fijo y datos cruzados. El botón se apaga y dice por qué.
const MAPEO_MAL = [MAPEO[0], MAPEO[1], { ...MAPEO[2], origen: 'Columna: hora' }, MAPEO[3], MAPEO[4]];
const pasoMal = () => `
            <div style="display: flex; align-items: stretch;">
              <div style="min-width: 0; flex: 1; display: flex; flex-direction: column;">
                ${paso3({ mapeo: MAPEO_MAL, errores: { 5: { error: true }, 2: { fijo: 'ginecología' } }, hecho: false, estadoPaso: falta('Falta 1 dato por asignar'),
    avisos: ['La columna «hora» está asignada a más de un dato.', 'La columna «fecha» del archivo no se usará en el mensaje: verifica que no falte asignarla.'], extraAvisos: `
                ${aviso('mal', 'Posibles datos cruzados — revisa antes de enviar:', '{{3}} va en un contexto de FECHA pero recibirá una hora: «7:40 AM».', { pad: 14 })}` })}
              </div>
              ${panelEnvio({
    texto: textoFinal([PRIMERO.n, 'ginecología', '7:40 AM', '7:40 AM', ''], { 5: 'unset' }),
    comprobaciones: [['ok', 'Plantilla aprobada y con 5 datos variables'], ['mal', 'Falta asignar el origen de {{5}}'], ['mal', 'Hay una hora donde va una fecha ({{3}})'], ['aviso', 'La columna «hora» está en dos datos y «fecha» sin usar']],
    boton: botonApagado('send', `Enviar a ${miles(ENVIO.total)} destinatarios…`, 'Asigna un origen a cada dato {{N}} antes de enviar', 'width: 100%; height: 42px; font-size: 14px;'),
    nota: `<span style="color: ${TXT.mal}; font-weight: 500;">Asigna un origen a cada dato {{N}} antes de enviar.</span>` })}
            </div>`;

// 4. Avisos de la plantilla elegida y parámetros fijos (plantillas sin {{N}}).
const avisosPlantilla = `
            <div style="padding: 20px ${PH}px 22px ${X_TXT}px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 24px; align-items: start;">
              <div style="display: flex; flex-direction: column; gap: 10px;">
                ${rotulo('Plantilla mal construida')}
                ${aviso('mal', 'Esta plantilla está mal construida — no la uses', 'Contiene los marcadores de la vista previa como texto fijo ([sin asignar]  [nombre del contacto]) y no tiene ningún dato variable. El paciente los leería tal cual. Elige otra plantilla y pide que se corrija en Meta Business Manager.', { pad: 14 })}
              </div>
              <div style="display: flex; flex-direction: column; gap: 10px;">
                ${rotulo('Plantilla sin datos variables')}
                ${aviso('aviso', 'Esta plantilla no tiene parámetros', 'Todos reciben exactamente el mismo texto. El Excel solo necesita la columna del teléfono; las demás se ignoran.', { pad: 14 })}
                <div style="display: flex; flex-direction: column; gap: 8px; padding-top: 4px;">
                  ${etiqueta('Parámetros de la plantilla', '(opcionales)')}
                  <div style="display: grid; grid-template-columns: 40px minmax(0, 1fr) 30px; column-gap: 10px; align-items: center;">${token(1)}${campo({ valor: 'Hospital Universitario del Valle', alto: 34 })}${botonIcono('x', T.muted, 'Quitar')}</div>
                  <div style="display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 10px; align-items: center;">${campo({ ejemplo: 'Valor para {{2}}', alto: 34 })}${botonSecundario('plus', 'Añadir', '', 'height: 34px;')}</div>
                </div>
              </div>
            </div>`;

// 5. Búsqueda en el historial (busca también dentro de los destinatarios) y vacíos.
const coincidencia = (n, tel, st, detalle) => {
  const [i, cI, cT, texto] = EST_DEST[st];
  return `
                  <div style="min-width: 0; padding: 10px 12px; border-radius: 10px; background: #ffffff; box-shadow: inset 0 0 0 1px ${navyA(0.12)}; display: flex; flex-direction: column; gap: 6px;">
                    <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">
                      <div style="min-width: 0; display: flex; flex-direction: column; gap: 1px;">
                        <span style="${t(13, 18, 600, T.navy, truncar)}">${nombrePropio(n)}</span>
                        <span style="${MONO} ${t(12, 16, 400, T.muted, num)}">${tel}</span>
                      </div>
                      <span style="display: inline-flex; align-items: center; gap: 5px; ${t(12, 16, 600, cT, 'white-space: nowrap;')}">${ico(i, cI, 13, 2.25)}${texto}</span>
                    </div>
                    <span style="${t(12, 16, 400, st === 'failed' ? TXT.mal : T.muted, truncar + num)}">${detalle}</span>
                  </div>`;
};
const busqueda = `
            ${barraHist(`
              <div style="position: relative; width: 340px; flex-shrink: 0;">
                <span style="position: absolute; left: 12px; top: 10px; color: ${T.navy};">${icono('search', 16, 2)}</span>
                <div style="height: 36px; border-radius: 10px; padding: 0 12px 0 38px; background: #ffffff; box-shadow: inset 0 0 0 1px ${T.navy}, 0 0 0 3px ${navyA(0.14)}; ${t(13, 18, 500, T.navy, num)} display: flex; align-items: center; justify-content: space-between;">315 772<span style="color: ${T.muted};">${icono('x', 15, 2)}</span></div>
              </div>`, 'all', [['all', 'Todos', 2], ['processing', 'Enviando', 0], ['completed', 'Completados', 2], ['failed', 'Fallidos', 0], ['cancelled', 'Cancelados', 0]])}
            <div style="height: 34px; flex-shrink: 0; padding: 0 ${PH}px 0 ${X_TXT}px; display: flex; align-items: center; ${t(12.5, 16, 400, T.muted)}">Resultados por campaña, plantilla, teléfono o destinatario.</div>
            ${cabezaHist}
            ${filaHist(HISTORIAL[0])}
            <div style="flex-shrink: 0; padding: 12px ${PH}px 16px ${X_TXT}px; background: ${C.panel}; border-bottom: 1px solid ${C.filete}; display: flex; flex-direction: column; gap: 10px;">
              <span style="display: flex; align-items: center; gap: 7px; ${t(12.5, 16, 600, T.navy)}">${icono('eye', 14, 2)}2 destinatarios encontrados</span>
              <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 10px;">
                ${coincidencia('LUZ MARINA CUERO VIDAL', '315 772 0418', 'sent', 'Sin error registrado · 12 sept 2026, 7:56')}
                ${coincidencia('ROSA AMELIA MINA SOLÍS', '315 772 9036', 'failed', '131026 · Mensaje no entregable: el número no tiene WhatsApp')}
              </div>
            </div>
            ${filaHist(HISTORIAL[5], true)}`;
const vacio = (i, titulo, texto) => `
              <div style="min-width: 0; padding: 26px 20px; border-radius: 12px; border: 1.5px dashed ${navyA(0.26)}; background: ${C.campo}; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center;">
                <span style="width: 40px; height: 40px; border-radius: 12px; background: #ffffff; box-shadow: inset 0 0 0 1px ${navyA(0.12)}; color: ${T.muted}; display: flex; align-items: center; justify-content: center;">${icono(i, 19, 1.9)}</span>
                <span style="${t(13.5, 18, 600, T.navy)}">${titulo}</span>
                <span style="${t(12.5, 18, 400, T.muted)}">${texto}</span>
              </div>`;
const vacios = `
            <div style="padding: 20px ${PH}px 22px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); column-gap: 14px;">
              ${vacio('upload', 'Arrastra un Excel aquí', 'o selecciónalo. .xlsx, .xls o .csv con teléfono, nombre y los datos del mensaje (fecha, hora…).')}
              ${vacio('users', 'No hay destinatarios aún', 'Carga un archivo o añade números a mano en el paso 2.')}
              ${vacio('message-square-text', 'No hay plantillas aprobadas', 'Crea una en la pestaña Plantillas o sincroniza con Meta.')}
              ${vacio('search', 'No se encontraron resultados', 'Prueba con otro nombre, teléfono o plantilla. Sin envíos aún: «No hay envíos masivos registrados».')}
            </div>`;

escribir('Estados.dc.html', documento(islaSuelta('Estados', `
        ${pie('1', 'Envío en curso', 'El formulario se oculta. Detener pide confirmación (hoy cancela al primer clic).')}
        ${hoja(bloqueCurso(false))}
        ${pie('2', 'Detener', 'Siempre pregunta antes. La opción segura es la de la izquierda.')}
        ${hoja(bloqueCurso(true), 'min-height: 300px;')}
        ${pie('3', 'Confirmar el envío', 'Ya existe hoy: resumen, vista previa, avisos y la casilla. El botón se activa al marcarla.')}
        <div style="display: flex; justify-content: center; padding: 22px 0; border-radius: 16px; background: ${navyA(0.28)};">${dialogoConfirmar}</div>
        ${pie('4', 'Faltan datos', 'Un hueco sin origen en rojo, un valor fijo y datos cruzados. El botón de enviar se apaga y dice por qué.')}
        ${hoja(pasoMal())}
        ${pie('5', 'Avisos de la plantilla', 'Salen al elegirla, antes de hablar de columnas.')}
        ${hoja(avisosPlantilla)}
        ${pie('6', 'Buscar en el historial', 'La búsqueda mira también dentro de los destinatarios y los enseña bajo su envío.')}
        ${hoja(busqueda)}
        ${pie('7', 'Vacíos', 'Qué se ve cuando todavía no hay nada.')}
        ${hoja(vacios)}`)), `${ISLA.ancho} x ${ALTOS.Estados || '?'}`);

// ══ Diálogos de plantillas ════════════════════════════════════════════════════════════════════════
const NUEVA = {
  visible: 'Recordatorio de cita de odontología', tecnico: 'recordatorio_de_cita_de_odontologia',
  cuerpo: 'Hola {{1}}, le recordamos su cita de odontología el día {{2}} a las {{3}}. Traiga su documento de identidad.',
  pie: 'Hospital Universitario del Valle',
};
const areaTexto = (texto, contador) => `
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <div style="height: 112px; border-radius: 9px; background: #ffffff; box-shadow: inset 0 0 0 1px ${T.navy}, 0 0 0 3px ${navyA(0.14)}; padding: 10px 12px; ${t(13, 20, 400, T.navy)}">${texto.replace(/\{\{(\d)\}\}/g, (m) => `<span style="${MONO} font-size: 12.5px; font-weight: 600;">${m}</span>`)}</div>
                  <div style="display: flex; justify-content: space-between; ${t(12, 16, 400, T.muted, num)}"><span>Usa {{1}}, {{2}}… para lo que cambia en cada destinatario.</span><span>${contador}/1024</span></div>
                </div>`;
const dialogoCrear = dialogo({ ancho: 730, i: 'file-plus-2', titulo: 'Crear plantilla de WhatsApp', cerrar: true,
  cuerpo: `
                <div style="display: grid; grid-template-columns: minmax(0, 1fr) 272px; column-gap: 24px; align-items: start;">
                  <div style="min-width: 0; display: flex; flex-direction: column; gap: 14px;">
                    ${conEtiqueta(etiqueta('Nombre visible'), campo({ valor: NUEVA.visible }), 'Nombre que se mostrará en la aplicación.')}
                    ${conEtiqueta(etiqueta('Nombre técnico en Meta'), campo({ valor: NUEVA.tecnico, mono: true }), 'Solo minúsculas, números y guion bajo. Se genera solo desde el nombre visible.')}
                    <div style="display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); column-gap: 12px;">
                      ${conEtiqueta(etiqueta('Categoría'), campo({ i: 'shield', valor: 'Utilidad', select: true }))}
                      ${conEtiqueta(etiqueta('Idioma'), campo({ i: 'globe', valor: 'Español (Colombia)', select: true }))}
                    </div>
                    ${conEtiqueta(etiqueta('Encabezado', '(opcional)'), campo({ i: 'type', valor: 'Sin encabezado', select: true }), 'Texto, imagen (JPG, PNG, 5 MB), video (MP4, 16 MB) o documento (PDF, 100 MB) por URL pública.')}
                    ${conEtiqueta(etiqueta('Cuerpo del mensaje'), areaTexto(NUEVA.cuerpo, NUEVA.cuerpo.length))}
                    ${conEtiqueta(etiqueta('Pie de mensaje', '(opcional, máx. 60)'), campo({ valor: NUEVA.pie }))}
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${rotulo('Vista previa')}
                    <div style="padding: 14px 12px 16px; border-radius: 12px; background: #efeae2; box-shadow: inset 0 0 0 1px rgba(0,0,0,.05);">
                      <div style="padding: 9px 11px 7px; border-radius: 3px 10px 10px 10px; background: #ffffff; box-shadow: 0 1px 1px rgba(0,0,0,.1); display: flex; flex-direction: column; gap: 6px;">
                        <p style="${t(13.5, 20, 400, '#111b21')}">${NUEVA.cuerpo}</p>
                        <p style="${t(12, 16, 400, '#54656f')}">${NUEVA.pie}</p>
                        <span style="text-align: right; ${t(11, 14, 400, '#54656f', num)}">9:41</span>
                      </div>
                    </div>
                    ${aviso('info', '', 'Va a revisión en Meta: tarda de minutos a 24 horas. Cuando esté aprobada, pulsa «Sincronizar con Meta» para usarla en los envíos.', { pad: 12 })}
                  </div>
                </div>`,
  botones: botonSecundario('x', 'Cancelar') + botonPrimario('send', 'Enviar a revisión') });
const dialogoEliminar = dialogo({ ancho: 336, i: 'trash-2', tono: 'mal', titulo: '¿Eliminar plantilla?',
  cuerpo: `
                <span style="${t(13.5, 20, 400, T.muted)}">Se eliminará de Meta y no podrá usarse en los envíos. No se puede deshacer.</span>
                <div style="padding: 10px 12px; border-radius: 10px; background: ${navyA(0.04)}; box-shadow: inset 0 0 0 1px ${navyA(0.1)}; display: flex; flex-direction: column; gap: 2px;">
                  <span style="${t(13.5, 18, 600, T.navy, truncar)}">Recordatorio de terapia física</span>
                  <span style="${MONO} ${t(12, 16, 400, T.muted, truncar)}">recordatorio_terapia_fisica</span>
                </div>
                ${aviso('aviso', '', 'Si vuelves a necesitarla tendrás que crearla de nuevo y esperar la aprobación de Meta.', { pad: 12 })}`,
  botones: botonSecundario('x', 'Cancelar') + botonPeligroLleno('trash-2', 'Sí, eliminar') });
const sincronizado = `
          <div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 12px; background: ${FONDO.ok}; box-shadow: inset 0 0 0 1px ${FONDO.okBorde};">
            ${ico('circle-check', TXT.ok, 17, 2)}
            <span style="flex: 1; ${t(13, 18, 500, '#065f46', num)}"><span style="font-weight: 600;">Sincronización completada.</span> 3 actualizadas, 1 nueva importada de 14 en Meta.</span>
            ${botonIcono('x', '#065f46', 'Cerrar aviso')}
          </div>`;
escribir('Dialogos.dc.html', documento(islaSuelta('Dialogos', `
        ${pie('1', 'Crear plantilla', 'Mismo formulario de hoy, con la vista previa al lado mientras se escribe.')}
        <div style="display: flex; align-items: flex-start; gap: 24px; padding: 22px; border-radius: 16px; background: ${navyA(0.28)};">${dialogoCrear}
          <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 18px;">
            ${dialogoEliminar}
          </div>
        </div>
        ${pie('2', 'Avisos que quedan arriba de la hoja', 'Éxito y error de cualquier acción, con su cierre.')}
        ${sincronizado}
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 12px; background: ${FONDO.mal}; box-shadow: inset 0 0 0 1px ${FONDO.malBorde};">
          ${ico('circle-alert', TXT.mal, 17, 2)}
          <span style="flex: 1; ${t(13, 18, 500, '#991b1b')}"><span style="font-weight: 600;">Ya hay un envío masivo en proceso.</span> Espere a que termine.</span>
          ${botonIcono('x', '#991b1b', 'Cerrar aviso')}
        </div>`)), `${ISLA.ancho} x ${ALTOS.Dialogos || '?'}`);
