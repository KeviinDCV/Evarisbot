// Chat interno (/admin/internal-chat) rediseñado dentro de la carcasa "Marco navy", en el lenguaje de
// Usuarios, Configuración, Estadísticas, Citas, Envío masivo y Plantillas.
//
// Idea: dos paneles a pantalla completa dentro de la isla. A la izquierda la lista (densa, filas de 64 px,
// no leídos primero); a la derecha la conversación con su cabecera, los mensajes y el compositor pegado
// abajo. Las burbujas son un "lenguaje de chat" que luego hereda Conversaciones: misma forma, mismas
// piezas (nombre, respuesta citada, adjunto, hora, editado, reacciones, vistos); lo único que cambia es el
// color de lo propio (aquí navy suave; con pacientes, el verde de WhatsApp) para no confundir los chats.
//
// Escribe:
//   Main.dc.html     1440x900: chat de GRUPO abierto, menú PLEGADO (isla 1358x880).
//   Uno.dc.html      1440x900: chat uno a uno con «IA - Prueba» (el bot de prueba), menú FIJADO (isla 1190x880).
//   Estados.dc.html  1440 x alto: nuevo chat/grupo, detalles del grupo, acciones de un mensaje, confirmaciones,
//                    vacíos y móvil (390).
//
// TODO es de EJEMPLO e inventado: compañeros (los de design/usuarios/_comun.mjs), grupos, mensajes, archivos y
// horas. Forma real de InternalChatController (index, messages, poll, receipts, aiReply). "Hoy" = 13 sept 2026.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { T, icono, documento, NAV, NO_LEIDOS, iniciales, GRANO_ATTR } from '../usuarios/_comun.mjs';
import { carcasaMarco, ISLA, RADIO_ISLA, MARCO } from '../usuarios/_marco.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));

// ══ Paleta ════════════════════════════════════════════════════════════════════════════════════════
// Texto con color (mín. 4,5:1 sobre blanco): esmeralda 700 5,48 · ámbar 700 5,02 · rojo 700 6,47 ·
// cielo 700 5,93. Tinta de mensajes #1c2238 sobre la burbuja propia #e5e9f6: 13,1:1. Gris de hora
// T.muted #5c6485 sobre #e5e9f6: 4,75:1; sobre el fondo del chat #f4f5f9: 5,3:1. Número de no leídos:
// blanco sobre navy 9,7:1 (navy = no leídos del chat interno; el rojo queda para los de pacientes).
const GRAF = { ok: '#059669', aviso: '#d97706', mal: '#dc2626', curso: '#0284c7', neutro: '#94a3b8', linea: '#10b981' };
const TXT = { ok: '#047857', aviso: '#b45309', mal: '#b91c1c', curso: '#0369a1', neutro: '#475569' };
const FONDO = { ok: '#ecfdf5', okBorde: '#a7f3d0', mal: '#fef2f2', malBorde: '#fecaca', aviso: '#fffbeb', avisoBorde: '#fde68a', curso: '#f0f9ff', cursoBorde: '#bae6fd' };
const navyA = (a) => `rgba(46,63,132,${a})`;
const INK = '#1c2238';
const CH = { lista: '#ffffff', fondo: '#f4f5f9', propia: '#e5e9f6', ajena: '#ffffff', filete: navyA(0.08), fileteFuerte: navyA(0.13), sel: navyA(0.065), campo: navyA(0.035), banda: navyA(0.028) };
const MONO = "font-family: ui-monospace, 'Cascadia Mono', 'SF Mono', Consolas, monospace;";
const truncar = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
const num = 'font-variant-numeric: tabular-nums;';
const sombraDialogo = `0 0 0 1px ${navyA(0.1)}, 0 6px 14px ${navyA(0.1)}, 0 30px 60px -20px ${navyA(0.55)}`;
const sombraFlota = `0 0 0 1px ${navyA(0.1)}, 0 4px 10px ${navyA(0.1)}, 0 16px 32px -12px ${navyA(0.35)}`;

// Reacciones rápidas reales (QUICK_REACTIONS), como entidades: son contenido, no adorno.
const E = { like: '&#x1F44D;', love: '&#x2764;&#xFE0F;', haha: '&#x1F602;', wow: '&#x1F62E;', sad: '&#x1F622;', gracias: '&#x1F64F;', hola: '&#x1F44B;', sonrisa: '&#x1F642;', feliz: '&#x1F60A;' };
const REACCIONES = [[E.like, 'Me gusta'], [E.love, 'Me encanta'], [E.haha, 'Me divierte'], [E.wow, 'Me asombra'], [E.sad, 'Me entristece'], [E.gracias, 'Gracias']];

// ══ Piezas base ═══════════════════════════════════════════════════════════════════════════════════
const t = (px, lh, peso, color, extra = '') => `font-size: ${px}px; line-height: ${lh}px; font-weight: ${peso}; color: ${color}; ${extra}`;
const punto = (color, d = 8) => `<span style="width: ${d}px; height: ${d}px; flex-shrink: 0; border-radius: 9999px; background: ${color};"></span>`;
const ico = (nombre, color, s = 14, sw = 2) => `<span style="display: flex; color: ${color};">${icono(nombre, s, sw)}</span>`;
const tit = (x) => (x ? ` title="${x}"` : '');

const btnBase = (alto = 34) => `height: ${alto}px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 0 14px 0 12px; border-radius: 10px; font-size: 13px; line-height: 18px; font-weight: 600; white-space: nowrap;`;
const botonPrimario = (i, texto, titulo = '', alto = 34) =>
  `<div${tit(titulo)} style="${btnBase(alto)} background: ${T.btnPrimary}; box-shadow: 0 1px 2px ${navyA(0.3)}, 0 6px 16px -6px ${navyA(0.55)}, inset 0 1px 0 rgba(255,255,255,.14); color: #ffffff;">${i ? icono(i, 15, 2) : ''}${texto}</div>`;
const botonSecundario = (i, texto, titulo = '', alto = 34) =>
  `<div${tit(titulo)} style="${btnBase(alto)} background: #ffffff; box-shadow: inset 0 0 0 1px ${navyA(0.2)}, 0 1px 2px ${navyA(0.08)}; color: ${T.navy};">${i ? icono(i, 15, 1.9) : ''}${texto}</div>`;
const botonPeligro = (i, texto, titulo = '', alto = 34) =>
  `<div${tit(titulo)} style="${btnBase(alto)} background: #ffffff; box-shadow: inset 0 0 0 1px rgba(220,38,38,.55); color: ${TXT.mal};">${i ? icono(i, 15, 2) : ''}${texto}</div>`;
const botonPeligroLleno = (i, texto) =>
  `<div style="${btnBase()} background: ${GRAF.mal}; box-shadow: 0 1px 2px rgba(185,28,28,.35), 0 6px 16px -6px rgba(220,38,38,.55), inset 0 1px 0 rgba(255,255,255,.14); color: #ffffff;">${icono(i, 15, 2)}${texto}</div>`;
const botonIcono = (i, color, titulo, s = 32, extra = '') =>
  `<div title="${titulo}" style="width: ${s}px; height: ${s}px; flex-shrink: 0; border-radius: 9px; display: flex; align-items: center; justify-content: center; color: ${color}; ${extra}">${icono(i, 17, 1.9)}</div>`;

const casilla = (on) => on
  ? `<span style="width: 18px; height: 18px; flex-shrink: 0; border-radius: 5px; background: ${T.navy}; color: #ffffff; display: flex; align-items: center; justify-content: center;">${icono('check', 12, 3)}</span>`
  : `<span style="width: 18px; height: 18px; flex-shrink: 0; border-radius: 5px; background: #ffffff; box-shadow: inset 0 0 0 1.5px ${T.slate500};"></span>`;

const buscador = (texto, alto = 36) => `
              <div style="position: relative; min-width: 0;">
                <span style="position: absolute; left: 11px; top: ${(alto - 16) / 2}px; color: ${T.muted};">${icono('search', 16, 1.75)}</span>
                <div style="height: ${alto}px; border-radius: 10px; padding: 0 12px 0 36px; background: ${CH.campo}; box-shadow: inset 0 0 0 1px ${navyA(0.1)}; ${t(13, 18, 400, T.muted, truncar)} display: flex; align-items: center;">${texto}</div>
              </div>`;

const campo = ({ valor = '', ejemplo = '', foco = false, alto = 38 }) => `
                <div style="height: ${alto}px; border-radius: 9px; background: #ffffff; box-shadow: inset 0 0 0 1px ${foco ? T.navy : navyA(0.58)}${foco ? `, 0 0 0 3px ${navyA(0.14)}` : ''}; display: flex; align-items: center; padding: 0 11px; ${valor ? t(13, 18, 500, T.navy) : t(13, 18, 400, T.muted)} ${truncar}">${valor || ejemplo}${foco ? `<span style="width: 1.5px; height: 17px; margin-left: 1px; background: ${T.navy};"></span>` : ''}</div>`;
const etiqueta = (texto, opc = '') => `<span style="${t(12.5, 16, 600, T.navy, 'white-space: nowrap;')}">${texto}${opc ? `<span style="font-weight: 400; color: ${T.muted};"> ${opc}</span>` : ''}</span>`;
const rotulo = (x) => `<span style="${t(11, 16, 600, T.muted, 'text-transform: uppercase; letter-spacing: .07em; white-space: nowrap;')}">${x}</span>`;

// ══ Personas (nombres de _comun.mjs, escritos como nombre propio) ═════════════════════════════════
// c = forma corta para «Visto por…» y las vistas previas; el nombre completo va en el title.
const P = {
  yo:       { n: 'Sofía Quintero Ramos',          c: 'Sofía',          r: 'admin',   on: true },
  andrea:   { n: 'Andrea Carolina Muñoz Paz',     c: 'Andrea',         r: 'advisor', on: true },
  juan:     { n: 'Juan Pablo Restrepo Vélez',     c: 'Juan Pablo',     r: 'advisor', on: true },
  mafe:     { n: 'María Fernanda Loaiza Cruz',    c: 'María Fernanda', r: 'advisor', on: true },
  diego:    { n: 'Diego Alejandro Sánchez Rojas', c: 'Diego',          r: 'advisor', on: true },
  luisa:    { n: 'Luisa María Caicedo Gómez',     c: 'Luisa',          r: 'advisor', on: true },
  hernan:   { n: 'Hernán Ocampo Díaz',            c: 'Hernán',         r: 'admin',   on: true },
  vale:     { n: 'Valentina Ospina Toro',         c: 'Valentina',      r: 'advisor', on: false },
  cristian: { n: 'Cristian David Moreno Lasso',   c: 'Cristian',       r: 'advisor', on: false },
  paola:    { n: 'Paola Andrea Viveros Solarte',  c: 'Paola',          r: 'advisor', on: false },
  ricardo:  { n: 'Ricardo Salazar Mejía',         c: 'Ricardo',        r: 'admin',   on: false },
  jessica:  { n: 'Jessica Tatiana Bolaños Arias', c: 'Jessica',        r: 'advisor', on: false },
  camila:   { n: 'Camila Andrea Rincón Pérez',    c: 'Camila',         r: 'advisor', on: false },
  santiago: { n: 'Santiago Andrés Hurtado Mejía', c: 'Santiago',       r: 'advisor', on: false },
  ia:       { n: 'IA - Prueba',                   c: 'IA - Prueba',    r: 'ai',      on: true },
};
const rolTxt = (r) => (r === 'admin' ? 'Administrador' : r === 'ai' ? 'Bot de prueba' : 'Asesor');
const listaNombres = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

