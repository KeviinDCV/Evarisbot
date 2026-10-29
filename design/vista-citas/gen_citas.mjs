// Citas (/admin/appointments y /admin/appointments/view) rediseñada dentro de la carcasa "Marco navy",
// en el mismo lenguaje que Usuarios, Configuración y Estadísticas.
//
// Idea: el panel se lee de arriba abajo como el trabajo del día. Arriba, el ámbito (General / Oncología)
// y cuatro cifras. Debajo, UNA hoja blanca con tres temas: el envío de recordatorios (su estado, su
// progreso y, por fecha, lo que queda por enviar con su botón), la carga del Excel (con las columnas que
// debe tener a la vista) y las últimas citas cargadas. La lista completa es otra pantalla con los
// filtros como cifras pulsables, una barra con buscador y fechas, la tabla ordenable y el paginado fijo
// al pie de la hoja.
//
// Escribe cuatro artboards:
//   Main.dc.html     1440x900: el panel al entrar, con un envío EN CURSO (menú fijado, isla 1190x880).
//   Panel.dc.html    1190 x alto necesario: el panel entero.
//   Lista.dc.html    1440x900: todas las citas, con filtros y tabla paginada.
//   Estados.dc.html  1190 x alto necesario: sin envío (con la confirmación de enviar), en pausa y la
//                    confirmación de detener.
//
// TODO es de EJEMPLO e inventado: pacientes, documentos, teléfonos, médicos, especialidades, archivo.
// Forma real de las props de AppointmentController@index y @view. "Hoy" = lunes 14 sept 2026.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { T, icono, documento } from '../usuarios/_comun.mjs';
import { carcasaMarco, ISLA, RADIO_ISLA } from '../usuarios/_marco.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));

// ══ Paleta (la de Estadísticas) ═══════════════════════════════════════════════════════════════════
// Marcas contra la hoja blanca (mín. 3:1): esmeralda 600 #059669 3,77 · rojo 600 #dc2626 4,83 ·
// ámbar 600 #d97706 3,19 · cielo 600 #0284c7 4,10 · pizarra 400 como punto neutro (no es dato).
// Texto con color (mín. 4,5:1): esmeralda 700 #047857 5,48 · ámbar 700 #b45309 5,02 · rojo 700 #b91c1c
// 6,47 · cielo 700 #0369a1 5,93 · pizarra 600 #475569 7,58.
const GRAF = { ok: '#059669', aviso: '#d97706', mal: '#dc2626', curso: '#0284c7', neutro: '#94a3b8', pista: 'rgba(46,63,132,.08)' };
const TXT = { ok: '#047857', aviso: '#b45309', mal: '#b91c1c', curso: '#0369a1', neutro: '#475569' };
const FONDO = { ok: '#ecfdf5', okBorde: '#a7f3d0', mal: '#fef2f2', malBorde: '#fecaca', aviso: '#fffbeb', avisoBorde: '#fde68a' };

