// "Lista y ficha": maestro-detalle. Lista agrupada por conexión a la izquierda, ficha de la persona
// seleccionada a la derecha. Solo cambia la página; el riel es rielActual('users') sin tocar.
// Motivo: gestionar a una persona cada vez y alejar el borrado del resto de acciones.
// Coste: comparar a muchas personas a la vez obliga a ir fila a fila.
import { T, icono, USUARIOS, METRICAS, iniciales, rolTexto, rielActual, documento, escribir, GRANO } from './_comun.mjs';
import { tarjeta, truncar, rolPill, conexionPill, interruptor, avatar, botonPrimario, busqueda, segmentado, lienzo } from './_piezas.mjs';

const SELECCION = 'VALENTINA OSPINA TORO';
const sel = USUARIOS.find((u) => u.n === SELECCION);
const enLinea = USUARIOS.filter((u) => u.on);
const desconectados = USUARIOS.filter((u) => !u.on);
const DESCONECTADOS = METRICAS.total - METRICAS.online; // 26

const DIVISOR = 'rgba(212,216,232,.6)';
const DIVISOR_FUERTE = 'rgba(212,216,232,.8)';

// ── Cabecera de página ───────────────────────────────────────────────────────
// Sin el tile de icono: el riel ya marca "Usuarios" con el mismo icono, y así el título
// comparte el borde izquierdo (x = 120) con la lista de abajo.
const separador = `<span style="width: 1px; height: 14px; flex-shrink: 0; background: ${T.border};"></span>`;
const cifra = (n, texto, antes = '') =>
  `<span style="display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;">${antes}<span style="display: inline-flex; align-items: baseline; gap: 4px;"><span style="font-weight: 700; color: ${T.navy}; font-variant-numeric: tabular-nums;">${n}</span><span>${texto}</span></span></span>`;
const puntoVerde = `<span style="width: 8px; height: 8px; flex-shrink: 0; border-radius: 9999px; background: ${T.emerald500};"></span>`;

const resumen = `
        <div style="display: flex; align-items: center; gap: 12px; font-size: ${T.sm}; line-height: ${T.lhSm}; color: ${T.muted};">
          ${cifra(METRICAS.total, 'usuarios')}${separador}
          ${cifra(METRICAS.online, 'en línea', puntoVerde)}${separador}
          ${cifra(METRICAS.admins, 'administradores')}${separador}
          ${cifra(METRICAS.advisors, 'asesores')}${separador}
          ${cifra(METRICAS.bulk, 'con envío masivo', `<span style="display: flex; color: ${T.navy};">${icono('send', 14)}</span>`)}
        </div>`;

const cabeceraPagina = `
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;">
        <div style="display: flex; flex-direction: column; gap: 12px; min-width: 0;">
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <h1 style="font-size: ${T.x3}; line-height: 1.5; font-weight: 700; color: ${T.navy};">Gestión de usuarios</h1>
            <p style="font-size: ${T.sm}; line-height: 1.5; color: ${T.muted};">Administra los usuarios del sistema</p>
          </div>${resumen}
        </div>
        ${botonPrimario('Nuevo usuario')}
      </div>`;

// ── Lista (panel izquierdo) ──────────────────────────────────────────────────
const avatarPresencia = (u) => `
            <div style="position: relative; width: 36px; height: 36px; flex-shrink: 0;">${avatar(u, 36)}${u.on
              ? `<span style="position: absolute; right: -1px; bottom: -1px; width: 10px; height: 10px; border-radius: 9999px; background: ${T.emerald500}; box-shadow: 0 0 0 2px #ffffff;"></span>`
              : ''}</div>`;