/** Avatar: persona = círculo de iniciales; grupo = cuadro redondeado con el icono; bot = cuadro cielo. */
const avatar = (p, d = 36, { fondoAnillo = '#ffffff', conPunto = true } = {}) => {
  const fs_ = d >= 36 ? 13 : d >= 28 ? 11 : 11;
  const dentro = p.r === 'ai'
    ? `<div style="width: ${d}px; height: ${d}px; border-radius: ${Math.round(d * 0.3)}px; background: ${FONDO.curso}; box-shadow: inset 0 0 0 1px ${FONDO.cursoBorde}; color: ${TXT.curso}; display: flex; align-items: center; justify-content: center;">${icono('bot', Math.round(d * 0.5), 1.9)}</div>`
    : `<div style="width: ${d}px; height: ${d}px; border-radius: 9999px; background: ${p.r === 'admin' ? T.navyDeep : '#3e4f94'}; color: #ffffff; ${t(fs_, 14, 600, '#ffffff', 'letter-spacing: .02em;')} display: flex; align-items: center; justify-content: center;">${iniciales(p.n)}</div>`;
  const dot = conPunto && p.on
    ? `<span title="En línea" style="position: absolute; right: -1px; bottom: -1px; width: ${d >= 34 ? 11 : 9}px; height: ${d >= 34 ? 11 : 9}px; border-radius: 9999px; background: ${GRAF.linea}; box-shadow: 0 0 0 2px ${fondoAnillo};"></span>` : '';
  return `<div title="${p.n}" style="position: relative; width: ${d}px; height: ${d}px; flex-shrink: 0;">${dentro}${dot}</div>`;
};
const avatarGrupo = (d = 36) =>
  `<div style="width: ${d}px; height: ${d}px; flex-shrink: 0; border-radius: ${Math.round(d * 0.3)}px; background: ${T.navyDeep}; color: #ffffff; display: flex; align-items: center; justify-content: center;">${icono('users', Math.round(d * 0.47), 1.9)}</div>`;

/** Pila de caras pequeñas (cabecera del grupo y «Visto por»). */
const pila = (ps, d = 24, fondo = '#ffffff', extra = 0) => `
                <div style="display: flex; align-items: center;">${ps.map((p, k) => `<div title="${p.n}" style="position: relative; ${k ? `margin-left: -${Math.round(d * 0.2)}px;` : ''} width: ${d}px; height: ${d}px; flex-shrink: 0; border-radius: 9999px; background: ${p.r === 'admin' ? T.navyDeep : '#3e4f94'}; box-shadow: 0 0 0 2px ${fondo}; color: #ffffff; ${t(d >= 22 ? 11 : 11, 12, 600, '#ffffff', d < 22 ? 'font-size: 11px; letter-spacing: -.02em;' : '')} display: flex; align-items: center; justify-content: center;">${d < 22 ? iniciales(p.n).charAt(0) : iniciales(p.n)}</div>`).join('')}${extra ? `<div style="margin-left: -${Math.round(d * 0.2)}px; height: ${d}px; min-width: ${d}px; padding: 0 5px; border-radius: 9999px; background: ${CH.propia}; box-shadow: 0 0 0 2px ${fondo}; ${t(11, 12, 600, T.navy, num)} display: flex; align-items: center; justify-content: center;">+${extra}</div>` : ''}
                </div>`;

// ══ Datos de EJEMPLO: la lista ════════════════════════════════════════════════════════════════════
// Forma de InternalChatController@index: name, type, unread, participants, latest_message{body,type,
// user_name,created_at}. Orden real: no leídos primero y luego lo más reciente.
const G_AGENDA = { id: 'agenda', tipo: 'g', nombre: 'Agendamiento consulta externa', ps: [P.yo, P.andrea, P.juan, P.mafe, P.diego, P.luisa, P.hernan], creador: P.yo };
const G_TURNOS = { id: 'turnos', tipo: 'g', nombre: 'Turnos fin de semana', ps: [P.hernan, P.vale, P.yo, P.diego, P.camila] };
const G_COORD = { id: 'coord', tipo: 'g', nombre: 'Coordinación HUV', ps: Array(12).fill(P.ricardo) };
const G_SOPORTE = { id: 'soporte', tipo: 'g', nombre: 'Soporte Evarisbot', ps: Array(4).fill(P.cristian) };
const D = (p, extra) => ({ id: p.c, tipo: 'd', p, nombre: p.n, ...extra });

const CHATS_MAIN = [
  { ...D(P.andrea), prev: { de: P.andrea, txt: '¿Me ayudas con una cita que no aparece en la agenda?' }, cuando: 'hace 3 min', unread: 1 },
  { ...G_TURNOS, prev: { de: P.vale, txt: 'Yo puedo cubrir el sábado en la mañana.' }, cuando: 'hace 20 min', unread: 1 },
  { ...G_AGENDA, prev: { de: P.luisa, txt: 'Entendido. ¿Les pido un número de contacto en el chat?' }, cuando: 'hace 1 min', unread: 0 },
  { ...D(P.hernan), prev: { de: P.yo, txt: 'Te envío el informe de la semana antes de las 12.' }, cuando: 'hace 1 h', unread: 0 },
  { ...G_COORD, prev: { de: P.ricardo, tipo: 'document' }, cuando: 'hace 2 h', unread: 0 },
  { ...D(P.juan), prev: { de: P.juan, tipo: 'image' }, cuando: 'ayer', unread: 0 },
  { ...D(P.ia), prev: { de: P.ia, txt: '¿Sigues ahí? Seguimos cuando quieras, justo donde lo dejamos.' }, cuando: 'ayer', unread: 0 },
  { ...D(P.paola), prev: { de: P.yo, txt: 'Gracias, Paola. Quedó corregido.' }, cuando: 'hace 3 días', unread: 0 },
  { ...G_SOPORTE, prev: { de: P.cristian, txt: 'Ya quedó el cambio en los recordatorios de Cartago.' }, cuando: 'hace 5 días', unread: 0 },
  { ...D(P.vale), prev: { de: P.vale, txt: 'Mañana llego a las 7 en punto.' }, cuando: 'hace 1 semana', unread: 0 },
  { ...D(P.cristian), prev: { de: P.yo, txt: '¿Puedes revisar el envío masivo de ayer?' }, cuando: 'hace 2 semanas', unread: 0 },
  { ...D(P.camila), prev: null, cuando: '', unread: 0 },
];
const RESUMEN = { total: CHATS_MAIN.length, noLeidos: 2, grupos: 4, directos: 8, enLinea: 6 };

// Lista del artboard Uno: la conversación con la IA acaba de moverse (ahora).
const CHATS_UNO = [
  CHATS_MAIN[0], CHATS_MAIN[1],
  { ...D(P.ia), prev: { de: P.yo, txt: '1000000001' }, cuando: 'ahora', unread: 0 },
  { ...CHATS_MAIN[2], prev: { de: P.yo, txt: 'Sí, y el horario en que se les puede llamar.' }, cuando: 'hace 30 min' },
  CHATS_MAIN[3], CHATS_MAIN[4], CHATS_MAIN[5], CHATS_MAIN[7], CHATS_MAIN[8], CHATS_MAIN[9], CHATS_MAIN[10], CHATS_MAIN[11],
];

// ══ Lista de chats ════════════════════════════════════════════════════════════════════════════════
const previa = (c) => {
  if (!c.prev) return `<span style="${t(13, 18, 400, T.muted, 'font-style: normal;')}">Nuevo chat · aún sin mensajes</span>`;
  const quien = c.prev.de === P.yo ? 'Tú: ' : c.tipo === 'g' ? `${c.prev.de.c}: ` : '';
  const fuerte = c.unread > 0;
  const cuerpo = c.prev.tipo === 'image' ? `<span style="display: inline-flex; align-items: center; gap: 4px; vertical-align: -2px;">${icono('image', 14, 1.9)}Foto</span>`
    : c.prev.tipo === 'document' ? `<span style="display: inline-flex; align-items: center; gap: 4px; vertical-align: -2px;">${icono('paperclip', 14, 1.9)}Archivo</span>`
      : c.prev.txt;
  return `<span style="min-width: 0; flex: 1; ${t(13, 18, fuerte ? 500 : 400, fuerte ? INK : T.muted, truncar)}"><span style="color: ${fuerte ? T.navy : T.muted}; font-weight: ${fuerte ? 600 : 500};">${quien}</span>${cuerpo}</span>`;
};
const pildoraNoLeidos = (n) => `<span title="${n} sin leer" style="height: 20px; min-width: 20px; padding: 0 6px; flex-shrink: 0; border-radius: 9999px; background: ${T.navy}; ${t(11, 12, 700, '#ffffff', num)} display: flex; align-items: center; justify-content: center;">${n}</span>`;