// ══ Formato ═══════════════════════════════════════════════════════════════════════════════════════
const miles = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// ══ Datos de EJEMPLO ══════════════════════════════════════════════════════════════════════════════
// Semilla fija: el lienzo sale igual cada vez.
let semilla = 20260914;
const azar = () => ((semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648);
const uno = (lista) => lista[Math.floor(azar() * lista.length)];
const digitos = (n) => Array.from({ length: n }, () => Math.floor(azar() * 10)).join('');

const NOMBRES = ['MARÍA JOSÉ', 'LUIS ALBERTO', 'ANA LUCÍA', 'CARLOS ANDRÉS', 'GLORIA INÉS', 'JORGE ELIÉCER', 'ROSA AMELIA',
  'HÉCTOR FABIO', 'LUZ MARINA', 'JOSÉ ALIRIO', 'MARTHA CECILIA', 'FREDDY ANTONIO', 'BLANCA NUBIA', 'JAIME HUMBERTO',
  'CLAUDIA PATRICIA', 'ÉDGAR MAURICIO', 'NANCY ESTELLA', 'WILSON HERNÁN', 'OLGA LUCÍA', 'RUBÉN DARÍO', 'YOLANDA',
  'ARGEMIRO', 'LEIDY JOHANA', 'OMAR ENRIQUE'];
const APELLIDOS = ['RENGIFO', 'OBANDO', 'CARABALÍ', 'VALENCIA', 'MINA', 'PERLAZA', 'CASTILLO', 'MOSQUERA', 'LOZANO',
  'BENÍTEZ', 'CUERO', 'TRUJILLO', 'SINISTERRA', 'ARBOLEDA', 'SOLÍS', 'PALACIOS', 'QUIÑÓNEZ', 'LONDOÑO', 'VIDAL', 'ZÚÑIGA'];
// Médicos y especialidades inventados (consulta general; Oncología tendría las suyas).
const MEDICOS = [
  ['Julián Andrés Pardo', 'Medicina interna'], ['Mónica Liliana Erazo', 'Ginecología'], ['Felipe Castaño Ruiz', 'Ortopedia'],
  ['Adriana Paz Velasco', 'Pediatría'], ['Ricardo León Burbano', 'Cardiología'], ['Diana Marcela Ocampo', 'Oftalmología'],
  ['Germán Alonso Rivas', 'Cirugía general'], ['Lorena Isabel Chaves', 'Dermatología'], ['Mauricio Tello Ibarra', 'Neurología'],
  ['Paula Andrea Guzmán', 'Urología'],
];
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
// 14 sept 2026 es lunes.
const fechaCorta = (d) => `${DIAS[(d - 13 + 7 * 10) % 7]} ${d} sept`;
const HORAS = ['06:30', '07:00', '07:20', '07:40', '08:00', '08:20', '08:40', '09:00', '09:30', '10:00', '10:20', '10:40',
  '11:00', '13:30', '14:00', '14:20', '14:40', '15:00', '15:30', '16:00'];

const telefono = () => `3${uno(['00', '01', '04', '10', '11', '12', '13', '14', '15', '16', '17', '18', '20'])} ${digitos(3)} ${digitos(4)}`;
const cedula = () => (azar() < 0.55
  ? `1.${uno(['107', '112', '113', '114', '130', '143', '144', '151'])}.${digitos(3)}.${digitos(3)}`
  : `${uno(['16', '29', '31', '38', '66', '94'])}.${digitos(3)}.${digitos(3)}`);

/** Estados reales de reminder_status tras un envío. */
const ESTADOS_ENV = ['sent', 'delivered', 'read', 'confirmed', 'cancelled', 'failed'];
const cita = ({ dia, hora, estado, envio = '' }) => {
  const [med, esp] = uno(MEDICOS);
  return {
    n: (() => { const a = uno(APELLIDOS); let b = uno(APELLIDOS); while (b === a) b = uno(APELLIDOS); return `${uno(NOMBRES)} ${a} ${b}`; })(), cc: cedula(), tel: telefono(),
    dia, hora, med, esp, sent: estado !== 'pending', status: estado, envio,
  };
};

// Panel: las 50 últimas cargadas (id desc). El Excel de esta mañana trae citas del 15 al 25 de septiembre.
const pesoPara = (dia) => (dia >= 17 ? { pending: 1 }
  : dia === 16 ? { pending: 0.45, sent: 0.25, delivered: 0.2, read: 0.06, failed: 0.04 }
  : { pending: 0.35, sent: 0.1, delivered: 0.15, read: 0.08, confirmed: 0.2, cancelled: 0.07, failed: 0.05 });
const sortea = (pesos) => { let r = azar(), acc = 0; for (const [k, v] of Object.entries(pesos)) { acc += v; if (r <= acc) return k; } return 'pending'; };
const ULTIMAS = Array.from({ length: 50 }, () => {
  const dia = uno([15, 15, 16, 16, 16, 17, 18, 21, 22, 23, 24, 25]);
  const estado = sortea(pesoPara(dia));
  const envio = estado === 'pending' ? '' : dia === 15 ? `13 sept, ${uno(['7:52', '8:05', '8:31', '9:14'])}` : `14 sept, ${uno(['9:02', '9:18', '9:41', '10:06'])}`;
  return cita({ dia, hora: uno(HORAS), estado, envio });
});
// Que la primera pantalla enseñe todos los estados en las filas de arriba.
const MUESTRA_ARRIBA = ['pending', 'read', 'confirmed', 'pending', 'cancelled', 'sent', 'failed', 'delivered'];
MUESTRA_ARRIBA.forEach((e, i) => {
  ULTIMAS[i].status = e; ULTIMAS[i].sent = e !== 'pending';
  if (e === 'pending') ULTIMAS[i].envio = ''; else if (!ULTIMAS[i].envio) { ULTIMAS[i].dia = 16; ULTIMAS[i].envio = '14 sept, 9:18'; }
  if (['confirmed', 'cancelled'].includes(e)) { ULTIMAS[i].dia = 15; ULTIMAS[i].envio = '13 sept, 8:05'; }
});

[19, 33].forEach((i) => { Object.assign(ULTIMAS[i], { dia: 15, status: 'cancelled', sent: true, envio: '13 sept, 8:31' }); });

const PANEL = {
  total: 12640,
  stats: { sent: 10982, pending: 498, pending_tomorrow: 412, failed: 267 }, // remindersStats
  reciente: { sent: ULTIMAS.filter((c) => c.sent).length, cancelled: ULTIMAS.filter((c) => c.status === 'cancelled').length },
  progreso: { sent: 798, failed: 14, total: 1310 },                              // reminderProgress
  archivo: { nombre: 'citas_general_semana38.xlsx', tam: '1,24 MB', filas: 1284, omitidas: 36, fecha: '14/9/2026, 7:42:15 a. m.' },
  manana: 'martes 15 de septiembre', pasado: 'miércoles 16 de septiembre',
};
PANEL.progreso.pending = PANEL.progreso.total - PANEL.progreso.sent - PANEL.progreso.failed;
PANEL.progreso.pct = Math.round(((PANEL.progreso.sent + PANEL.progreso.failed) / PANEL.progreso.total) * 100);

// Lista (/view): 12.640 en la base; filtro "Todas", fechas 14 a 18 sept, orden por fecha de cita ascendente.
const LISTA = {
  stats: { all: 12640, pending: 1658, confirmed: 6814, cancelled: 1207 },
  total: 3412, from: 1, to: 20, pagina: 1, ultima: Math.ceil(3412 / 20),
  desde: '14/09/2026', hasta: '18/09/2026',
};
const ESTADOS_LISTA = ['confirmed', 'read', 'cancelled', 'confirmed', 'delivered', 'sent', 'confirmed', 'failed', 'confirmed',
  'read', 'cancelled', 'confirmed', 'delivered', 'confirmed', 'sent', 'read', 'confirmed', 'delivered', 'confirmed', 'read'];
const FILAS_LISTA = ESTADOS_LISTA.map((estado, i) => cita({ dia: 14, hora: HORAS[i], estado, envio: `12 sept, ${uno(['7:48', '8:02', '8:27', '9:10'])}` }));

// ══ Tintas y geometría ════════════════════════════════════════════════════════════════════════════
const navyA = (a) => `rgba(46,63,132,${a})`;
const C = { hoja: '#ffffff', filete: navyA(0.08), fileteFondo: navyA(0.12), banda: navyA(0.028), campo: navyA(0.035) };
const MONO = "font-family: ui-monospace, 'Cascadia Mono', 'SF Mono', Consolas, monospace;";
const truncar = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
const num = 'font-variant-numeric: tabular-nums;';
const PAD = 28, PH = 20, RANURA = 32, X_TXT = PH + RANURA + 12; // 64: donde arranca el texto de la hoja
const COL_ETQ = 300, HUECO = 32;
const H = {
  cab: 58, franja: 76, banda: 64, progreso: 112, sub: 40, tanda: 64, nota: 48, aviso: 56,
  carga: 176, resultado: 60, thead: 36, fila: 54, pieTabla: 52,
};
const GAP = 24;
const sombraHoja = `0 0 0 1px ${navyA(0.07)}, 0 1px 2px ${navyA(0.05)}, 0 14px 32px -18px ${navyA(0.22)}`;

// ══ Piezas ════════════════════════════════════════════════════════════════════════════════════════
const t = (px, lh, peso, color, extra = '') => `font-size: ${px}px; line-height: ${lh}px; font-weight: ${peso}; color: ${color}; ${extra}`;
const punto = (color, d = 8, r = 9999) => `<span style="width: ${d}px; height: ${d}px; flex-shrink: 0; border-radius: ${r}px; background: ${color};"></span>`;
const cuadro = (color) => punto(color, 9, 2.5);
const divisor = (color = C.fileteFondo) => `<div style="width: 1px; align-self: stretch; background: ${color};"></div>`;
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
const nombrePropio = (n) => n.toLocaleLowerCase('es').split(' ').filter(Boolean)
  .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toLocaleUpperCase('es') + p.slice(1))).join(' ');

const rotulo = (titulo, apoyo = '') => `
              <div style="height: 16px; display: flex; align-items: baseline; gap: 10px;">
                <span style="${t(11, 16, 600, T.muted, 'text-transform: uppercase; letter-spacing: .07em; white-space: nowrap;')}">${titulo}</span>${apoyo ? `
                <span style="${t(12, 16, 400, T.muted, truncar + num)}">${apoyo}</span>` : ''}
              </div>`;

// Botones. Alto 36 en la hoja; el de peligro es contorno rojo y el definitivo (dentro del diálogo) rojo lleno.
const btnBase = 'height: 36px; flex-shrink: 0; display: inline-flex; align-items: center; gap: 8px; padding: 0 16px 0 14px; border-radius: 10px; font-size: 13px; line-height: 18px; font-weight: 600; white-space: nowrap;';
const botonPrimario = (ico, texto, titulo = '') =>
  `<div${titulo ? ` title="${titulo}"` : ''} style="${btnBase} background: ${T.btnPrimary}; box-shadow: 0 1px 2px ${navyA(0.3)}, 0 6px 16px -6px ${navyA(0.55)}, inset 0 1px 0 rgba(255,255,255,.14); color: #ffffff;">${icono(ico, 15, 2)}${texto}</div>`;
const botonSecundario = (ico, texto, titulo = '') =>
  `<div${titulo ? ` title="${titulo}"` : ''} style="${btnBase} background: #ffffff; box-shadow: inset 0 0 0 1px ${navyA(0.2)}, 0 1px 2px ${navyA(0.08)}; color: ${T.navy};">${icono(ico, 15, 1.9)}${texto}</div>`;
const botonPeligro = (ico, texto, titulo = '') =>
  `<div${titulo ? ` title="${titulo}"` : ''} style="${btnBase} background: #ffffff; box-shadow: inset 0 0 0 1px rgba(220,38,38,.55), 0 1px 2px rgba(220,38,38,.12); color: ${TXT.mal};">${icono(ico, 15, 2)}${texto}</div>`;