const cabeceraGrupo = (punto, texto, n, borde) => `
          <div style="height: 32px; flex-shrink: 0; display: flex; align-items: center; gap: 8px; padding: 0 16px; border-bottom: 1px solid ${DIVISOR_FUERTE};${borde ? ` border-top: 1px solid ${DIVISOR_FUERTE};` : ''} font-size: ${T.xs}; line-height: ${T.lhXs}; font-weight: 600;">
            <span style="width: 8px; height: 8px; flex-shrink: 0; border-radius: 9999px; background: ${punto};"></span>
            <span style="color: ${T.navy};">${texto}</span>
            <span style="color: ${T.muted};">·</span>
            <span style="color: ${T.muted}; font-variant-numeric: tabular-nums;">${n}</span>
          </div>`;

const fila = (u, ultima) => {
  const activa = u.n === SELECCION;
  const envio = u.r === 'advisor' && u.bulk
    ? `<span title="Envío masivo" style="display: flex; color: ${T.navy};">${icono('send', 12)}</span>`
    : '';
  return `
          <div style="position: relative; height: 56px; flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding-left: 16px;${activa ? ' background: #ffffff; box-shadow: inset 3px 0 0 #2e3f84;' : ''}">
            ${avatarPresencia(u)}
            <div style="min-width: 0; flex: 1; align-self: stretch; display: flex; flex-direction: column; justify-content: center; gap: 2px; padding-right: 16px;${ultima ? '' : ` border-bottom: 1px solid ${DIVISOR};`}">
              <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 12px;">
                <p style="min-width: 0; font-size: ${T.sm}; line-height: ${T.lhSm}; font-weight: 700; color: ${T.navy}; ${truncar}">${u.n}</p>${u.on ? '' : `
                <span style="flex-shrink: 0; font-size: ${T.xs}; line-height: ${T.lhXs}; color: ${T.muted}; white-space: nowrap;">${u.act}</span>`}
              </div>
              <div style="display: flex; align-items: center; gap: 8px; font-size: ${T.xs}; line-height: ${T.lhXs}; color: ${T.muted};">
                <span>${rolTexto(u.r)}</span>${envio}
              </div>
            </div>
          </div>`;
};

const grupo = (lista) => lista.map((u, i) => fila(u, i === lista.length - 1)).join('');

const panelLista = tarjeta(`
        <div style="flex-shrink: 0; display: flex; flex-direction: column; gap: 12px; padding: 16px; border-bottom: 1px solid ${DIVISOR_FUERTE};">
          ${busqueda()}
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
            ${segmentado(['Todos', 'Administradores', 'Asesores'], 0)}
            <p style="font-size: ${T.xs}; line-height: ${T.lhXs}; color: ${T.sub}; white-space: nowrap;">${METRICAS.total} de ${METRICAS.total} usuarios</p>
          </div>
        </div>
        <div aria-label="Directorio de usuarios" style="position: relative; flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; background: ${T.bg};">
          ${cabeceraGrupo(T.emerald500, 'En línea', METRICAS.online, false)}
          ${grupo(enLinea)}
          ${cabeceraGrupo(T.slate400, 'Desconectados', DESCONECTADOS, true)}
          ${grupo(desconectados)}
        </div>`, 'width: 416px; flex-shrink: 0; display: flex; flex-direction: column; overflow: hidden;');

// ── Ficha (panel derecho) ────────────────────────────────────────────────────
const avatarGrande = (u) =>
  `<div style="width: 64px; height: 64px; flex-shrink: 0; border-radius: 9999px; background: ${T.navy}; color: #ffffff; font-size: ${T.x3}; line-height: 1; font-weight: 700; display: flex; align-items: center; justify-content: center;">${iniciales(u.n)}</div>`;

const dato = (etiqueta, valor, ultima = false) => `
            <div style="height: 44px; display: flex; align-items: center; gap: 16px;${ultima ? '' : ` border-bottom: 1px solid ${DIVISOR};`}">
              <span style="width: 160px; flex-shrink: 0; font-size: ${T.sm}; line-height: ${T.lhSm}; color: ${T.sub};">${etiqueta}</span>
              <span style="min-width: 0; flex: 1; font-size: ${T.sm}; line-height: ${T.lhSm}; font-weight: 600; color: ${T.navy}; ${truncar}">${valor}</span>
            </div>`;