const filaChat = (c, { sel = false, ultima = false } = {}) => {
  const fuerte = c.unread > 0;
  const av = c.tipo === 'g' ? avatarGrupo(38) : avatar(c.p, 38, { fondoAnillo: sel ? '#eef0f7' : '#ffffff' });
  const cuenta = c.tipo === 'g' ? `<span title="${c.ps.length} participantes" style="flex-shrink: 0; display: inline-flex; align-items: center; gap: 3px; ${t(12, 16, 500, T.muted, num)}">${icono('users', 12, 2)}${c.ps.length}</span>` : '';
  const bot = c.tipo === 'd' && c.p.r === 'ai' ? `<span style="flex-shrink: 0; height: 18px; padding: 0 6px; border-radius: 5px; background: ${FONDO.curso}; ${t(11, 12, 600, TXT.curso, 'white-space: nowrap;')} display: inline-flex; align-items: center;">Prueba</span>` : '';
  return `
            <div title="Clic derecho: ${c.tipo === 'g' ? 'renombrar, ver participantes o eliminar' : 'eliminar chat'}" style="position: relative; height: 64px; flex-shrink: 0; margin: 0 8px; padding: 0 10px; border-radius: 10px; display: flex; align-items: center; gap: 12px;${sel ? ` background: ${CH.sel}; box-shadow: inset 0 0 0 1px ${navyA(0.12)};` : ''}">
              ${av}
              <div style="min-width: 0; flex: 1; align-self: stretch; display: flex; flex-direction: column; justify-content: center; gap: 3px;${ultima || sel ? '' : ` box-shadow: 0 1px 0 ${CH.filete};`}">
                <div style="display: flex; align-items: center; gap: 7px; min-width: 0;">
                  <span style="min-width: 0; ${t(13.5, 18, fuerte || sel ? 600 : 500, T.navy, truncar)}">${c.nombre}</span>${cuenta}${bot}
                  <span style="margin-left: auto; flex-shrink: 0; ${t(11.5, 16, fuerte ? 600 : 400, fuerte ? T.navy : T.muted, 'white-space: nowrap;' + num)}">${c.cuando}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">${previa(c)}${fuerte ? pildoraNoLeidos(c.unread) : ''}</div>
              </div>
            </div>`;
};

const filtros = (activa = 'all', compacto = false) => {
  const op = [['all', 'Todos', RESUMEN.total], ['unread', 'No leídos', RESUMEN.noLeidos], ['groups', 'Grupos', RESUMEN.grupos], ['directs', 'Directos', RESUMEN.directos]];
  return `<div style="display: flex; gap: 2px; padding: 3px; border-radius: 10px; background: ${navyA(0.055)};">${op.map(([k, x, n]) => {
    const on = k === activa;
    return `<div style="flex: 1 1 auto; height: 28px; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 0 ${compacto ? 6 : 4}px; border-radius: 8px; ${on ? `background: #ffffff; box-shadow: 0 0 0 1px ${navyA(0.08)}, 0 1px 2px ${navyA(0.12)};` : ''} ${t(12, 16, 600, on ? T.navy : T.muted, 'white-space: nowrap;')}">${x}<span style="${t(11, 16, 600, on ? T.navy : T.muted, num)} opacity: ${on ? 1 : 0.9};">${n}</span></div>`;
  }).join('')}</div>`;
};

/** Panel izquierdo completo. */
const panelLista = ({ ancho, chats, activo, movil = false }) => `
        <div style="width: ${ancho}px; flex-shrink: 0; display: flex; flex-direction: column; background: ${CH.lista}; ${movil ? '' : `box-shadow: 1px 0 0 ${CH.filete};`} position: relative; z-index: 2;">
          <div style="padding: ${movil ? '14px 16px 12px' : '20px 18px 12px'}; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">${movil ? botonIcono('menu', T.navy, 'Abrir el menú', 36, `margin-left: -6px; background: ${navyA(0.05)};`) : ''}
              <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px;">
                <h1 style="${t(20, 26, 600, T.navy, 'letter-spacing: -.02em; white-space: nowrap;')}">Chat interno</h1>
                <span style="${t(12.5, 16, 400, T.muted, 'white-space: nowrap;' + num)}">${RESUMEN.total} conversaciones · <span style="color: ${TXT.ok}; font-weight: 500;">${RESUMEN.enLinea} en línea</span></span>
              </div>
              ${botonPrimario('plus', 'Nuevo', 'Nuevo chat o grupo: con una persona es un chat directo; con varias, un grupo')}
            </div>
            ${buscador('Buscar conversaciones')}
            ${filtros('all', movil)}
          </div>
          <div style="flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; padding-bottom: 8px;">${chats.map((c, k) => filaChat(c, { sel: c.id === activo, ultima: k === chats.length - 1 || chats[k + 1]?.id === activo })).join('')}
          </div>
        </div>`;

// ══ Mensajes ══════════════════════════════════════════════════════════════════════════════════════
const conMencion = (txt, propia) => txt.replace(/@([A-ZÁÉÍÓÚÑ][^@,.]*?(?= ya| lo| te|$))/g, (m) =>
  `<span style="font-weight: 600; color: ${T.navy}; ${propia ? '' : `background: ${navyA(0.08)}; border-radius: 4px; padding: 0 2px;`}">${m}</span>`);
const negritaWA = (txt) => txt.replace(/\*([^*]+)\*/g, '<strong style="font-weight: 600;">$1</strong>');