const botonPeligroLleno = (ico, texto) =>
  `<div style="${btnBase} background: ${GRAF.mal}; box-shadow: 0 1px 2px rgba(185,28,28,.35), 0 6px 16px -6px rgba(220,38,38,.55), inset 0 1px 0 rgba(255,255,255,.14); color: #ffffff;">${icono(ico, 15, 2)}${texto}</div>`;
const botonApagado = (ico, texto, titulo) =>
  `<div title="${titulo}" style="${btnBase} background: ${navyA(0.05)}; box-shadow: inset 0 0 0 1px ${navyA(0.1)}; color: ${T.muted};">${icono(ico, 15, 1.9)}${texto}</div>`;

// Segmentado (el de rol en Usuarios y el de periodo en Estadísticas).
const opcion = (texto, activa) => activa
  ? `<div style="height: 30px; display: flex; align-items: center; padding: 0 14px; border-radius: 8px; background: #ffffff; box-shadow: 0 0 0 1px ${navyA(0.08)}, 0 1px 2px ${navyA(0.12)}, 0 2px 6px -2px ${navyA(0.12)}; ${t(13, 16, 600, T.navy, 'white-space: nowrap;')}">${texto}</div>`
  : `<div style="height: 30px; display: flex; align-items: center; padding: 0 14px; border-radius: 8px; ${t(13, 16, 600, T.muted, 'white-space: nowrap;')}">${texto}</div>`;
const segmentado = (opciones, activa, etiqueta = '') =>
  `<div${etiqueta ? ` title="${etiqueta}"` : ''} style="display: flex; align-items: center; gap: 2px; padding: 3px; border-radius: 11px; background: ${navyA(0.055)}; flex-shrink: 0;">${opciones.map(([k, v]) => opcion(v, k === activa)).join('')}</div>`;
const AMBITOS = [['general', 'General'], ['oncologia', 'Oncología']];

const buscador = (texto, ancho) => `
              <div style="position: relative; width: ${ancho}px; flex-shrink: 0;">
                <span style="position: absolute; left: 12px; top: 10px; color: ${T.muted};">${icono('search', 16, 1.75)}</span>
                <div style="height: 36px; border-radius: 10px; padding: 0 12px 0 38px; background: ${C.campo}; box-shadow: inset 0 0 0 1px ${navyA(0.1)}; ${t(13, 18, 400, T.muted, truncar)} display: flex; align-items: center;">${texto}</div>
              </div>`;

// Estado del envío en la banda: icono o punto + texto del color de su significado.
const chip = (tipo) => ({
  enviando: `<span style="display: inline-flex; align-items: center; gap: 6px; ${t(12.5, 16, 600, TXT.curso, 'white-space: nowrap;')}"><span style="display: flex; color: ${GRAF.curso};">${icono('loader-circle', 14, 2.25)}</span>Enviando</span>`,
  pausa: `<span style="display: inline-flex; align-items: center; gap: 6px; ${t(12.5, 16, 600, TXT.aviso, 'white-space: nowrap;')}"><span style="display: flex; color: ${GRAF.aviso};">${icono('pause', 14, 2.25)}</span>En pausa</span>`,
  quieto: `<span style="display: inline-flex; align-items: center; gap: 6px; ${t(12.5, 16, 500, TXT.neutro, 'white-space: nowrap;')}">${punto(GRAF.neutro, 7)}Sin proceso activo</span>`,
})[tipo];

