// "Quién está": la presencia primero y las personas como tarjetas (1440x900, administrador, riel colapsado).
// Solo cambia la página; el riel es el actual. Datos de MUESTRA de _comun.mjs, cifras de METRICAS.
import { T, icono, USUARIOS, METRICAS, rolTexto, rielActual, documento, escribir } from './_comun.mjs';
import { tarjeta, rolPill, interruptor, avatar, botonPrimario, botonIcono, busqueda, segmentado, lienzo, truncar } from './_piezas.mjs';

// ── Utilidades ────────────────────────────────────────────────────────────────
/** Primer nombre + primer apellido (nombres de 4 palabras: 1.ª y 3.ª; de 3: 1.ª y 2.ª). */
const corto = (n) => {
  const p = n.split(' ').filter(Boolean);
  return p.length >= 4 ? `${p[0]} ${p[2]}` : p.slice(0, 2).join(' ');
};

/** Anillo esmeralda de "en línea" alrededor de un avatar (no ocupa espacio de layout). */
const anillo = (html) =>
  `<div style="flex-shrink: 0; border-radius: 9999px; box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px ${T.emerald500};">${html}</div>`;

const punto = (color) =>
  `<span style="width: 8px; height: 8px; flex-shrink: 0; border-radius: 9999px; background: ${color};"></span>`;

// ── Cabecera (la real, con gap en vez de márgenes) ────────────────────────────
const cabecera = () => `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <div style="padding-top: 4px; flex-shrink: 0;">
            <div style="width: 48px; height: 48px; border-radius: 16px; background: rgba(255,255,255,.7); color: ${T.navy}; box-shadow: 0 1px 3px 0 rgb(46 63 132 / .05), 0 1px 2px -1px rgb(46 63 132 / .05); display: flex; align-items: center; justify-content: center;">${icono('users', 20)}</div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <h1 style="font-size: ${T.x3}; line-height: 1.5; font-weight: 700; color: ${T.navy};">Gestión de usuarios</h1>
            <p style="font-size: ${T.sm}; line-height: 1.5; color: ${T.muted};">Administra los usuarios del sistema</p>
          </div>
        </div>
        ${botonPrimario('Nuevo usuario')}
      </div>`;

// ── Barra de herramientas en una fila: búsqueda + rol + recuento ─────────────
const barra = () => tarjeta(`
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="flex: 1; min-width: 0;">${busqueda()}</div>
          ${segmentado(['Todos', 'Administradores', 'Asesores'], 0)}
          <div style="width: 1px; height: 24px; flex-shrink: 0; background: ${T.border};"></div>
          <p style="padding: 0 4px; font-size: ${T.xs}; line-height: ${T.lhXs}; font-weight: 600; color: ${T.muted}; white-space: nowrap;">${METRICAS.total} de ${METRICAS.total} usuarios</p>
        </div>`, 'padding: 12px;');

// ── Encabezado de sección: marca + título · cifra · detalle, con filete ─────
const sep = `<span style="font-size: ${T.base}; line-height: 1.5; color: ${T.muted};">·</span>`;
const seccion = (marca, titulo, cifra, detalle, extra = '') => `
          <div style="display: flex; align-items: center; gap: 8px; min-width: 0; padding-bottom: 8px; border-bottom: 1px solid ${T.border}; ${extra}">
            ${marca}
            <h2 style="font-size: ${T.base}; line-height: 1.5; font-weight: 700; color: ${T.navy}; white-space: nowrap;">${titulo}</h2>
            ${sep}
            <span style="font-size: ${T.base}; line-height: 1.5; font-weight: 700; color: ${T.navy}; font-variant-numeric: tabular-nums;">${cifra}</span>
            ${sep}
            <span style="min-width: 0; font-size: ${T.sm}; line-height: 1.5; color: ${T.muted}; ${truncar}">${detalle}</span>
          </div>`;

const marcaEnLinea = `<span style="width: 16px; height: 16px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;"><span style="width: 8px; height: 8px; border-radius: 9999px; background: ${T.emerald500}; box-shadow: 0 0 0 3px ${T.emerald200};"></span></span>`;
const marcaAdmin = `<span style="display: flex; color: ${T.navy};">${icono('shield-check', 16)}</span>`;
const marcaAsesor = `<span style="display: flex; color: ${T.sky700};">${icono('headphones', 16)}</span>`;

// ── Ficha compacta de "En línea ahora" (cápsula: el avatar queda concéntrico al extremo) ──
const ficha = (u) => `
            <div style="height: 52px; min-width: 0; border-radius: 9999px; padding: 0 12px 0 10px; background: ${T.card}; box-shadow: ${T.cardShadow}; display: flex; align-items: center; gap: 10px;">
              ${anillo(avatar(u, 32))}
              <div style="min-width: 0; display: flex; flex-direction: column;">
                <p style="font-size: ${T.sm}; line-height: ${T.lhSm}; font-weight: 700; color: ${T.navy}; ${truncar}">${corto(u.n)}</p>
                <p style="font-size: ${T.xs}; line-height: ${T.lhXs}; font-weight: 600; color: ${u.r === 'admin' ? T.navy : T.sky700}; ${truncar}">${rolTexto(u.r)}</p>
              </div>
            </div>`;

// ── Tarjeta de persona ────────────────────────────────────────────────────────
const presencia = (u) => u.on
  ? `<div style="display: flex; align-items: center; gap: 6px; font-size: ${T.xs}; line-height: ${T.lhXs}; font-weight: 600; color: ${T.emerald700};">${punto(T.emerald500)}<span>En línea</span></div>`
  : `<div style="display: flex; align-items: center; gap: 6px; min-width: 0; font-size: ${T.xs}; line-height: ${T.lhXs}; color: ${T.muted};">${punto(T.slate400)}<span style="font-weight: 600; color: ${T.slate600}; white-space: nowrap;">Desconectado</span><span>·</span><span style="min-width: 0; ${truncar}">${u.act}</span></div>`;