const adjuntoDoc = (a) => `
                    <div style="margin: 1px 0 6px; padding: 8px 8px 8px 9px; border-radius: 9px; background: ${a.propia ? 'rgba(255,255,255,.62)' : CH.fondo}; box-shadow: inset 0 0 0 1px ${navyA(0.08)}; display: flex; align-items: center; gap: 10px; min-width: 250px;">
                      <span style="width: 34px; height: 40px; flex-shrink: 0; border-radius: 6px; background: #ffffff; box-shadow: inset 0 0 0 1px ${navyA(0.14)}; color: ${a.ext === 'XLSX' ? TXT.ok : T.navy}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;">${icono(a.ext === 'XLSX' ? 'file-spreadsheet' : 'file-text', 16, 1.75)}<span style="${t(11, 11, 700, 'inherit', 'letter-spacing: .02em; font-size: 11px; transform: scale(.82);')}">${a.ext}</span></span>
                      <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 1px;">
                        <span style="${t(13, 18, 600, INK, truncar)}">${a.nombre}</span>
                        <span style="${t(11.5, 16, 400, T.muted, num)}">${a.tipoTxt} · ${a.peso}</span>
                      </div>
                      ${botonIcono('download', T.navy, 'Descargar', 30, `background: #ffffff; box-shadow: inset 0 0 0 1px ${navyA(0.14)};`)}
                    </div>`;

/** Captura inventada de la agenda con error (contenido del mensaje, no adorno). */
const adjuntoImg = (a) => `
                    <div title="Abrir en grande: acercar, alejar, rotar y descargar" style="position: relative; margin: 1px -5px 7px; width: ${a.ancho}px; border-radius: 8px; overflow: hidden; background: #ffffff; box-shadow: inset 0 0 0 1px ${navyA(0.12)};">
                      <div style="display: none; height: 22px; padding: 0 9px; align-items: center; gap: 5px; background: #eef0f5; box-shadow: inset 0 -1px 0 ${navyA(0.08)};">${punto('#c5cad8', 7)}${punto('#c5cad8', 7)}${punto('#c5cad8', 7)}<span style="margin-left: 8px; height: 12px; flex: 1; border-radius: 3px; background: #ffffff;"></span></div>
                      <div style="padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px;">
                        <div style="display: flex; align-items: center; justify-content: space-between;"><span style="${t(12, 16, 600, T.navy)}">Agenda · Ortopedia</span><span style="width: 54px; height: 8px; border-radius: 3px; background: ${navyA(0.1)};"></span></div>
                        <div style="padding: 7px 9px; border-radius: 6px; background: ${FONDO.mal}; box-shadow: inset 0 0 0 1px ${FONDO.malBorde}; display: flex; align-items: center; gap: 7px; ${t(11.5, 15, 600, TXT.mal)}">${icono('circle-alert', 14, 2)}No se pudo cargar la agenda (error 500)</div>
                        ${[0.92].map((w) => `<div style="display: flex; gap: 8px;"><span style="width: 40px; height: 8px; border-radius: 3px; background: ${navyA(0.08)};"></span><span style="width: ${Math.round(w * 100)}%; height: 8px; border-radius: 3px; background: ${navyA(0.06)};"></span></div>`).join('')}
                      </div>
                      <span style="position: absolute; left: 8px; bottom: 8px; height: 20px; padding: 0 7px; border-radius: 5px; background: rgba(28,34,56,.72); display: inline-flex; align-items: center; ${t(11, 14, 500, '#ffffff', MONO)}">${a.nombre}</span>
                    </div>`;

const citada = (r, propia) => `
                    <div title="Ir al mensaje original" style="margin: 1px 0 6px; padding: 6px 9px 7px; border-radius: 8px; background: ${propia ? 'rgba(255,255,255,.6)' : navyA(0.05)}; box-shadow: inset 0 0 0 1px ${navyA(0.08)}; display: flex; flex-direction: column; gap: 1px; max-width: 100%;">
                      <span style="display: flex; align-items: center; gap: 5px; ${t(11.5, 16, 600, T.navy, 'white-space: nowrap;')}">${icono('reply', 12, 2.2)}${r.de}</span>
                      <span style="${t(12.5, 17, 400, T.muted, truncar)}">${r.icono ? `<span style="display: inline-flex; vertical-align: -2px; margin-right: 4px;">${icono(r.icono, 13, 1.9)}</span>` : ''}${r.txt}</span>
                    </div>`;

const chipReaccion = ([em, n, mia, quienes]) => `<span title="${quienes}${mia ? ' · pulsa para quitar la tuya' : ''}" style="height: 24px; padding: 0 7px 0 6px; border-radius: 9999px; background: ${mia ? CH.propia : '#ffffff'}; box-shadow: 0 0 0 1px ${mia ? navyA(0.42) : navyA(0.14)}, 0 1px 2px ${navyA(0.08)}; display: inline-flex; align-items: center; gap: 4px;"><span style="font-size: 13px; line-height: 1;">${em}</span>${n > 1 ? `<span style="${t(11.5, 12, 600, mia ? T.navy : T.muted, num)}">${n}</span>` : ''}</span>`;

const barraAcciones = (propia, texto, lado) => `
                  <div style="position: absolute; top: 50%; ${lado}: calc(100% + 8px); transform: translateY(-50%); height: 34px; padding: 0 3px; border-radius: 10px; background: #ffffff; box-shadow: ${sombraFlota}; display: flex; align-items: center; gap: 1px; z-index: 4;">
                    ${botonIcono('smile-plus', T.muted, 'Reaccionar', 28)}${botonIcono('reply', T.muted, 'Responder', 28)}${propia && texto ? botonIcono('pencil', T.muted, 'Editar (solo tus mensajes de texto)', 28) : ''}
                  </div>`;

/** Una burbuja + reacciones + vistos. m: { de, hora, txt, adj, reac, editado, resp, visto, hover } */
const burbuja = (m, { propia, primero, esGrupo, max, fondo }) => {
  const meta = `${m.editado ? 'editado · ' : ''}${m.hora}`;
  const metaHtml = `<span style="${t(11, 14, 400, T.muted, 'white-space: nowrap;' + num)} display: inline-flex; align-items: center; gap: 3px;">${m.editado ? `<span style="font-style: italic;">editado</span> · ` : ''}${m.hora}${propia ? `<span title="Enviado" style="display: flex; color: ${T.muted};">${icono('check', 13, 2.2)}</span>` : ''}</span>`;
  const huecoMeta = Math.round(meta.length * 5.9 + (propia ? 22 : 8));
  const radio = propia ? `12px ${primero ? 4 : 12}px 12px 12px` : `${primero ? 4 : 12}px 12px 12px 12px`;
  const nombre = !propia && primero && esGrupo ? `<span style="display: block; margin-bottom: 2px; ${t(12.5, 17, 600, m.de.r === 'admin' ? T.navyDeep : T.navy, truncar)}">${m.de.n}${m.de.r === 'admin' ? `<span style="margin-left: 6px; ${t(11, 14, 500, T.muted)}">Administrador</span>` : ''}</span>` : '';
  const texto = m.txt ? `<p style="${t(14, 20, 400, INK, 'white-space: pre-wrap; overflow-wrap: anywhere;')}">${m.bot ? negritaWA(m.txt) : conMencion(m.txt, propia)}${m.adj ? '' : `<span style="display: inline-block; width: ${huecoMeta}px; height: 1px;"></span>`}</p>` : '';
  const adj = m.adj ? (m.adj.tipo === 'img' ? adjuntoImg(m.adj) : adjuntoDoc({ ...m.adj, propia })) : '';
  const metaPos = m.adj ? `<div style="display: flex; justify-content: flex-end; margin-top: 2px;">${metaHtml}</div>` : `<span style="position: absolute; right: 10px; bottom: 5px;">${metaHtml}</span>`;
  const reac = m.reac?.length ? `<div style="display: flex; gap: 4px; margin-top: -7px; ${propia ? 'justify-content: flex-end; padding-right: 10px;' : 'padding-left: 10px;'} position: relative; z-index: 2;">${m.reac.map(chipReaccion).join('')}</div>` : '';
  const visto = m.visto ? `<div title="${m.visto.map((p) => p.n).join(', ')}" style="display: flex; align-items: center; justify-content: flex-end; gap: 6px; margin-top: ${m.reac?.length ? 5 : 4}px; padding-right: 2px;"><span style="display: flex; color: ${T.navy};">${icono('check-check', 14, 2.2)}</span><span style="${t(11.5, 16, 500, T.muted, 'white-space: nowrap;')}">${esGrupo ? `Visto por ${listaNombres(m.visto.map((p) => p.c))}` : 'Visto'}</span></div>` : '';
  return `
              <div style="display: flex; flex-direction: column; align-items: ${propia ? 'flex-end' : 'flex-start'}; max-width: ${max}px; min-width: 0;">
                <div style="position: relative; max-width: 100%;">
                  <div id="msg" style="position: relative; padding: 7px 10px 6px 11px; border-radius: ${radio}; background: ${propia ? CH.propia : CH.ajena}; box-shadow: ${propia ? `0 1px 1px ${navyA(0.08)}` : `0 0 0 1px ${navyA(0.07)}, 0 1px 2px ${navyA(0.06)}`}; ${m.hover ? `outline: 2px solid ${navyA(0.14)}; outline-offset: 1px;` : ''}">
                    ${nombre}${m.resp ? citada(m.resp, propia) : ''}${adj}${texto}${metaPos}
                  </div>${m.hover ? barraAcciones(propia, !!m.txt && !m.adj, propia ? 'right' : 'left') : ''}
                </div>${reac}${visto}
              </div>`;
};

const separador = (txt, fondo) => `
            <div style="display: flex; justify-content: center; margin: 10px 0 4px;"><span style="height: 24px; padding: 0 11px; border-radius: 9999px; background: #ffffff; box-shadow: 0 0 0 1px ${navyA(0.08)}; ${t(11.5, 16, 600, T.muted, 'white-space: nowrap;')} display: inline-flex; align-items: center;">${txt}</span></div>`;

/** Hilo de mensajes: agrupa por autor (el primero lleva nombre y cara). */
const hilo = (msgs, { esGrupo, max, fondo = CH.fondo, conCaras = true }) => {
  let prev = null;
  return msgs.map((m) => {
    if (m.sep) { prev = null; return separador(m.sep, fondo); }
    if (m.html) { prev = null; return m.html; }
    const propia = m.de === P.yo;
    const primero = !prev || prev.de !== m.de;
    prev = m;
    const cara = !propia && conCaras && (esGrupo || m.de.r === 'ai')
      ? (primero ? avatar(m.de, 30, { fondoAnillo: fondo }) : `<div style="width: 30px; flex-shrink: 0;"></div>`) : '';
    return `
            <div style="display: flex; ${propia ? 'justify-content: flex-end;' : 'justify-content: flex-start;'} align-items: flex-start; gap: 8px; margin-top: ${primero ? 10 : 3}px;">${cara}${burbuja(m, { propia, primero, esGrupo, max, fondo })}
            </div>`;
  }).join('');
};

// ══ Cabecera de la conversación ═══════════════════════════════════════════════════════════════════
const cabeceraConv = (c, { movil = false, listaVisible = true } = {}) => {
  const esG = c.tipo === 'g';
  const enLinea = esG ? c.ps.filter((p) => p.on && p !== P.yo) : [];
  const izq = movil ? botonIcono('arrow-left', T.navy, 'Volver a la lista', 36, 'margin-left: -6px;')
    : botonIcono(listaVisible ? 'panel-left-close' : 'panel-left-open', T.muted, listaVisible ? 'Ocultar lista' : 'Mostrar lista', 34);
  const sub = esG
    ? `<span style="display: inline-flex; align-items: center; gap: 6px;">Grupo · ${c.ps.length} participantes</span><span style="color: ${navyA(0.3)};">·</span><span style="display: inline-flex; align-items: center; gap: 5px; color: ${TXT.ok}; font-weight: 500;">${punto(GRAF.linea, 7)}${enLinea.length} en línea</span>`
    : c.p.r === 'ai'
      ? `<span style="display: inline-flex; align-items: center; gap: 5px; color: ${TXT.ok}; font-weight: 500;">${punto(GRAF.linea, 7)}En línea</span><span style="color: ${navyA(0.3)};">·</span><span>Bot de prueba con la IA local</span>`
      : c.p.on ? `<span style="display: inline-flex; align-items: center; gap: 5px; color: ${TXT.ok}; font-weight: 500;">${punto(GRAF.linea, 7)}En línea</span><span style="color: ${navyA(0.3)};">·</span><span>Directo</span>` : `<span>Sin conexión · Directo</span>`;
  const derecha = esG && !movil
    ? `${botonSecundario('users', 'Detalles', 'Participantes, renombrar, añadir o quitar personas, eliminar el grupo')}
              ${botonIcono('ellipsis', T.navy, 'Más: renombrar, ver participantes, eliminar', 34)}`
    : botonIcono('ellipsis', T.navy, esG ? 'Más: renombrar, ver participantes, eliminar' : 'Más: eliminar chat', 34);
  return `
          <div style="height: ${movil ? 60 : 64}px; flex-shrink: 0; padding: 0 ${movil ? 12 : 16}px 0 ${movil ? 12 : 12}px; display: flex; align-items: center; gap: 10px; background: #ffffff; box-shadow: 0 1px 0 ${CH.filete}; position: relative; z-index: 3;">
            ${izq}
            ${esG ? avatarGrupo(38) : avatar(c.p, 38)}
            <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; margin-left: 2px;">
              <span style="${t(15, 20, 600, T.navy, 'letter-spacing: -.01em;' + truncar)}">${c.nombre}</span>
              <span style="display: flex; align-items: center; gap: 6px; ${t(12.5, 16, 400, T.muted, 'white-space: nowrap;' + num)}">${sub}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">${derecha}</div>
          </div>`;
};

// ══ Compositor ════════════════════════════════════════════════════════════════════════════════════
const franjaCompositor = ({ tipo, de, txt, iconoTxt }) => {
  const ed = tipo === 'editar';
  return `
            <div style="display: flex; align-items: center; gap: 10px; padding: 7px 6px 7px 12px; border-radius: 10px; background: ${ed ? FONDO.aviso : navyA(0.045)}; box-shadow: inset 0 0 0 1px ${ed ? FONDO.avisoBorde : navyA(0.1)};">
              <span style="display: flex; color: ${ed ? TXT.aviso : T.navy};">${icono(ed ? 'pencil' : 'reply', 16, 2)}</span>
              <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 1px;">
                <span style="${t(12, 16, 600, ed ? TXT.aviso : T.navy, 'white-space: nowrap;')}">${ed ? 'Editando tu mensaje' : `Respondiendo a ${de}`}</span>
                <span style="${t(12.5, 17, 400, T.muted, truncar)}">${iconoTxt ? `<span style="display: inline-flex; vertical-align: -2px; margin-right: 4px;">${icono(iconoTxt, 13, 1.9)}</span>` : ''}${txt}</span>
              </div>
              ${botonIcono('x', T.muted, ed ? 'Cancelar edición (Esc)' : 'Quitar la respuesta (Esc)', 28)}
            </div>`;
};
const compositor = ({ franja = null, texto = '', mencion = null, movil = false, subiendo = false, ayuda = true } = {}) => `
          <div style="flex-shrink: 0; padding: ${movil ? '8px 10px 10px' : '10px 20px 12px'}; background: #ffffff; box-shadow: 0 -1px 0 ${CH.filete}; display: flex; flex-direction: column; gap: 8px; position: relative; z-index: 3;">
            ${franja ? franjaCompositor(franja) : ''}
            <div style="position: relative; display: flex; align-items: flex-end; gap: 6px; padding: 4px 4px 4px 4px; border-radius: 12px; background: #ffffff; box-shadow: inset 0 0 0 1px ${texto || franja ? T.navy : navyA(0.22)}${texto || franja ? `, 0 0 0 3px ${navyA(0.1)}` : ''};">${mencion || ''}
              ${botonIcono('paperclip', T.muted, 'Adjuntar archivo (también puedes pegar una imagen con Ctrl+V)', 36)}
              <div style="min-width: 0; flex: 1; min-height: 36px; padding: 8px 4px; display: flex; align-items: center; ${texto ? t(14, 20, 400, INK) : t(14, 20, 400, T.muted)}">${texto ? `${texto}<span style="display: inline-block; width: 1.5px; height: 18px; margin-left: 1px; background: ${T.navy}; vertical-align: -4px;"></span>` : (movil ? 'Escribe un mensaje…' : 'Escribe un mensaje… (@ para mencionar)')}</div>
              <div title="${franja?.tipo === 'editar' ? 'Guardar cambios (Enter)' : 'Enviar (Enter)'}" style="width: 36px; height: 36px; flex-shrink: 0; border-radius: 9px; background: ${texto || subiendo ? T.btnPrimary : navyA(0.1)}; ${texto ? `box-shadow: 0 1px 2px ${navyA(0.3)}, inset 0 1px 0 rgba(255,255,255,.14);` : ''} color: ${texto || subiendo ? '#ffffff' : navyA(0.45)}; display: flex; align-items: center; justify-content: center;">${franja?.tipo === 'editar' ? icono('check', 17, 2.2) : subiendo ? icono('loader-circle', 17, 2) : icono('send', 16, 2)}</div>
            </div>${movil || !ayuda ? '' : `
            <div style="display: flex; align-items: center; gap: 14px; padding: 0 4px; ${t(11.5, 14, 400, T.muted, 'white-space: nowrap;')}">
              <span><b style="font-weight: 600;">Enter</b> envía</span><span><b style="font-weight: 600;">Shift + Enter</b> nueva línea</span><span><b style="font-weight: 600;">@</b> menciona</span><span><b style="font-weight: 600;">Ctrl + V</b> pega una imagen</span><span style="margin-left: auto;">Máx. 25 MB por archivo</span>
            </div>`}
          </div>`;

const escribiendoIA = `
            <div style="display: flex; align-items: flex-start; gap: 8px; margin-top: 10px;">
              ${avatar(P.ia, 30, { fondoAnillo: CH.fondo })}
              <div style="height: 36px; padding: 0 12px; border-radius: 4px 12px 12px 12px; background: #ffffff; box-shadow: 0 0 0 1px ${navyA(0.07)}, 0 1px 2px ${navyA(0.06)}; display: flex; align-items: center; gap: 8px;">
                <span style="${t(12.5, 16, 500, T.muted, 'white-space: nowrap;')}">Evaris IA está escribiendo</span>
                <span style="display: flex; gap: 3px;">${punto(navyA(0.7), 6)}${punto(navyA(0.45), 6)}${punto(navyA(0.25), 6)}</span>
              </div>
            </div>`;

/** Panel de conversación completo (cabecera + hilo anclado abajo + compositor). */
const conversacion = ({ ancho, chat, msgs, comp = {}, extraHilo = '', movil = false, max, avisoArriba = '' }) => `
        <div style="width: ${ancho}px; flex-shrink: 0; min-width: 0; display: flex; flex-direction: column; background: ${CH.fondo};">
          ${cabeceraConv(chat, { movil })}${avisoArriba}
          <div style="flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; padding: 0 ${movil ? 12 : 28}px 16px;">
            ${hilo(msgs, { esGrupo: chat.tipo === 'g', max })}${extraHilo}
          </div>
          ${compositor({ ...comp, movil })}
        </div>`;

// ══ Menú Marco PLEGADO (72 px, como marco-layout.tsx): la isla empieza en x = 72 ═════════════════
const TINTA_ICONO = 'rgba(255,255,255,.72)';
const insignia = (badge, n) => badge === 'chat'
  ? `<span style="position: absolute; top: -4px; left: 34px; height: 18px; min-width: 18px; padding: 0 5px; border-radius: 9999px; background: #dc2626; box-shadow: 0 0 0 2px #2f3f80; ${t(11, 12, 700, '#ffffff', num)} display: flex; align-items: center; justify-content: center;">${n}</span>`
  : `<span style="position: absolute; top: -4px; left: 34px; height: 18px; min-width: 18px; padding: 0 5px; border-radius: 9999px; background: #4a5890; box-shadow: 0 0 0 2px #2f3f80; ${t(11, 12, 700, '#f1f5f9', num)} display: flex; align-items: center; justify-content: center;">${n}</span>`;
const menuPlegado = (activo) => `
    <div style="position: relative; width: 72px; flex-shrink: 0; padding-top: 24px; padding-bottom: 10px; display: flex; flex-direction: column;">
      <div style="height: 120px; flex-shrink: 0;">
        <div title="Hospital Universitario del Valle" style="margin-left: 14px; width: 44px; height: 44px; border-radius: 12px; background: #ffffff; box-shadow: 0 1px 1px rgba(0,0,0,.18), 0 10px 22px -10px rgba(0,0,0,.55), inset 0 -1px 0 rgba(46,63,132,.08); display: flex; align-items: center; justify-content: center;">
          <img src="logo-huv.png" alt="Hospital Universitario del Valle" style="width: 40px; height: 32px; object-fit: contain; display: block;">
        </div>
      </div>
      <div style="margin-top: 28px; display: flex; flex-direction: column; gap: 20px;">${NAV.map((g) => `
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <div style="position: relative; height: 28px;"><span style="position: absolute; left: 28px; top: 14px; width: 16px; height: 1px; background: rgba(255,255,255,.15);"></span></div>${g.items.map((it) => {
    const act = it.id === activo;
    const n = it.badge ? NO_LEIDOS[it.badge] : 0;
    return `
          <div title="${it.t}" style="position: relative; margin-left: 12px; width: 48px; height: 40px; border-radius: 10px; display: flex; align-items: center;${act ? ' background: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,.2), 0 8px 18px -10px rgba(0,0,0,.45);' : ''}">
            <span style="padding-left: 15px; display: flex; color: ${act ? T.navy : TINTA_ICONO};">${icono(it.i, 18, act ? 2 : 1.75)}</span>${n > 0 ? insignia(it.badge, n) : ''}
          </div>`;
  }).join('')}
        </div>`).join('')}
      </div>
      <div title="Sofía Quintero Ramos · Administrador" style="margin-top: auto; margin-left: 12px; width: 48px; height: 54px; border-radius: 14px; display: flex; align-items: center;">
        <div style="margin-left: 7px; width: 34px; height: 34px; border-radius: 9999px; background: linear-gradient(to bottom right, ${T.navySoft}, ${T.navyLight}); box-shadow: 0 0 0 1px rgba(255,255,255,.2), 0 1px 2px rgba(0,0,0,.25); ${t(11.84, 14, 700, '#ffffff', 'letter-spacing: .02em;')} display: flex; align-items: center; justify-content: center;">SQ</div>
      </div>
    </div>`;
const MARCO_FONDO = `radial-gradient(560px 420px at 0px 0px, rgba(78,95,164,.35), rgba(78,95,164,0) 72%), linear-gradient(180deg, ${T.navy} 0%, ${T.navyDeep} 60%, ${T.navyDark} 100%)`;
const ISLA_PLEGADA = { ancho: 1440 - 72 - MARCO, alto: 900 - 2 * MARCO }; // 1358 x 880
const carcasaPlegada = ({ activo, contenido }) => `
<div style="position: relative; width: 1440px; height: 900px; overflow: hidden; background: ${T.bg}; font-family: ${T.font};">
  <div style="position: absolute; left: 0; top: 0; width: 1440px; height: 900px; display: flex; background: ${MARCO_FONDO};">
    <div style="position: absolute; inset: 0; background-image: ${GRANO_ATTR}; pointer-events: none;"></div>${menuPlegado(activo)}
    <div style="position: relative; flex: 1; min-width: 0; margin: ${MARCO}px ${MARCO}px ${MARCO}px 0; border-radius: ${RADIO_ISLA}px; background: ${T.bg}; overflow: hidden; box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 0 0 1px rgba(0,0,0,.14), 0 20px 44px -22px rgba(0,0,0,.6);">${contenido}
    </div>
  </div>