const banda = ({ ico, titulo, texto, est = '', derecha = '' }) => `
            <div style="height: ${H.banda}px; flex-shrink: 0; padding: 0 ${PH}px; display: flex; align-items: center; gap: 12px; background: ${C.banda}; border-bottom: 1px solid ${C.filete};">
              <span style="width: ${RANURA}px; flex-shrink: 0; display: flex; justify-content: center; color: ${T.navy};">${icono(ico, 18, 1.75)}</span>
              <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 3px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <h2 style="${t(15, 20, 600, T.navy, 'letter-spacing: -.01em; white-space: nowrap;')}">${titulo}</h2>${est}
                </div>
                <p style="${t(12.5, 16, 400, T.muted, truncar + num)}">${texto}</p>
              </div>${derecha ? `
              <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">${derecha}</div>` : ''}
            </div>`;

const sub = (titulo, texto) => `
            <div style="height: ${H.sub}px; flex-shrink: 0; padding: 0 ${PH}px 8px ${X_TXT}px; display: flex; align-items: flex-end; gap: 10px;">
              <span style="${t(11, 16, 600, T.muted, 'text-transform: uppercase; letter-spacing: .07em; white-space: nowrap;')}">${titulo}</span>
              <span style="${t(12, 16, 400, T.muted, truncar)}">${texto}</span>
            </div>`;

// ══ Cabecera y franja del panel ═══════════════════════════════════════════════════════════════════
const cabeceraPanel = () => `
        <div style="height: ${H.cab}px; flex-shrink: 0; display: flex; align-items: flex-start; justify-content: space-between; gap: 24px;">
          <div style="min-width: 0; display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; align-items: center; gap: 18px;">
              <h1 style="${t(28, 34, 600, T.navy, 'letter-spacing: -.025em; white-space: nowrap;')}">Citas</h1>
              ${segmentado(AMBITOS, 'general', 'Ámbito de citas')}
            </div>
            <p style="${t(14, 20, 400, T.muted, 'white-space: nowrap;')}">Carga citas, controla recordatorios y revisa el estado de envío.</p>
          </div>
          <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0; padding-top: 1px;">
            ${botonSecundario('arrow-right', 'Ver todas las citas')}
          </div>
        </div>`;

const marcaIco = (ico, color = T.navy) => `<span style="display: flex; color: ${color};">${icono(ico, 14, 2)}</span>`;
const cifra = ({ marca, etq, valor, detalle }) => `
          <div style="min-width: 0; display: flex; flex-direction: column;">
            <div style="height: 16px; display: flex; align-items: center; gap: 8px;">${marca}<span style="${t(12, 16, 500, T.muted, truncar)}">${etq}</span></div>
            <span style="margin-top: 7px; ${t(28, 32, 500, T.navy, num + 'letter-spacing: -.03em; white-space: nowrap;')}">${valor}</span>
            <span style="margin-top: 5px; height: 16px; display: flex; align-items: center; gap: 6px; ${t(12.5, 16, 400, T.muted, num + truncar)}">${detalle}</span>
          </div>`;

const franjaPanel = () => `
        <div style="height: ${H.franja}px; flex-shrink: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr) 1px) minmax(0, 1fr); column-gap: 24px;">
          ${cifra({ marca: marcaIco('calendar'), etq: 'Total de citas', valor: miles(PANEL.total), detalle: `${ULTIMAS.length} recientes cargadas` })}${divisor()}
          ${cifra({ marca: marcaIco('send', GRAF.ok), etq: 'Recordatorios enviados', valor: miles(PANEL.stats.sent), detalle: `${PANEL.reciente.sent} en la vista reciente` })}${divisor()}
          ${cifra({ marca: marcaIco('clock', GRAF.aviso), etq: 'Por enviar, pasado mañana', valor: miles(PANEL.stats.pending), detalle: `${punto(GRAF.aviso, 7)}<span style="color: ${TXT.aviso}; font-weight: 500;">${miles(PANEL.stats.pending_tomorrow)} para mañana</span>` })}${divisor()}
          ${cifra({ marca: marcaIco('circle-x', GRAF.mal), etq: 'Fallidos', valor: miles(PANEL.stats.failed), detalle: `${PANEL.reciente.cancelled} canceladas recientes` })}
        </div>`;

// ══ 1. Envío de recordatorios ═════════════════════════════════════════════════════════════════════
/** Barra de progreso: enviados (esmeralda) y fallidos (rojo) sobre la pista; lo pendiente es pista. */
const barraProgreso = (p) => {
  const w = (v) => (v / p.total) * 100;
  return `
                <div style="height: 10px; border-radius: 9999px; background: ${GRAF.pista}; overflow: hidden; display: flex; gap: 2px;">
                  <div style="width: ${w(p.sent)}%; background: ${GRAF.ok};"></div>
                  <div style="width: ${w(p.failed)}%; min-width: 3px; background: ${GRAF.mal};"></div>
                </div>`;
};
const leyendaProgreso = (p) => `
                <div style="display: flex; align-items: center; gap: 22px; ${t(13, 18, 500, T.navy, num + 'white-space: nowrap;')}">
                  <span style="display: flex; align-items: center; gap: 8px;">${cuadro(GRAF.ok)}Enviados <span style="font-weight: 600;">${miles(p.sent)}</span></span>
                  <span style="display: flex; align-items: center; gap: 8px;">${cuadro(GRAF.mal)}Fallidos <span style="font-weight: 600;">${miles(p.failed)}</span></span>
                  <span style="display: flex; align-items: center; gap: 8px;"><span style="width: 9px; height: 9px; flex-shrink: 0; border-radius: 2.5px; background: ${GRAF.pista}; box-shadow: inset 0 0 0 1px ${navyA(0.32)};"></span>Pendientes <span style="font-weight: 600;">${miles(p.pending)}</span></span>
                </div>`;

/** Controles del envío en curso: van en la banda, a la derecha, como las acciones de Configuración. */
const accionesEnvio = (pausado = false) => pausado
  ? `${botonPrimario('play', 'Reanudar')}${botonPeligro('square', 'Detener…', 'Pide confirmación antes de detener')}`
  : `${botonSecundario('pause', 'Pausar')}${botonPeligro('square', 'Detener…', 'Pide confirmación antes de detener')}`;

const bloqueProgreso = ({ pausado = false } = {}) => {
  const p = PANEL.progreso;
  return `
            <div style="height: ${H.progreso}px; flex-shrink: 0; padding: 18px ${PH}px 0 ${X_TXT}px; display: flex; flex-direction: column; border-bottom: 1px solid ${C.filete};">
              <div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 24px;">
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  ${rotulo(pausado ? 'Envío en pausa' : 'Progreso del envío', pausado ? 'no sale ningún mensaje hasta que lo reanudes' : 'se actualiza solo cada 3 segundos')}
                  <div style="display: flex; align-items: baseline; gap: 12px;">
                    <span style="${t(30, 36, 500, pausado ? TXT.aviso : T.navy, num + 'letter-spacing: -.03em;')}">${p.pct} %</span>
                    <span style="${t(14, 20, 400, T.muted, num)}"><span style="font-weight: 600; color: ${T.navy};">${miles(p.sent + p.failed)}</span> de ${miles(p.total)} recordatorios procesados</span>
                  </div>
                </div>
                <div style="padding-bottom: 6px;">${leyendaProgreso(p)}</div>
              </div>
              <div style="margin-top: 14px;">${barraProgreso(p)}</div>
            </div>`;
};

/** Una fecha con recordatorios por enviar: cuándo, cuántas y su botón. */
const tanda = ({ cuando, fecha, n, boton, final = false }) => `
            <div style="height: ${H.tanda}px; flex-shrink: 0; padding: 0 ${PH}px 0 ${X_TXT}px; display: grid; grid-template-columns: ${COL_ETQ}px minmax(0, 1fr) auto; column-gap: ${HUECO}px; align-items: center;${final ? '' : ` border-bottom: 1px solid ${C.filete};`}">
              <div style="min-width: 0; display: flex; flex-direction: column; gap: 3px;">
                <span style="${t(13.5, 18, 600, T.navy, 'letter-spacing: -.003em;')}">${cuando}</span>
                <span style="${t(12, 16, 400, T.muted)}">Citas del ${fecha}</span>
              </div>
              <div style="display: flex; align-items: baseline; gap: 8px;">
                <span style="${t(20, 24, 500, n ? T.navy : T.muted, num + 'letter-spacing: -.02em;')}">${miles(n)}</span>
                <span style="${t(13, 18, 400, T.muted)}">${n === 1 ? 'cita' : 'citas'} con teléfono y sin recordatorio</span>
              </div>
              ${boton}
            </div>`;

const aviso = (texto) => `
            <div style="height: ${H.aviso}px; flex-shrink: 0; padding: 0 ${PH}px 0 ${PH}px; display: flex; align-items: center; gap: 12px; background: ${FONDO.aviso}; border-bottom: 1px solid ${FONDO.avisoBorde};">
              <span style="width: ${RANURA}px; flex-shrink: 0; display: flex; justify-content: center; color: ${TXT.aviso};">${icono('triangle-alert', 17, 2)}</span>
              <span style="${t(13, 18, 400, '#92400e', num)}"><span style="font-weight: 600;">Advertencia:</span> ${texto}</span>
            </div>`;

const nota = (texto, { final = true } = {}) => `
            <div style="height: ${H.nota}px; flex-shrink: 0; padding: 0 ${PH}px 0 ${PH}px; display: flex; align-items: center; gap: 12px;${final ? '' : ` border-bottom: 1px solid ${C.filete};`}">
              <span style="width: ${RANURA}px; flex-shrink: 0; display: flex; justify-content: center; color: ${T.muted};">${icono('info', 15, 1.9)}</span>
              <span style="${t(12.5, 16, 400, T.muted)}">${texto}</span>
            </div>`;

const TXT_BANDA_ENVIO = 'Recordatorios por WhatsApp a los pacientes con cita. Salen en segundo plano: puedes salir de esta pantalla.';
const EN_CURSO = 'Hay un envío en curso: al terminar o al detenerlo vuelven los botones para enviar.';

const seccionEnvioEnCurso = () => [
  banda({ ico: 'send', titulo: 'Envío de recordatorios', est: chip('enviando'), texto: TXT_BANDA_ENVIO, derecha: accionesEnvio(false) }),
  bloqueProgreso(),
  sub('Por enviar', 'por fecha de la cita'),
  tanda({ cuando: 'Pasado mañana', fecha: PANEL.pasado, n: PANEL.stats.pending,
    boton: botonApagado('send', `Enviar ${miles(PANEL.stats.pending)} recordatorios`, EN_CURSO) }),
  tanda({ cuando: 'Mañana (día antes)', fecha: PANEL.manana, n: PANEL.stats.pending_tomorrow, final: true,
    boton: botonApagado('calendar-check-2', `Enviar día antes (${miles(PANEL.stats.pending_tomorrow)})`, EN_CURSO) }),
  `<div style="height: 1px; flex-shrink: 0; background: ${C.filete};"></div>`,
  nota(EN_CURSO, { final: false }),
].join('');
const ALTO_ENVIO = H.banda + H.progreso + H.sub + 2 * H.tanda + 1 + H.nota;

// ══ 2. Cargar archivo de citas ════════════════════════════════════════════════════════════════════
const COLUMNAS_EXCEL = [['Citead', 'Código admisión'], ['Nom_paciente', 'Nombre paciente'], ['Pactel', 'Teléfono'],
  ['Citfc', 'Fecha cita'], ['Cithor', 'Hora cita'], ['Mednom', 'Nombre médico'], ['Espnom', 'Especialidad'],
  ['Citdoc', 'Documento'], ['Citobsobs', 'Observaciones']];

const zonaCarga = `
                <div style="height: 136px; border-radius: 12px; border: 1.5px dashed ${navyA(0.34)}; background: ${C.campo}; display: flex; align-items: center; gap: 18px; padding: 0 24px;">
                  <div style="width: 44px; height: 44px; flex-shrink: 0; border-radius: 12px; background: ${T.btnPrimary}; box-shadow: 0 1px 2px ${navyA(0.3)}, 0 6px 14px -6px ${navyA(0.5)}; color: #ffffff; display: flex; align-items: center; justify-content: center;">${icono('upload', 20, 2)}</div>
                  <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 4px;">
                    <span style="${t(14, 20, 600, T.navy)}">Arrastra y suelta el archivo aquí</span>
                    <span style="${t(13, 18, 400, T.muted)}">o selecciónalo desde el equipo. Luego pulsa «Subir archivo».</span>
                    <span style="margin-top: 4px; ${t(12, 16, 400, T.muted)}">Formatos .xlsx, .xls y .csv, hasta 10 MB</span>
                  </div>
                  ${botonSecundario('file-spreadsheet', 'Seleccionar archivo')}
                </div>`;

const columnasExcel = `
                <div style="display: flex; flex-direction: column; gap: 12px;">
                  ${rotulo('Columnas que debe tener')}
                  <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 18px; row-gap: 10px;">${COLUMNAS_EXCEL.map(([c, d]) => `
                    <div style="min-width: 0; display: flex; flex-direction: column; gap: 1px;">
                      <span style="${MONO} ${t(12.5, 17, 600, T.navy, 'letter-spacing: .01em;')}">${c}</span>
                      <span style="${t(12, 16, 400, T.muted, truncar)}">${d}</span>
                    </div>`).join('')}
                  </div>
                </div>`;