const botonMenuAbierto = `<div title="Acciones" style="width: 32px; height: 32px; flex-shrink: 0; border-radius: 12px; background: rgba(46,63,132,.1); box-shadow: inset 0 0 0 1px rgba(46,63,132,.2); color: ${T.navy}; display: flex; align-items: center; justify-content: center;">${icono('ellipsis', 16)}</div>`;

const itemMenu = (ico, texto, color, colorIcono) =>
  `<div style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; font-size: ${T.sm}; line-height: ${T.lhSm}; font-weight: 500; color: ${color};"><span style="display: flex; color: ${colorIcono};">${icono(ico, 16)}</span><span>${texto}</span></div>`;

const menuAbierto = `
                  <div style="position: absolute; top: calc(100% + 4px); right: 0; z-index: 20; width: 160px; padding: 4px; border-radius: 12px; border: 1px solid ${T.border}; background: ${T.card}; box-shadow: 0 2px 4px rgba(46,63,132,.08), 0 4px 8px rgba(46,63,132,.12), 0 8px 20px rgba(46,63,132,.16); display: flex; flex-direction: column; gap: 4px;">
                    ${itemMenu('edit-3', 'Editar', T.navy, T.muted)}
                    <div style="height: 1px; background: ${T.border};"></div>
                    ${itemMenu('trash-2', 'Eliminar', T.red600, T.red600)}
                  </div>`;

const persona = (u, { menu = false } = {}) => tarjeta(`
              <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; gap: 12px;">
                <div style="display: flex; align-items: flex-start; gap: 12px;">
                  ${u.on ? anillo(avatar(u, 40)) : avatar(u, 40)}
                  <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                      <p style="font-size: ${T.sm}; line-height: ${T.lhSm}; font-weight: 700; color: ${T.navy}; overflow-wrap: anywhere;">${u.n}</p>
                      <p style="font-size: ${T.xs}; line-height: ${T.lhXs}; color: ${T.muted}; ${truncar}">${u.e}</p>
                    </div>
                    ${presencia(u)}
                  </div>
                </div>
                <div style="min-height: 27px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                  ${rolPill(u.r)}
                  ${u.r === 'advisor' ? `<div style="display: flex; align-items: center; gap: 8px;"><span style="display: flex; align-items: center; gap: 6px; font-size: ${T.xs}; line-height: ${T.lhXs}; font-weight: 600; color: ${T.muted}; white-space: nowrap;">${icono('send', 14)}Envío masivo</span>${interruptor(u.bulk)}</div>` : ''}
                </div>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 12px; border-top: 1px solid rgba(212,216,232,.6);">
                <div style="min-width: 0; display: flex; align-items: center; gap: 8px; font-size: ${T.xs}; line-height: ${T.lhXs}; color: ${T.muted};">${icono('calendar', 16)}<span style="${truncar}">Registro ${u.reg}</span></div>
                <div style="position: relative; display: flex; align-items: center; gap: 8px;">
                  ${botonIcono('edit-3', 'Editar')}${menu ? botonMenuAbierto + menuAbierto : botonIcono('ellipsis', 'Acciones')}
                </div>
              </div>`, 'min-width: 0; padding: 16px; display: flex; flex-direction: column; gap: 12px;');

// ── Composición ───────────────────────────────────────────────────────────────
const enLinea = USUARIOS.filter((u) => u.on);                 // 7 = METRICAS.online
const admins = USUARIOS.filter((u) => u.r === 'admin');        // muestra: 3 de 5
const asesores = USUARIOS.filter((u) => u.r === 'advisor');    // muestra: 11 de 27
if (enLinea.length !== METRICAS.online) throw new Error('la muestra no tiene ' + METRICAS.online + ' en línea');

// Una sola rejilla de 4 columnas: columna 1 = administradores, columnas 2-4 = asesores.
// Así ambos grupos se ven a la vez y los que no caben se cortan abajo de forma natural.
const FILAS = 3;
const MENU_EN = 'valeospina.t@gmail.com'; // tarjeta que muestra el menú de acciones abierto
const celdas = [];
for (let f = 0; f < FILAS; f++) {
  const fila = [admins[f], ...asesores.slice(f * 3, f * 3 + 3)];
  for (const u of fila) if (u) celdas.push(persona(u, { menu: u.e === MENU_EN }));
}

const pagina = `
  <div style="position: absolute; left: 80px; top: 0; right: 0; bottom: 0; padding: 32px;">
    <div style="max-width: 1280px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px;">

      <div style="display: flex; flex-direction: column; gap: 20px;">
        ${cabecera()}
        ${barra()}
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${seccion(marcaEnLinea, 'En línea ahora', METRICAS.online, 'actividad reciente')}
        <div style="display: grid; grid-template-columns: repeat(${METRICAS.online}, minmax(0, 1fr)); gap: 8px;">${enLinea.map(ficha).join('')}
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px;">
          ${seccion(marcaAdmin, 'Administradores', METRICAS.admins, 'acceso completo')}
          ${seccion(marcaAsesor, 'Asesores', METRICAS.advisors, `${METRICAS.bulk} con envío masivo`, 'grid-column: span 3;')}
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px;">${celdas.join('')}
        </div>
      </div>

    </div>
  </div>`;

escribir('QuienEsta.dc.html', documento(lienzo(rielActual('users') + pagina)));