</div>`;

// ══ Datos de EJEMPLO: el grupo ════════════════════════════════════════════════════════════════════
// Forma de formatMessage: body, type, file_name, file_size_human, user, is_mine, created_at (g:i A),
// edited, reactions[{emoji,count,users,mine}], reply_to{user_name, body|type}. Vistos = receiptsFor.
const MSG_GRUPO = [
  { sep: 'Ayer' },
  { de: P.hernan, hora: '5:40 PM', txt: 'Desde el lunes la línea de citas abre a las 7:00 a. m. y no a las 7:30. Ajusten sus turnos, por favor.', reac: [[E.like, 4, true, 'Tú, Andrea, Diego y Luisa']] },
  { sep: 'Hoy' },
  { de: P.yo, hora: '7:58 AM', adj: { tipo: 'doc', nombre: 'turnos_semana_38.xlsx', ext: 'XLSX', tipoTxt: 'Hoja de cálculo', peso: '48 KB' }, txt: 'Buenos días. Les dejo el cuadro de turnos de la semana 38: Diego y Luisa quedan en la línea de 7 a 1.', reac: [[E.gracias, 2, false, 'Andrea y Luisa']], visto: [P.diego] },
  { de: P.juan, hora: '9:12 AM', adj: { tipo: 'img', nombre: 'captura_agenda.png', ancho: 300 }, txt: 'Me sale esto al abrir la agenda de ortopedia. ¿A alguien más le pasa?', reac: [[E.wow, 2, false, 'María Fernanda y Diego']] },
  { de: P.mafe, hora: '9:14 AM', resp: { de: 'Juan Pablo Restrepo Vélez', txt: 'Foto', icono: 'image' }, txt: 'A mí también. Parece que es solo ortopedia; las otras agendas cargan bien.' },
  { de: P.yo, hora: '9:20 AM', editado: true, txt: '@Juan Pablo Restrepo Vélez ya lo reporté a sistemas. Mientras tanto, a quien llame por ortopedia díganle que lo llamamos hoy en la tarde.', reac: [[E.like, 3, false, 'Andrea, Diego y Hernán'], [E.love, 1, false, 'Luisa']], visto: [P.andrea, P.juan, P.mafe, P.luisa, P.hernan] },
  { de: P.luisa, hora: '9:31 AM', txt: 'Entendido. ¿Les pido un número de contacto en el chat?', hover: true },
];

// ══ Datos de EJEMPLO: el chat con «IA - Prueba» ═══════════════════════════════════════════════════
// aiReply: al enviar en un chat directo con el usuario de rol «ai», la IA local (LM Studio) contesta
// como el bot de bienvenida. Mientras genera: «Evaris IA está escribiendo». AiChatTimeoutService: a los
// 5 min sin escribir manda «¿Sigues ahí?»; a los 10 borra la conversación (ajustes ai_nudge/ai_reset).
// Los textos de la IA salen del ejemplo del propio prompt; la cédula es inventada.
const MSG_IA = [
  { sep: 'Hoy' },
  { de: P.yo, hora: '10:02 AM', txt: 'Hola' },
  { de: P.ia, bot: true, hora: '10:02 AM', txt: `¡Hola! ${E.hola} Soy *Evarisbot*, el asistente virtual del Hospital Universitario del Valle. Para atenderte necesito tu autorización para el tratamiento de tus datos (Ley 1581 de 2012). ¿Aceptas? Responde *Acepto* o *No acepto*. ${E.sonrisa}` },
  { de: P.yo, hora: '10:03 AM', txt: 'Acepto' },
  { de: P.ia, bot: true, hora: '10:03 AM', txt: `¡Gracias! ${E.feliz} ¿Qué tipo de documento tiene el paciente? *Cédula*, *Tarjeta de Identidad* u *Otro*.` },
  { de: P.yo, hora: '10:03 AM', txt: 'Cédula' },
  { de: P.ia, bot: true, hora: '10:03 AM', txt: `Perfecto. Escríbeme el número de cédula, sin puntos ni comas, por favor. ${E.sonrisa}` },
  { de: P.yo, hora: '10:04 AM', txt: '1000000001' },
];
const CHAT_IA = { ...D(P.ia) };
// Franja fija bajo la cabecera (no se va con el scroll: la conversación se puede borrar sola).
const avisoIA = `
          <div style="flex-shrink: 0; padding: 9px 20px 10px 16px; background: ${FONDO.curso}; box-shadow: inset 0 -1px 0 ${FONDO.cursoBorde}; display: flex; align-items: flex-start; gap: 10px; position: relative; z-index: 2;">
            <span style="display: flex; margin-top: 1px; color: ${TXT.curso};">${icono('info', 16, 2)}</span>
            <span style="${t(12.5, 18, 400, '#075985')}"><b style="font-weight: 600;">Chat de prueba del bot de bienvenida.</b> IA - Prueba contesta sola, como el bot le contestaría a un paciente, con la IA local del hospital. A los 5 minutos sin escribir pregunta si sigues ahí; a los 10, la conversación se borra y empieza de cero.</span>
          </div>`;

// ══ Escritura ═════════════════════════════════════════════════════════════════════════════════════
const escribir = (nombre, html, medida) => {
  fs.writeFileSync(path.join(DIR, nombre), html);
  console.log(`  ${nombre.padEnd(18)} ${String(Buffer.byteLength(html)).padStart(7)} bytes  (${medida})`);
};

// ── Main: grupo, menú plegado ────────────────────────────────────────────────────────────────────
const LISTA_MAIN = 340;
escribir('Main.dc.html', documento(carcasaPlegada({ activo: 'internal', contenido: `
      <div style="position: absolute; inset: 0; display: flex;">
        ${panelLista({ ancho: LISTA_MAIN, chats: CHATS_MAIN, activo: 'agenda' })}
        ${conversacion({ ancho: ISLA_PLEGADA.ancho - LISTA_MAIN, chat: G_AGENDA, msgs: MSG_GRUPO, max: 560,
    comp: { texto: 'Sí, que confirmen el número y el horario en que se les puede llamar.' } })}
      </div>` })), '1440x900');

// ── Uno: chat con la IA, menú fijado ─────────────────────────────────────────────────────────────
const LISTA_UNO = 320;
escribir('Uno.dc.html', documento(carcasaMarco({ activo: 'internal', ancho: 1440, contenido: `
      <div style="position: absolute; inset: 0; display: flex;">
        ${panelLista({ ancho: LISTA_UNO, chats: CHATS_UNO, activo: P.ia.c })}
        ${conversacion({ ancho: ISLA.ancho - LISTA_UNO, chat: CHAT_IA, msgs: MSG_IA, max: 520, avisoArriba: avisoIA, extraHilo: escribiendoIA, comp: {} })}
      </div>` })), '1440x900');

// ══ Estados ═══════════════════════════════════════════════════════════════════════════════════════
const pie = (n, titulo, texto) => `
        <div style="display: flex; align-items: baseline; gap: 12px; padding: 0 4px;">
          <span style="${t(12, 16, 600, T.navy, num + 'white-space: nowrap;')}">${n}</span>
          <span style="${t(15, 20, 600, T.navy, 'white-space: nowrap;')}">${titulo}</span>
          <span style="${t(13, 18, 400, T.muted, truncar)}">${texto}</span>
        </div>`;
const velo = (html, extra = '') => `
        <div style="display: flex; align-items: flex-start; gap: 20px; padding: 20px; border-radius: 16px; background: ${navyA(0.28)}; ${extra}">${html}
        </div>`;
const mesa = (html, extra = '') => `
        <div style="display: flex; align-items: flex-start; gap: 20px; ${extra}">${html}
        </div>`;
const dialogo = ({ ancho, i, tono = 'navy', titulo, sub = '', cuerpo, botones, cerrar = false }) => {
  const ic = tono === 'mal' ? `background: ${FONDO.mal}; box-shadow: inset 0 0 0 1px ${FONDO.malBorde}; color: ${TXT.mal};` : `background: ${navyA(0.08)}; color: ${T.navy};`;
  return `
            <div style="width: ${ancho}px; flex-shrink: 0; border-radius: 16px; background: #ffffff; box-shadow: ${sombraDialogo}; overflow: hidden;">
              <div style="padding: 20px 22px 0; display: flex; align-items: center; gap: 13px;">
                <span style="width: 38px; height: 38px; flex-shrink: 0; border-radius: 10px; ${ic} display: flex; align-items: center; justify-content: center;">${icono(i, 18, 2)}</span>
                <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
                  <span style="${t(16, 22, 600, T.navy, 'letter-spacing: -.01em;')}">${titulo}</span>${sub ? `
                  <span style="${t(12.5, 16, 400, T.muted)}">${sub}</span>` : ''}
                </div>
                ${cerrar ? botonIcono('x', T.muted, 'Cerrar (Esc)', 30) : ''}
              </div>
              <div style="padding: 14px 22px 20px; display: flex; flex-direction: column; gap: 12px;">${cuerpo}
              </div>
              <div style="padding: 13px 22px; display: flex; align-items: center; justify-content: flex-end; gap: 8px; background: ${CH.banda}; box-shadow: inset 0 1px 0 ${CH.filete};">${botones}
              </div>
            </div>`;
};
const parrafo = (x) => `<p style="${t(13, 19, 400, T.muted)}">${x}</p>`;

// 1 · Nuevo chat o grupo (una persona = chat directo; varias = grupo con nombre)
const filaPersona = (p, on, { quitar = false, yo = false, creador = false, hover = false } = {}) => `
                  <div style="height: 50px; padding: 0 8px; display: flex; align-items: center; gap: 11px; border-radius: 9px;${on && !quitar ? ` background: ${navyA(0.05)};` : ''}${hover ? ` background: ${navyA(0.045)};` : ''}">
                    ${quitar ? '' : casilla(on)}
                    ${avatar(p, 32)}
                    <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 1px;">
                      <span style="${t(13, 18, on || quitar ? 600 : 500, T.navy, truncar)}">${p.n}${yo ? `<span style="font-weight: 400; color: ${T.muted};"> (tú)</span>` : ''}</span>
                      <span style="display: flex; align-items: center; gap: 6px; ${t(12, 16, 400, T.muted, 'white-space: nowrap;')}">${rolTxt(p.r)}${p.on ? `<span style="color: ${TXT.ok}; font-weight: 500;">· En línea</span>` : ''}${creador ? `<span style="height: 18px; padding: 0 6px; border-radius: 5px; background: ${navyA(0.07)}; ${t(11, 12, 600, T.navy)} display: inline-flex; align-items: center;">Creó el grupo</span>` : ''}</span>
                    </div>
                    ${quitar && hover ? botonIcono('user-minus', TXT.mal, 'Quitar del grupo (pregunta antes)', 30, `background: ${FONDO.mal};`) : ''}
                  </div>`;
const chipElegido = (p) => `<span style="height: 26px; padding: 0 4px 0 10px; border-radius: 9999px; background: ${CH.propia}; box-shadow: inset 0 0 0 1px ${navyA(0.16)}; display: inline-flex; align-items: center; gap: 4px; ${t(12.5, 16, 600, T.navy, 'white-space: nowrap;')}">${p.n.split(' ').slice(0, 2).join(' ')}<span title="Quitar" style="width: 20px; height: 20px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; color: ${T.muted};">${icono('x', 13, 2.2)}</span></span>`;
const dNuevo = dialogo({ ancho: 470, i: 'plus', titulo: 'Nuevo chat o grupo', sub: 'Con una persona es un chat directo; con varias, un grupo.', cerrar: true,
  cuerpo: `
                <div style="display: flex; flex-direction: column; gap: 7px;">${etiqueta('Nombre del grupo', '(si no pones uno: «Nuevo grupo»)')}${campo({ valor: 'Cirugía programada', foco: true })}</div>
                <div style="display: flex; flex-direction: column; gap: 7px;">
                  <div style="display: flex; align-items: baseline; justify-content: space-between;">${etiqueta('Personas')}<span style="${t(12, 16, 400, T.muted, num)}">3 elegidas</span></div>
                  ${buscador('Buscar por nombre…')}
                  <div style="display: flex; flex-wrap: wrap; gap: 6px; padding-top: 2px;">${[P.mafe, P.diego, P.jessica].map(chipElegido).join('')}</div>
                </div>
                <div style="display: flex; flex-direction: column; margin: 0 -8px;">
                  ${filaPersona(P.andrea, false)}${filaPersona(P.mafe, true)}${filaPersona(P.diego, true)}${filaPersona(P.hernan, false)}${filaPersona(P.ia, false)}${filaPersona(P.jessica, true)}
                </div>
                <div style="display: flex; align-items: center; gap: 8px; ${t(12.5, 18, 400, T.muted)}">${ico('users', T.navy, 14, 2)}<span>Se creará un <b style="font-weight: 600; color: ${T.navy};">grupo</b> con 3 personas y tú. Con una sola sería un chat directo (si ya existe, se abre ese).</span></div>`,
  botones: botonSecundario('', 'Cancelar') + botonPrimario('users', 'Crear grupo') });

// Menú de clic derecho en la lista (hoy existe) y renombrar
const menuFlotante = (items, ancho = 232) => `
            <div style="width: ${ancho}px; flex-shrink: 0; padding: 6px; border-radius: 12px; background: #ffffff; box-shadow: ${sombraFlota}; display: flex; flex-direction: column;">${items.map((it) => it === '-' ? `<div style="height: 1px; margin: 5px 4px; background: ${CH.filete};"></div>` : `
              <div style="height: 36px; padding: 0 10px; border-radius: 8px; display: flex; align-items: center; gap: 10px;${it.hover ? ` background: ${navyA(0.055)};` : ''} ${t(13, 18, 500, it.mal ? TXT.mal : T.navy, 'white-space: nowrap;')}">${icono(it.i, 16, 1.9)}${it.x}${it.k ? `<span style="margin-left: auto; ${t(11.5, 16, 400, T.muted)}">${it.k}</span>` : ''}</div>`).join('')}
            </div>`;
const menuLista = menuFlotante([{ i: 'pencil', x: 'Renombrar grupo', hover: true }, { i: 'users', x: 'Ver participantes (7)' }, '-', { i: 'trash-2', x: 'Eliminar grupo…', mal: true }]);
const dRenombrar = dialogo({ ancho: 380, i: 'pencil', titulo: 'Renombrar grupo', sub: 'Lo ven así todas las personas del grupo.', cerrar: true,
  cuerpo: `<div style="display: flex; flex-direction: column; gap: 7px;">${etiqueta('Nombre del grupo')}${campo({ valor: 'Agendamiento consulta externa · Cali', foco: true })}<span style="${t(12, 16, 400, T.muted, num)}">Hasta 100 caracteres · Enter guarda</span></div>`,
  botones: botonSecundario('', 'Cancelar') + botonPrimario('check', 'Guardar') });

// 2 · Detalles del grupo (panel a la derecha de la conversación; hoy es la ventana «Ver participantes»)
const panelDetalles = ({ alto = 760, vista = 'personas' } = {}) => {
  const cab = `
            <div style="height: 56px; flex-shrink: 0; padding: 0 10px 0 18px; display: flex; align-items: center; gap: 8px; box-shadow: 0 1px 0 ${CH.filete};">
              ${vista === 'anadir' ? botonIcono('arrow-left', T.navy, 'Volver a los participantes', 30, 'margin-left: -8px;') : ''}
              <span style="flex: 1; ${t(14.5, 20, 600, T.navy)}">${vista === 'anadir' ? 'Añadir personas' : 'Detalles del grupo'}</span>
              ${botonIcono('x', T.muted, 'Cerrar (Esc)', 30)}
            </div>`;
  if (vista === 'anadir') {
    const fuera = [P.vale, P.cristian, P.paola, P.ricardo, P.jessica, P.camila, P.santiago, P.ia];
    return `
          <div style="width: 360px; height: ${alto}px; flex-shrink: 0; border-radius: 14px; background: #ffffff; box-shadow: ${sombraDialogo}; overflow: hidden; display: flex; flex-direction: column;">${cab}
            <div style="padding: 14px 18px 8px; display: flex; flex-direction: column; gap: 8px;">
              ${buscador('Buscar usuario…')}
              <span style="${t(12, 16, 400, T.muted)}">Solo aparece quien aún no está en el grupo.</span>
            </div>
            <div style="flex: 1; min-height: 0; overflow: hidden; padding: 0 10px; display: flex; flex-direction: column;">${fuera.map((p, k) => filaPersona(p, k === 0 || k === 4)).join('')}</div>
            <div style="padding: 12px 18px; display: flex; justify-content: space-between; gap: 8px; background: ${CH.banda}; box-shadow: inset 0 1px 0 ${CH.filete};">${botonSecundario('', 'Volver')}${botonPrimario('user-plus', 'Añadir 2 personas')}</div>
          </div>`;
  }
  const ps = G_AGENDA.ps;
  return `
          <div style="width: 360px; height: ${alto}px; flex-shrink: 0; border-radius: 14px; background: #ffffff; box-shadow: ${sombraDialogo}; overflow: hidden; display: flex; flex-direction: column;">${cab}
            <div style="padding: 18px 18px 16px; display: flex; flex-direction: column; align-items: center; gap: 10px; box-shadow: 0 1px 0 ${CH.filete};">
              ${avatarGrupo(56)}
              <div style="display: flex; align-items: center; gap: 6px;"><span style="${t(16, 22, 600, T.navy, 'text-align: center;')}">Agendamiento consulta externa</span>${botonIcono('pencil', T.navy, 'Renombrar grupo', 28)}</div>
              <span style="${t(12.5, 16, 400, T.muted, num)}">Grupo · 7 participantes · <span style="color: ${TXT.ok}; font-weight: 500;">6 en línea</span></span>
            </div>
            <div style="padding: 12px 18px 6px; display: flex; align-items: center; justify-content: space-between;">${rotulo('Participantes · 7')}${botonSecundario('user-plus', 'Añadir', 'Añadir personas al grupo', 30)}</div>
            <div style="flex: 1; min-height: 0; overflow: hidden; padding: 0 10px; display: flex; flex-direction: column;">
              ${filaPersona(ps[0], false, { quitar: true, yo: true, creador: true })}
              ${ps.slice(1).map((p) => filaPersona(p, false, { quitar: true, hover: p === P.diego })).join('')}
            </div>
            <div style="padding: 12px 18px 14px; display: flex; flex-direction: column; gap: 8px; box-shadow: inset 0 1px 0 ${CH.filete};">
              ${botonPeligro('trash-2', 'Eliminar grupo…', 'Pregunta antes', 36)}
              <span style="${t(12, 16, 400, T.muted)}">Tú lo creaste: se borra para todos, con sus mensajes. Quien no lo creó ve «Salir del grupo».</span>
            </div>
          </div>`;
};
const toast = (tono, txt) => `
            <div style="width: 330px; padding: 11px 14px; border-radius: 11px; background: #ffffff; box-shadow: ${sombraFlota}; display: flex; align-items: center; gap: 10px; ${t(13, 18, 500, INK)}"><span style="display: flex; color: ${tono === 'ok' ? TXT.ok : TXT.mal};">${icono(tono === 'ok' ? 'circle-check' : 'circle-x', 17, 2)}</span>${txt}</div>`;
const columnaAvisos = `
          <div style="width: 360px; flex-shrink: 0; display: flex; flex-direction: column; gap: 12px;">
            <div style="padding: 14px 16px; border-radius: 14px; background: #ffffff; box-shadow: ${sombraDialogo}; display: flex; flex-direction: column; gap: 10px;">
              ${rotulo('Si no creaste el grupo')}
              ${botonPeligro('log-out', 'Salir del grupo…', 'Pregunta antes', 36)}
              <span style="${t(12, 16, 400, T.muted)}">Sales tú; el grupo y sus mensajes siguen para los demás.</span>
            </div>
            ${rotulo('Avisos que ya da la app')}
            ${toast('ok', 'Se agregaron: Valentina Ospina Toro, Jessica Tatiana Bolaños Arias')}
            ${toast('ok', 'Diego Alejandro Sánchez Rojas fue eliminado del grupo')}
            ${toast('mal', 'No se puede eliminar al creador del grupo')}
            ${toast('mal', 'La IA local no respondió. ¿LM Studio está corriendo?')}
          </div>`;

// 3 · Acciones sobre un mensaje
const selectorReacciones = `
                  <div style="position: absolute; left: 0; bottom: calc(100% + 8px); height: 46px; padding: 0 6px; border-radius: 9999px; background: #ffffff; box-shadow: ${sombraFlota}; display: flex; align-items: center; gap: 2px; z-index: 6;">${REACCIONES.map(([em, x], k) => `<span title="${x}" style="position: relative; width: 38px; height: 38px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-size: 24px; line-height: 1;${k === 0 ? ` background: ${navyA(0.07)};` : ''}">${em}${k === 0 ? `<span style="position: absolute; top: -26px; left: 50%; transform: translateX(-50%); height: 20px; padding: 0 7px; border-radius: 6px; background: ${INK}; ${t(11, 14, 600, '#ffffff', 'white-space: nowrap;')} display: flex; align-items: center;">${x}</span>` : ''}</span>`).join('')}</div>`;
const trozoAcciones = (() => {
  const ajena = { de: P.luisa, hora: '9:31 AM', txt: 'Entendido. ¿Les pido un número de contacto en el chat?', hover: true };
  const propia = { de: P.yo, hora: '9:33 AM', txt: 'Sí, y el horario en que se les puede llamar.', hover: true, reac: [[E.like, 1, false, 'Luisa']] };
  let h1 = hilo([ajena], { esGrupo: true, max: 420 });
  h1 = h1.replace('<div id="msg"', `${selectorReacciones}<div id="msg"`);
  const h2 = hilo([propia], { esGrupo: true, max: 420 });
  return `
          <div style="width: 760px; flex-shrink: 0; border-radius: 14px; overflow: hidden; background: ${CH.fondo}; box-shadow: ${sombraDialogo}; display: flex; flex-direction: column;">
            <div style="padding: 70px 28px 20px; display: flex; flex-direction: column; gap: 22px;">${h1}${h2}
            </div>
            ${compositor({ franja: { tipo: 'editar', txt: 'Sí, y el horario en que se les puede llamar.' }, texto: 'Sí, y el horario en que se les puede llamar (mañana o tarde).' })}
          </div>`;
})();
const trozoMencion = (() => {
  const lista = [P.juan, P.mafe, P.andrea].map((p, k) => `
                <div style="height: 42px; padding: 0 10px; border-radius: 8px; display: flex; align-items: center; gap: 10px;${k === 0 ? ` background: ${CH.propia};` : ''}">
                  ${avatar(p, 26, { fondoAnillo: k === 0 ? CH.propia : '#ffffff' })}
                  <span style="min-width: 0; flex: 1; ${t(13, 18, k === 0 ? 600 : 500, T.navy, truncar)}">${p.n}</span>
                  <span style="${t(12, 16, 400, T.muted)}">${rolTxt(p.r)}</span>
                </div>`).join('');
  const drop = `
              <div style="position: absolute; left: 44px; right: 44px; bottom: calc(100% + 72px); padding: 6px; border-radius: 12px; background: #ffffff; box-shadow: ${sombraFlota}; display: flex; flex-direction: column; z-index: 6;">
                <div style="padding: 4px 10px 6px; display: flex; justify-content: space-between; ${t(11.5, 16, 500, T.muted)}"><span>Personas del grupo</span><span>↑ ↓ · Enter o Tab elige · Esc cierra</span></div>${lista}
              </div>`;
  return `
          <div style="width: 520px; flex-shrink: 0; border-radius: 14px; overflow: hidden; background: ${CH.fondo}; box-shadow: ${sombraDialogo}; display: flex; flex-direction: column; justify-content: flex-end; min-height: 400px;">
            ${compositor({ texto: '¿Alguien puede ayudarme con esto? @', mencion: drop, ayuda: false, franja: { tipo: 'responder', de: 'Juan Pablo Restrepo Vélez', txt: 'Foto', iconoTxt: 'image' } }).replace('¿Alguien puede ayudarme con esto? @', `¿Alguien puede ayudarme con esto?&nbsp;<span style="font-weight: 600; color: ${T.navy};">@</span>`)}
          </div>`;
})();
const menuMensaje = menuFlotante([{ i: 'smile-plus', x: 'Reaccionar' }, { i: 'reply', x: 'Responder', hover: true }, { i: 'pencil', x: 'Editar', k: 'solo tus textos' }, '-', { i: 'expand', x: 'Ver en grande', k: 'imágenes y video' }, { i: 'download', x: 'Descargar', k: 'adjuntos' }], 250);

// 4 · Confirmaciones (hoy: la ventanita del navegador)
const dElimGrupo = dialogo({ ancho: 305, i: 'trash-2', tono: 'mal', titulo: '¿Eliminar el grupo?',
  cuerpo: parrafo('<b style="font-weight: 600; color: #1c2238;">Agendamiento consulta externa</b> se borra para las 7 personas, con todos sus mensajes y archivos. No se puede deshacer.'),
  botones: botonSecundario('', 'Cancelar') + botonPeligroLleno('trash-2', 'Eliminar grupo') });
const dSalir = dialogo({ ancho: 305, i: 'log-out', tono: 'mal', titulo: '¿Salir del grupo?',
  cuerpo: parrafo('Dejarás de ver <b style="font-weight: 600; color: #1c2238;">Turnos fin de semana</b>. El grupo sigue para los demás; para volver, alguien del grupo te tiene que añadir.'),
  botones: botonSecundario('', 'Cancelar') + botonPeligroLleno('log-out', 'Salir') });
const dElimChat = dialogo({ ancho: 305, i: 'trash-2', tono: 'mal', titulo: '¿Eliminar este chat?',
  cuerpo: parrafo('Se borra para ti y para <b style="font-weight: 600; color: #1c2238;">Andrea Carolina Muñoz Paz</b>, con todos los mensajes. No se puede deshacer.'),
  botones: botonSecundario('', 'Cancelar') + botonPeligroLleno('trash-2', 'Eliminar chat') });
const dQuitar = dialogo({ ancho: 305, i: 'user-minus', tono: 'mal', titulo: '¿Quitar a Diego del grupo?',
  cuerpo: parrafo('<b style="font-weight: 600; color: #1c2238;">Diego Alejandro Sánchez Rojas</b> deja de ver el grupo. Sus mensajes anteriores se quedan. Se le puede volver a añadir.'),
  botones: botonSecundario('', 'Cancelar') + botonPeligroLleno('user-minus', 'Quitar') });

// 5 · Vacíos
const vacio = ({ ancho = 320, alto = 250, i, titulo, texto, boton = '' }) => `
          <div style="width: ${ancho}px; height: ${alto}px; flex-shrink: 0; border-radius: 14px; background: ${i === 'messages-square' || i === 'message-square' ? CH.fondo : '#ffffff'}; box-shadow: 0 0 0 1px ${navyA(0.08)}, 0 1px 2px ${navyA(0.05)}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 24px; text-align: center;">
            <span style="width: 48px; height: 48px; border-radius: 14px; background: ${navyA(0.07)}; color: ${T.navy}; display: flex; align-items: center; justify-content: center;">${icono(i, 22, 1.75)}</span>
            <span style="${t(14.5, 20, 600, T.navy)}">${titulo}</span>
            <span style="${t(12.5, 18, 400, T.muted)}">${texto}</span>${boton ? `<div style="margin-top: 4px;">${boton}</div>` : ''}
          </div>`;
const vacios = mesa([
  vacio({ i: 'messages-square', titulo: 'Elige una conversación', texto: 'O crea un chat o un grupo con «Nuevo». Lo que llegue mientras tanto se marca en la lista.', boton: botonSecundario('plus', 'Nuevo chat o grupo') }),
  vacio({ i: 'inbox', titulo: 'Todavía no tienes conversaciones', texto: 'Crea un chat con un compañero o un grupo de trabajo.', boton: botonPrimario('plus', 'Nuevo chat o grupo') }),
  vacio({ i: 'search-x', titulo: 'Nada con «ortopedia» en No leídos', texto: 'Prueba con otra palabra o vuelve a «Todos».', boton: botonSecundario('x', 'Quitar filtros') }),
  vacio({ i: 'message-square', titulo: 'Aún no hay mensajes', texto: 'Escribe el primero abajo. Puedes adjuntar archivos o pegar una imagen.' }),
].join(''));

// 6 · Móvil (390): lista y conversación directa
const MSG_ANDREA = [
  { sep: 'Hoy' },
  { de: P.andrea, hora: '9:29 AM', txt: '¿Me ayudas con una cita que no aparece en la agenda? Dice que se la dieron por teléfono.' },
  { de: P.yo, hora: '9:33 AM', txt: 'Claro. ¿De qué especialidad y para qué día?' },
  { de: P.andrea, hora: '9:34 AM', txt: 'Dermatología, el jueves en la tarde.', reac: [[E.like, 1, true, 'Tú']] },
  { de: P.yo, hora: '9:36 AM', txt: 'Ya la vi: quedó en la agenda de Cartago, no en la de Cali. Te la paso a la correcta.', visto: [P.andrea] },
];
const telefono = (html) => `
          <div style="width: 390px; height: 844px; flex-shrink: 0; border-radius: 28px; overflow: hidden; background: #ffffff; box-shadow: 0 0 0 8px #1c2238, 0 30px 60px -20px ${navyA(0.6)}; display: flex; flex-direction: column;">
            <div style="height: 34px; flex-shrink: 0; padding: 0 22px; display: flex; align-items: center; justify-content: space-between; background: #ffffff; ${t(12, 14, 600, INK, num)}"><span>9:41</span><span style="width: 90px; height: 22px; border-radius: 9999px; background: #1c2238;"></span><span style="display: flex; gap: 4px;">${punto(INK, 5)}${punto(INK, 5)}${punto(INK, 5)}</span></div>
            <div style="flex: 1; min-height: 0; display: flex; flex-direction: column;">${html}</div>
          </div>`;
const movilLista = telefono(panelLista({ ancho: 390, chats: CHATS_MAIN, activo: '', movil: true }).replace('flex-shrink: 0; display: flex; flex-direction: column;', 'flex: 1; min-height: 0; display: flex; flex-direction: column;'));
const movilChat = telefono(conversacion({ ancho: 390, chat: { ...D(P.andrea) }, msgs: MSG_ANDREA, max: 300, movil: true, comp: {} }).replace('flex-shrink: 0; min-width: 0;', 'flex: 1; min-height: 0; min-width: 0;'));
const notaMovil = `
          <div style="width: 420px; flex-shrink: 0; padding-top: 8px; display: flex; flex-direction: column; gap: 14px;">
            ${[['1', 'Una pantalla a la vez', 'En el celular se ve la lista o la conversación, como hoy. La flecha vuelve a la lista.'],
    ['2', 'Menú arriba a la izquierda', 'El menú del hospital se abre como cajón, igual que en las demás pantallas.'],
    ['3', 'Mismas acciones', 'Mantener pulsado un mensaje abre el mismo menú: reaccionar, responder, editar. El compositor no cambia; solo se oculta la ayuda de teclas.'],
    ['4', 'Detalles y diálogos', 'Detalles del grupo, nuevo chat y confirmaciones ocupan toda la pantalla.']].map(([n, a, b]) => `
            <div style="display: flex; gap: 12px;"><span style="width: 24px; height: 24px; flex-shrink: 0; border-radius: 9999px; background: ${navyA(0.08)}; ${t(12, 16, 600, T.navy)} display: flex; align-items: center; justify-content: center;">${n}</span><div style="display: flex; flex-direction: column; gap: 2px;"><span style="${t(14, 20, 600, T.navy)}">${a}</span><span style="${t(13, 19, 400, T.muted)}">${b}</span></div></div>`).join('')}
          </div>`;

const ALTO_ESTADOS = 4110;
escribir('Estados.dc.html', documento(`
<div data-artboard="Estados" style="position: relative; width: 1440px; height: ${ALTO_ESTADOS}px; overflow: hidden; background: ${T.bg}; font-family: ${T.font};">
  <div style="padding: 40px; display: flex; flex-direction: column; gap: 18px;">
    ${pie('1', 'Nuevo chat o grupo, clic derecho y renombrar', 'Un solo diálogo: con una persona es chat directo, con varias es grupo. El clic derecho de la lista se queda.')}
    ${velo(dNuevo + `<div style="display: flex; flex-direction: column; gap: 20px;">${menuLista}${dRenombrar}</div>`)}
    <div style="height: 22px;"></div>
    ${pie('2', 'Detalles del grupo', 'Pasa de ventana a panel a la derecha del chat: personas, en línea, renombrar, añadir, quitar y eliminar o salir.')}
    ${velo(panelDetalles({ alto: 760 }) + panelDetalles({ alto: 760, vista: 'anadir' }) + columnaAvisos)}
    <div style="height: 22px;"></div>
    ${pie('3', 'Sobre un mensaje', 'Al pasar el ratón: reaccionar, responder y editar (solo lo tuyo). El mismo menú sale con clic derecho y, en el celular, al mantener pulsado.')}
    ${mesa(trozoAcciones + `<div style="display: flex; flex-direction: column; gap: 20px;">${menuMensaje}${trozoMencion}</div>`)}
    <div style="height: 22px;"></div>
    ${pie('4', 'Confirmaciones', 'Todas dicen qué se borra y para quién. Hoy son la ventanita del navegador.')}
    ${velo(dElimGrupo + dSalir + dElimChat + dQuitar)}
    <div style="height: 22px;"></div>
    ${pie('5', 'Vacíos', 'Sin chat elegido, sin conversaciones, búsqueda sin resultados y chat sin mensajes.')}
    ${vacios}
    <div style="height: 22px;"></div>
    ${pie('6', 'En el celular (390 de ancho)', 'La lista y la conversación, cada una a pantalla completa.')}
    ${mesa(movilLista + movilChat + notaMovil, 'padding: 8px 8px 20px;')}
  </div>
</div>`), `1440 x ${ALTO_ESTADOS}`);