const resultadoCarga = () => {
  const a = PANEL.archivo;
  return `
            <div style="height: ${H.resultado}px; flex-shrink: 0; padding: 0 ${PH}px 0 ${PH}px; display: flex; align-items: center; gap: 12px;">
              <span style="width: ${RANURA}px; flex-shrink: 0; display: flex; justify-content: center; color: ${GRAF.ok};">${icono('circle-check', 18, 2)}</span>
              <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 3px;">
                <span style="${t(13, 18, 500, T.navy, truncar + num)}"><span style="font-weight: 600; color: ${TXT.ok};">Archivo cargado.</span> Se procesaron ${miles(a.filas)} citas. Se omitieron ${a.omitidas} porque ya estaban registradas.</span>
                <span style="display: flex; align-items: center; gap: 8px; ${t(12, 16, 400, T.muted, truncar + num)}"><span style="${MONO} font-size: 12px; color: ${T.navy};">${a.nombre}</span><span aria-hidden="true">·</span>${a.tam}<span aria-hidden="true">·</span>${miles(a.filas)} citas<span aria-hidden="true">·</span>${a.fecha}</span>
              </div>
              <div title="Cerrar aviso" style="width: 30px; height: 30px; flex-shrink: 0; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: ${T.muted};">${icono('x', 16, 2)}</div>
            </div>`;
};

const seccionCarga = () => [
  banda({ ico: 'file-spreadsheet', titulo: 'Cargar archivo de citas', texto: 'Acepta archivos Excel o CSV y actualiza la base de citas del panel. Las citas repetidas se omiten.' }),
  `
            <div style="height: ${H.carga}px; flex-shrink: 0; padding: 20px ${PH}px 0 ${X_TXT}px; display: grid; grid-template-columns: minmax(0, 1fr) 1px 440px; column-gap: 28px; border-bottom: 1px solid ${C.filete};">
              ${zonaCarga}${divisor(C.filete)}
              ${columnasExcel}
            </div>`,
  resultadoCarga(),
].join('');
const ALTO_CARGA = H.banda + H.carga + H.resultado;

// ══ Estado del recordatorio en una fila ═══════════════════════════════════════════════════════════
// Dos columnas: si el recordatorio salió (y cuándo) y qué hizo el paciente. Las etiquetas son las de hoy.
const recordatorio = (c) => {
  if (!c.sent) return `<span style="display: inline-flex; align-items: center; gap: 7px; ${t(13, 18, 500, TXT.aviso)}">${punto(GRAF.aviso, 7)}Pendiente</span>`;
  if (c.status === 'failed') return `
                <div style="display: flex; flex-direction: column; gap: 2px;">
                  <span style="display: inline-flex; align-items: center; gap: 7px; ${t(13, 18, 500, TXT.mal)}">${punto(GRAF.mal, 7)}Error</span>
                  <span style="padding-left: 14px; ${t(12, 16, 400, T.muted, num)}">${c.envio}</span>
                </div>`;
  return `
                <div style="display: flex; flex-direction: column; gap: 2px;">
                  <span style="display: inline-flex; align-items: center; gap: 7px; ${t(13, 18, 500, TXT.ok)}">${punto(GRAF.ok, 7)}Enviado</span>
                  <span style="padding-left: 14px; ${t(12, 16, 400, T.muted, num)}">${c.envio}</span>
                </div>`;
};
const pastilla = (fondo, borde, color, ico, texto) =>
  `<span style="display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 9px 0 7px; border-radius: 7px; background: ${fondo}; box-shadow: inset 0 0 0 1px ${borde}; ${t(12, 16, 600, color, 'white-space: nowrap;')}">${icono(ico, 13, 2)}${texto}</span>`;
const respuesta = (c) => {
  if (!c.sent || c.status === 'failed') return `<span style="${t(13, 18, 400, T.muted)}">—</span>`;
  if (c.status === 'confirmed') return pastilla(FONDO.ok, FONDO.okBorde, TXT.ok, 'calendar-check-2', 'Confirmada');
  if (c.status === 'cancelled') return pastilla(FONDO.mal, FONDO.malBorde, TXT.mal, 'calendar-x', 'Cancelada');
  if (['delivered', 'read'].includes(c.status)) return `<span style="display: inline-flex; align-items: center; gap: 6px; ${t(13, 18, 500, TXT.curso)}">${icono('check', 14, 2.25)}Recibido</span>`;
  return `<span style="display: inline-flex; align-items: center; gap: 6px; ${t(13, 18, 400, TXT.neutro)}">${icono('clock', 14, 1.9)}Sin respuesta</span>`;
};

const orden = (estado) => (estado === 'asc' ? { i: 'arrow-up', c: T.navy } : estado === 'desc' ? { i: 'arrow-down', c: T.navy } : { i: 'arrow-up-down', c: navyA(0.45) });
const th = (x, { der = false, sort = null, pad = 0 } = {}) => {
  const o = sort ? orden(sort) : null;
  return `<span style="${pad ? `padding-left: ${pad}px; ` : ''}display: flex; align-items: center; gap: 6px;${der ? ' justify-content: flex-end;' : ''}"${sort ? ` title="Ordenar por ${x.toLowerCase()}"` : ''}><span style="${t(11, 16, 600, sort === 'asc' || sort === 'desc' ? T.navy : T.muted, 'text-transform: uppercase; letter-spacing: .07em; white-space: nowrap;')}">${x}</span>${o ? `<span style="display: flex; color: ${o.c};">${icono(o.i, 13, 2)}</span>` : ''}</span>`;
};