const botonSecundario = (texto, ico) =>
  `<div style="height: 40px; border-radius: 12px; padding: 0 16px; background: ${T.btnSecondary}; box-shadow: ${T.btnSecondaryShadow}; color: ${T.navy}; font-size: ${T.xs}; font-weight: 600; display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; flex-shrink: 0;">${icono(ico, 16)}<span>${texto}</span></div>`;

const botonEliminar =
  `<div style="height: 40px; border-radius: 12px; color: ${T.red600}; font-size: ${T.xs}; font-weight: 600; display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; flex-shrink: 0;">${icono('trash-2', 16)}<span>Eliminar usuario</span></div>`;

const panelFicha = tarjeta(`
        <div style="flex-shrink: 0; display: flex; align-items: center; gap: 20px; padding: 24px; border-bottom: 1px solid ${DIVISOR_FUERTE};">
          ${avatarGrande(sel)}
          <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0;">
              <h2 style="font-size: ${T.x3}; line-height: 1.25; font-weight: 600; color: ${T.navy}; ${truncar}">${sel.n}</h2>
              <p style="font-size: ${T.sm}; line-height: ${T.lhSm}; color: ${T.sub}; ${truncar}">${sel.e}</p>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">${rolPill(sel.r)}${conexionPill(sel.on)}</div>
          </div>
        </div>

        <div style="flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: 24px; padding: 8px 24px 24px;">
          <div style="display: flex; flex-direction: column;">
            ${dato('Rol', rolTexto(sel.r))}
            ${dato('Estado', sel.on ? 'En línea' : 'Desconectado')}
            ${dato('Última actividad', sel.act)}
            ${dato('Registro', sel.reg, true)}
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            <h3 style="font-size: ${T.base}; line-height: 1.5; font-weight: 700; color: ${T.navy};">Permisos</h3>
            <div style="display: flex; align-items: center; gap: 12px; padding: 16px; border-radius: 12px; border: 1px solid ${T.border};">
              <span style="display: flex; align-self: flex-start; padding-top: 1px; color: ${T.navy};">${icono('send', 16)}</span>
              <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 4px;">
                <p style="font-size: ${T.sm}; line-height: ${T.lhSm}; font-weight: 700; color: ${T.navy};">Envío masivo</p>
                <p style="font-size: ${T.xs}; line-height: ${T.lhXs}; color: ${T.sub};">Puede enviar plantillas de WhatsApp a listas de pacientes.</p>
              </div>
              <div title="${sel.bulk ? 'Desactivar envío masivo' : 'Activar envío masivo'}" style="display: flex;">${interruptor(sel.bulk)}</div>
            </div>
          </div>
        </div>

        <div style="flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 24px; border-top: 1px solid ${DIVISOR_FUERTE};">
          ${botonSecundario('Editar usuario', 'edit-3')}
          ${botonEliminar}
        </div>`, 'flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden;');

// ── Página ───────────────────────────────────────────────────────────────────
const pagina = `
  <div style="position: absolute; left: 80px; top: 0; right: 0; bottom: 0; padding: 32px; display: flex; justify-content: center;">
    <div style="flex: 1; min-width: 0; max-width: 1280px; display: flex; flex-direction: column; gap: 20px;">
      ${cabeceraPagina}
      <div style="flex: 1; min-height: 0; display: flex; gap: 16px;">
        ${panelLista}
        ${panelFicha}
      </div>
    </div>
  </div>`;

// El riel va tal cual. Única salvedad técnica: GRANO lleva comillas dobles dentro de un style="..."
// y rompe el atributo (HTML no canónico). Se escapan a &quot; solo en esta salida; el diseño no cambia
// y, si GRANO se corrige en _comun.mjs, esta sustitución deja de tener efecto.
const riel = rielActual('users').split(GRANO).join(GRANO.replace(/"/g, '&quot;'));

escribir('ListaYFicha.dc.html', documento(lienzo(riel + pagina)));