// Columnas: #, paciente, cita, profesional, recordatorio, respuesta.
const COLS = '40px minmax(0, 1.25fr) 132px minmax(0, 1.2fr) 150px 140px';
const filaCita = (c, i, { conCedula = false } = {}) => `
            <div style="height: ${H.fila}px; flex-shrink: 0; padding: 0 ${PH}px; display: grid; grid-template-columns: ${COLS}; column-gap: 20px; align-items: center; border-bottom: 1px solid ${C.filete};">
              <span style="${t(12.5, 16, 500, T.muted, num + 'text-align: right; padding-right: 4px;')}">${i}</span>
              <div style="min-width: 0; display: flex; flex-direction: column; gap: 2px;">
                <span style="${t(13.5, 18, 600, T.navy, 'letter-spacing: -.003em;' + truncar)}">${nombrePropio(c.n)}</span>
                <span style="display: flex; align-items: center; gap: 6px; ${t(12, 16, 400, T.muted, num + truncar)}">${conCedula ? `CC ${c.cc}<span aria-hidden="true">·</span>` : `<span style="display: flex;">${icono('phone', 12, 2)}</span>`}${c.tel}</span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <span style="${t(13, 18, 500, T.navy, num + 'white-space: nowrap;')}">${fechaCorta(c.dia)}</span>
                <span style="display: flex; align-items: center; gap: 5px; ${t(12, 16, 400, T.muted, num)}">${icono('clock', 12, 2)}${c.hora}</span>
              </div>
              <div style="min-width: 0; display: flex; flex-direction: column; gap: 2px;">
                <span style="${t(13, 18, 500, T.navy, truncar)}">${c.med}</span>
                <span style="${t(12, 16, 400, T.muted, truncar)}">${c.esp}</span>
              </div>
              ${recordatorio(c)}
              <div>${respuesta(c)}</div>
            </div>`;

// ══ 3. Últimas citas cargadas ═════════════════════════════════════════════════════════════════════
const cabezaPanel = `
            <div style="height: ${H.thead}px; flex-shrink: 0; padding: 0 ${PH}px; display: grid; grid-template-columns: ${COLS}; column-gap: 20px; align-items: center; background: ${C.banda}; border-bottom: 1px solid ${C.filete};">
              ${th('#', { der: true })}${th('Paciente')}${th('Cita')}${th('Profesional')}${th('Recordatorio')}${th('Respuesta')}
            </div>`;

const seccionUltimas = () => [
  banda({ ico: 'calendar-clock', titulo: 'Últimas citas cargadas',
    texto: `Las ${ULTIMAS.length} más recientes de ${miles(PANEL.total)}. Para filtrar por fecha o estado, abre «Ver todas las citas».`,
    derecha: buscador('Buscar por paciente, teléfono, médico...', 300) }),
  cabezaPanel,
  ULTIMAS.map((c, i) => filaCita(c, i + 1)).join(''),
  `
            <div style="height: ${H.pieTabla}px; flex-shrink: 0; padding: 0 ${PH}px 0 ${X_TXT}px; display: flex; align-items: center; justify-content: space-between; gap: 16px;">
              <span style="${t(12.5, 16, 400, T.muted, num)}">Mostrando las últimas <span style="font-weight: 600; color: ${T.navy};">${ULTIMAS.length}</span> citas (filtradas: ${ULTIMAS.length})</span>
              <span style="display: flex; align-items: center; gap: 6px; ${t(13, 18, 600, T.navy)}">Ver todas las citas${icono('arrow-right', 15, 2)}</span>
            </div>`,
].join('');
const ALTO_ULTIMAS = H.banda + H.thead + ULTIMAS.length * H.fila + H.pieTabla;

// ══ Panel: hoja y artboards ═══════════════════════════════════════════════════════════════════════
const contenidoPanel = () => seccionEnvioEnCurso() + seccionCarga() + seccionUltimas();
const ALTO_HOJA_PANEL = ALTO_ENVIO + ALTO_CARGA + ALTO_ULTIMAS;
const VELO = 40;

const pantallaMain = `
      <div style="position: absolute; inset: 0; padding: ${PAD}px ${PAD}px 0; display: flex; flex-direction: column; gap: ${GAP}px;">
        ${cabeceraPanel()}
        ${franjaPanel()}
        <div style="position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; border-radius: 16px 16px 0 0; background: ${C.hoja}; box-shadow: ${sombraHoja}; overflow: hidden;">
          ${contenidoPanel()}
          <div style="position: absolute; left: 0; right: 0; bottom: 0; height: ${VELO}px; z-index: 5; background: linear-gradient(180deg, rgba(255,255,255,0), #ffffff 88%); pointer-events: none;"></div>
        </div>
      </div>`;

const escribir = (nombre, html, medida) => {
  fs.writeFileSync(path.join(DIR, nombre), html);
  console.log(`  ${nombre.padEnd(16)} ${String(Buffer.byteLength(html)).padStart(7)} bytes  (${medida})`);
};

escribir('Main.dc.html', documento(carcasaMarco({ activo: 'appointments', contenido: pantallaMain, ancho: 1440 })), `1440x900, isla ${ISLA.ancho}x${ISLA.alto}`);

const ALTO_PANEL = PAD + H.cab + GAP + H.franja + GAP + ALTO_HOJA_PANEL + PAD;
escribir('Panel.dc.html', documento(`
<div style="position: relative; width: ${ISLA.ancho}px; height: ${ALTO_PANEL}px; overflow: hidden; border-radius: ${RADIO_ISLA}px; background: ${T.bg}; font-family: ${T.font};">
      <div style="padding: ${PAD}px; display: flex; flex-direction: column; gap: ${GAP}px;">
        ${cabeceraPanel()}
        ${franjaPanel()}
        <div style="height: ${ALTO_HOJA_PANEL}px; flex-shrink: 0; display: flex; flex-direction: column; border-radius: 16px; background: ${C.hoja}; box-shadow: ${sombraHoja}; overflow: hidden;">
          ${contenidoPanel()}
        </div>
      </div>
</div>`), `${ISLA.ancho}x${ALTO_PANEL}`);

// ══ Lista: todas las citas ════════════════════════════════════════════════════════════════════════
const etiquetaAmbito = `<span title="Ámbito: se cambia en el panel de Citas" style="display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 7px; background: ${navyA(0.07)}; ${t(12, 16, 600, T.navy, 'white-space: nowrap;')}">General</span>`;
const cabeceraLista = `
        <div style="height: ${H.cab}px; flex-shrink: 0; display: flex; align-items: flex-start; justify-content: space-between; gap: 24px;">
          <div style="min-width: 0; display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <h1 style="${t(28, 34, 600, T.navy, 'letter-spacing: -.025em; white-space: nowrap;')}">Todas las citas</h1>
              ${etiquetaAmbito}
            </div>
            <p style="${t(14, 20, 400, T.muted, 'white-space: nowrap;')}">Visualiza, filtra y exporta las citas con sus estados de recordatorio.</p>
          </div>
          <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0; padding-top: 1px;">
            ${botonSecundario('arrow-left', 'Volver a Citas')}
            ${botonPrimario('download', 'Exportar a Excel', 'Exporta lo que ves: estado, búsqueda y fechas')}
          </div>
        </div>`;

/** Cifra que filtra: pulsarla aplica el filtro; pulsar la activa lo quita (vuelve a Todas). */
const cifraFiltro = ({ k, marca, etq, valor, activa }) => `
          <div title="${activa ? (k === 'all' ? 'Filtro activo' : 'Pulsa para quitar') : 'Aplicar filtro'}" style="position: relative; min-width: 0; display: flex; flex-direction: column;">
            <div style="height: 16px; display: flex; align-items: center; gap: 8px;">${marca}<span style="${t(12, 16, activa ? 600 : 500, activa ? T.navy : T.muted, truncar)}">${etq}</span></div>
            <span style="margin-top: 7px; ${t(28, 32, 500, T.navy, num + 'letter-spacing: -.03em; white-space: nowrap;')}">${valor}</span>
            <span style="margin-top: 5px; height: 16px; display: flex; align-items: center; gap: 6px; ${t(12.5, 16, activa ? 600 : 400, activa ? T.navy : T.muted, truncar)}">${activa ? `${icono('check', 13, 2.5)}${k === 'all' ? 'Filtro activo' : 'Filtro activo · pulsa para quitar'}` : 'Pulsa para filtrar'}</span>
            ${activa ? `<span style="position: absolute; left: 0; right: 0; bottom: -12px; height: 3px; border-radius: 3px; background: ${T.navy};"></span>` : ''}
          </div>`;
const franjaLista = (activo = 'all') => `
        <div style="height: ${H.franja}px; flex-shrink: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr) 1px) minmax(0, 1fr); column-gap: 24px;">
          ${cifraFiltro({ k: 'all', marca: marcaIco('calendar'), etq: 'Todas', valor: miles(LISTA.stats.all), activa: activo === 'all' })}${divisor()}
          ${cifraFiltro({ k: 'pending', marca: marcaIco('clock', GRAF.aviso), etq: 'Pendientes', valor: miles(LISTA.stats.pending), activa: activo === 'pending' })}${divisor()}
          ${cifraFiltro({ k: 'confirmed', marca: marcaIco('calendar-check-2', GRAF.ok), etq: 'Confirmadas', valor: miles(LISTA.stats.confirmed), activa: activo === 'confirmed' })}${divisor()}
          ${cifraFiltro({ k: 'cancelled', marca: marcaIco('calendar-x', GRAF.mal), etq: 'Canceladas', valor: miles(LISTA.stats.cancelled), activa: activo === 'cancelled' })}
        </div>`;

const campoFecha = (etq, valor) => `
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="${t(12.5, 16, 500, T.muted, 'white-space: nowrap;')}">${etq}</span>
                  <div style="width: 138px; height: 36px; border-radius: 10px; background: #ffffff; box-shadow: inset 0 0 0 1px ${navyA(0.58)}; display: flex; align-items: center; gap: 9px; padding: 0 11px; color: ${T.muted};">
                    ${icono('calendar', 15, 1.75)}<span style="${t(13, 18, 500, T.navy, num)}">${valor}</span>
                  </div>
                </div>`;

const barraLista = `
            <div style="height: 64px; flex-shrink: 0; padding: 0 ${PH}px; display: flex; align-items: center; gap: 14px; border-bottom: 1px solid ${C.filete};">
              ${buscador('Buscar por paciente, cédula, teléfono, médico, especialidad...', 410)}
              <div style="width: 1px; height: 28px; background: ${C.fileteFondo}; margin: 0 4px;"></div>
              <span style="display: flex; align-items: center; gap: 7px; ${t(12.5, 16, 600, T.navy, 'white-space: nowrap;')}">${icono('calendar-range', 15, 1.9)}Fecha de la cita</span>
              ${campoFecha('Desde', LISTA.desde)}
              ${campoFecha('Hasta', LISTA.hasta)}
              <span title="Limpiar fechas" style="display: flex; align-items: center; gap: 5px; height: 32px; padding: 0 8px; border-radius: 8px; ${t(12.5, 16, 600, T.navy, 'white-space: nowrap;')}">${icono('x', 14, 2.25)}Limpiar fechas</span>
            </div>`;

const cabezaLista = `
            <div style="height: ${H.thead}px; flex-shrink: 0; padding: 0 ${PH}px; display: grid; grid-template-columns: ${COLS}; column-gap: 20px; align-items: center; background: ${C.banda}; border-bottom: 1px solid ${C.filete};">
              ${th('#', { der: true, sort: 'none' })}${th('Paciente', { sort: 'none' })}${th('Cita', { sort: 'asc' })}${th('Profesional', { sort: 'none' })}${th('Recordatorio', { sort: 'none' })}${th('Respuesta')}
            </div>`;

const botonPagina = (ico, texto, activo, izq = true) => `
                <div${activo ? '' : ' title="No hay página anterior"'} style="height: 34px; display: flex; align-items: center; gap: 6px; padding: 0 ${izq ? '12px 0 9px' : '9px 0 12px'}; border-radius: 9px; background: #ffffff; box-shadow: inset 0 0 0 1px ${activo ? navyA(0.2) : navyA(0.1)}; ${t(13, 18, 600, activo ? T.navy : navyA(0.4), 'white-space: nowrap;')}">${izq ? icono(ico, 15, 2) + texto : texto + icono(ico, 15, 2)}</div>`;
const pieLista = `
            <div style="position: absolute; left: 0; right: 0; bottom: 0; height: 56px; z-index: 6; padding: 0 ${PH}px 0 ${X_TXT}px; display: flex; align-items: center; justify-content: space-between; gap: 16px; background: rgba(255,255,255,.96); border-top: 1px solid ${C.fileteFondo}; box-shadow: 0 -10px 20px -14px ${navyA(0.25)};">
              <span style="${t(12.5, 16, 400, T.muted, num)}">Mostrando <span style="font-weight: 600; color: ${T.navy};">${LISTA.from} – ${LISTA.to}</span> de ${miles(LISTA.total)} citas</span>
              <div style="display: flex; align-items: center; gap: 14px;">
                <span style="${t(12.5, 16, 500, T.muted, num)}">Página <span style="font-weight: 600; color: ${T.navy};">${LISTA.pagina}</span> de ${miles(LISTA.ultima)}</span>
                <div style="display: flex; align-items: center; gap: 8px;">${botonPagina('chevron-left', 'Anterior', false, true)}${botonPagina('chevron-right', 'Siguiente', true, false)}</div>
              </div>
            </div>`;

const pantallaLista = `
      <div style="position: absolute; inset: 0; padding: ${PAD}px ${PAD}px 0; display: flex; flex-direction: column; gap: ${GAP}px;">
        ${cabeceraLista}
        ${franjaLista('all')}
        <div style="position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; border-radius: 16px 16px 0 0; background: ${C.hoja}; box-shadow: ${sombraHoja}; overflow: hidden;">
          ${barraLista}
          ${cabezaLista}
          ${FILAS_LISTA.map((c, i) => filaCita(c, LISTA.from + i, { conCedula: true })).join('')}
          ${pieLista}
        </div>
      </div>`;
escribir('Lista.dc.html', documento(carcasaMarco({ activo: 'appointments', contenido: pantallaLista, ancho: 1440 })), '1440x900');

// ══ Estados del envío ═════════════════════════════════════════════════════════════════════════════
// 1. Sin envío en curso, con más de 2.000 por enviar (sale la advertencia) y la confirmación de enviar abierta.
const QUIETO = { pending: 2184, pending_tomorrow: 412 };
const confirmarEnvio = `
              <div style="position: absolute; right: ${PH}px; top: ${H.banda + H.aviso + H.sub + H.tanda - 6}px; width: 400px; z-index: 8; padding: 16px 18px; border-radius: 14px; background: #ffffff; box-shadow: 0 0 0 1px ${navyA(0.12)}, 0 4px 10px ${navyA(0.08)}, 0 22px 44px -18px ${navyA(0.45)}; display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; align-items: flex-start; gap: 12px;">
                  <span style="width: 32px; height: 32px; flex-shrink: 0; border-radius: 9px; background: ${navyA(0.08)}; color: ${T.navy}; display: flex; align-items: center; justify-content: center;">${icono('send', 16, 2)}</span>
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span style="${t(14.5, 20, 600, T.navy, num)}">¿Enviar ${miles(QUIETO.pending)} recordatorios?</span>
                    <span style="${t(13, 19, 400, T.muted, num)}">Les llega un WhatsApp a los pacientes con cita el ${PANEL.pasado}. Salen en segundo plano y se puede pausar o detener.</span>
                  </div>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 8px;">
                  ${botonSecundario('x', 'Cancelar')}${botonPrimario('send', `Sí, enviar ${miles(QUIETO.pending)}`)}
                </div>
              </div>`;
const miniQuieto = `
          <div style="position: relative; display: flex; flex-direction: column; border-radius: 16px; background: ${C.hoja}; box-shadow: ${sombraHoja};">
            <div style="border-radius: 16px; overflow: hidden; display: flex; flex-direction: column;">
              ${banda({ ico: 'send', titulo: 'Envío de recordatorios', est: chip('quieto'), texto: TXT_BANDA_ENVIO })}
              ${aviso(`Tienes ${miles(QUIETO.pending)} recordatorios pendientes para pasado mañana. El sistema respetará el límite de 2.000 mensajes por día según las políticas de Meta.`)}
              ${sub('Por enviar', 'por fecha de la cita · cada botón pide confirmación antes de enviar')}
              ${tanda({ cuando: 'Pasado mañana', fecha: PANEL.pasado, n: QUIETO.pending, boton: `<div style="box-shadow: 0 0 0 3px ${navyA(0.16)}; border-radius: 12px;">${botonPrimario('send', `Enviar ${miles(QUIETO.pending)} recordatorios`)}</div>` })}
              ${tanda({ cuando: 'Mañana (día antes)', fecha: PANEL.manana, n: QUIETO.pending_tomorrow, final: true, boton: botonPrimario('calendar-check-2', `Enviar día antes (${miles(QUIETO.pending_tomorrow)})`) })}
            </div>
            ${confirmarEnvio}
          </div>`;
const ALTO_QUIETO = H.banda + H.aviso + H.sub + 2 * H.tanda;

// 2. En pausa.
const miniPausa = `
          <div style="display: flex; flex-direction: column; border-radius: 16px; background: ${C.hoja}; box-shadow: ${sombraHoja}; overflow: hidden;">
            ${banda({ ico: 'send', titulo: 'Envío de recordatorios', est: chip('pausa'), texto: TXT_BANDA_ENVIO, derecha: accionesEnvio(true) })}
            ${bloqueProgreso({ pausado: true }).replace(`border-bottom: 1px solid ${C.filete};`, '')}
          </div>`;
const ALTO_PAUSA = H.banda + H.progreso;

// 3. Confirmación de detener, sobre el envío en curso velado.
const P = PANEL.progreso;
const dialogoDetener = `
            <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 460px; z-index: 12; border-radius: 16px; background: #ffffff; box-shadow: 0 0 0 1px ${navyA(0.1)}, 0 6px 14px ${navyA(0.1)}, 0 30px 60px -20px ${navyA(0.55)}; overflow: hidden;">
              <div style="padding: 22px 24px 18px; display: flex; gap: 14px;">
                <span style="width: 38px; height: 38px; flex-shrink: 0; border-radius: 10px; background: ${FONDO.mal}; box-shadow: inset 0 0 0 1px ${FONDO.malBorde}; color: ${TXT.mal}; display: flex; align-items: center; justify-content: center;">${icono('square', 17, 2.25)}</span>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <span style="${t(16.5, 22, 600, T.navy, 'letter-spacing: -.01em;')}">¿Detener el envío de recordatorios?</span>
                  <span style="${t(13.5, 20, 400, T.muted, num)}">Se cancelan los <span style="font-weight: 600; color: ${T.navy};">${miles(P.pending)}</span> que faltan por salir. Los ${miles(P.sent + P.failed)} ya procesados no se deshacen.</span>
                  <span style="${t(13.5, 20, 400, T.muted)}">Después podrás volver a enviar desde esta pantalla.</span>
                </div>
              </div>
              <div style="padding: 14px 24px; display: flex; justify-content: flex-end; gap: 8px; background: ${C.banda}; border-top: 1px solid ${C.filete};">
                ${botonSecundario('play', 'Seguir enviando')}${botonPeligroLleno('square', 'Sí, detener el envío')}
              </div>
            </div>`;
const ALTO_DETENER = H.banda + H.progreso + 130;
const miniDetener = `
          <div style="position: relative; height: ${ALTO_DETENER}px; flex-shrink: 0; border-radius: 16px; background: ${C.hoja}; box-shadow: ${sombraHoja}; overflow: hidden;">
            <div style="display: flex; flex-direction: column;">
              ${banda({ ico: 'send', titulo: 'Envío de recordatorios', est: chip('enviando'), texto: TXT_BANDA_ENVIO, derecha: accionesEnvio(false) })}
              ${bloqueProgreso()}
              ${sub('Por enviar', 'por fecha de la cita')}
            </div>
            <div style="position: absolute; inset: 0; z-index: 10; background: ${navyA(0.28)};"></div>
            ${dialogoDetener}
          </div>`;

const pie = (n, titulo, texto) => `
          <div style="display: flex; align-items: baseline; gap: 12px; padding: 0 4px;">
            <span style="${t(12, 16, 600, T.navy, num + 'white-space: nowrap;')}">${n}</span>
            <span style="${t(14, 20, 600, T.navy, 'white-space: nowrap;')}">${titulo}</span>
            <span style="${t(13, 18, 400, T.muted, truncar)}">${texto}</span>
          </div>`;
const H_PIE = 20, GAP_PIE = 12, GAP_EST = 36;
const ALTO_ESTADOS = PAD + 3 * (H_PIE + GAP_PIE) + ALTO_QUIETO + ALTO_PAUSA + ALTO_DETENER + 2 * GAP_EST + PAD + 40;
escribir('Estados.dc.html', documento(`
<div style="position: relative; width: ${ISLA.ancho}px; height: ${ALTO_ESTADOS}px; overflow: hidden; border-radius: ${RADIO_ISLA}px; background: ${T.bg}; font-family: ${T.font};">
      <div style="padding: ${PAD}px; display: flex; flex-direction: column;">
        ${pie('1', 'Sin envío en curso', 'Los botones de enviar están activos y cada uno pide confirmación.')}
        <div style="height: ${GAP_PIE}px;"></div>
        ${miniQuieto}
        <div style="height: ${GAP_EST + 40}px;"></div>
        ${pie('2', 'En pausa', 'No sale nada hasta reanudar. Detener sigue a mano.')}
        <div style="height: ${GAP_PIE}px;"></div>
        ${miniPausa}
        <div style="height: ${GAP_EST}px;"></div>
        ${pie('3', 'Detener', 'Siempre pregunta antes. La opción segura es la de la izquierda.')}
        <div style="height: ${GAP_PIE}px;"></div>
        ${miniDetener}
      </div>
</div>`), `${ISLA.ancho}x${ALTO_ESTADOS}`);

console.log(`  muestra: ${PANEL.reciente.sent} enviadas y ${PANEL.reciente.cancelled} canceladas en las ${ULTIMAS.length} recientes; progreso ${P.pct} %`);
