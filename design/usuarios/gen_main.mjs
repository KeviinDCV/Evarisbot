// "Directorio compacto" (Main, candidata principal).
// Misma tabla que hoy; lo que cambia es todo lo que había ANTES de ella y la densidad de cada fila.
//  - Las 4 tarjetas de métricas y la tarjeta de filtros desaparecen como bloques: el filtro de rol lleva las
//    cifras dentro, y "en línea" y el recuento viven en la barra de la tabla.
//  - La búsqueda sube a la cabecera, junto a la acción principal.
//  - Filas de una línea: presencia como punto en el avatar, rol como texto con icono, sin pastillas con borde.
//  - Eliminar sale de cada fila a un menú (...): hoy hay una papelera roja en cada una de las 33 filas.
import { T, icono, USUARIOS, METRICAS, rolTexto, rielActual, documento, escribir } from './_comun.mjs';
import { lienzo, truncar, interruptor, avatar, botonPrimario, botonIcono, busqueda } from './_piezas.mjs';

// Avatar con punto de presencia (esmeralda con anillo blanco) cuando está en línea.
const avatarPresencia = (u) => `
                  <div style="position: relative; flex-shrink: 0;">
                    ${avatar(u, 32)}
                    ${u.on ? `<span style="position: absolute; right: -1px; bottom: -1px; width: 10px; height: 10px; border-radius: 9999px; background: ${T.emerald500}; box-shadow: 0 0 0 2px #ffffff;"></span>` : ''}
                  </div>`;

// Rol como texto con icono (sin borde ni relleno: la columna ya dice qué es).
const rol = (r) => r === 'admin'
  ? `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: ${T.xs}; line-height: ${T.lhXs}; font-weight: 600; color: ${T.navy}; white-space: nowrap;">${icono('shield-check', 14)}${rolTexto(r)}</span>`
  : `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: ${T.xs}; line-height: ${T.lhXs}; font-weight: 600; color: ${T.sky700}; white-space: nowrap;">${icono('headphones', 14)}${rolTexto(r)}</span>`;

// Estado en una línea: el color lo dice sin leer, la palabra lo confirma.
const estado = (on) => on
  ? `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: ${T.xs}; line-height: ${T.lhXs}; font-weight: 600; color: ${T.emerald700}; white-space: nowrap;"><span style="width: 8px; height: 8px; border-radius: 9999px; background: ${T.emerald500};"></span>En línea</span>`
  : `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: ${T.xs}; line-height: ${T.lhXs}; font-weight: 600; color: ${T.slate600}; white-space: nowrap;"><span style="width: 8px; height: 8px; border-radius: 9999px; background: ${T.slate400};"></span>Desconectado</span>`;

const botonMas = (abierto = false) =>
  `<div title="Más acciones" style="width: 32px; height: 32px; flex-shrink: 0; border-radius: 12px; background: ${abierto ? '#e4e8f3' : 'transparent'}; color: ${abierto ? T.navy : T.sub}; display: flex; align-items: center; justify-content: center;">${icono('ellipsis', 16)}</div>`;

// Menú de la fila, mostrado abierto en una para que se vea dónde vive Eliminar.
const menuFila = `
                    <div style="position: absolute; right: 16px; top: 44px; z-index: 10; width: 184px; padding: 4px; border-radius: 12px; background: #ffffff; border: 1px solid ${T.border}; box-shadow: 0 1px 2px rgba(46,63,132,.06), 0 12px 28px -8px rgba(46,63,132,.22);">
                      <div style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; font-size: ${T.sm}; line-height: ${T.lhSm}; font-weight: 500; color: ${T.red600}; white-space: nowrap;">${icono('trash-2', 16)}Eliminar usuario</div>
                    </div>`;

const td = (dentro, extra = '') => `<td style="padding: 9px 16px; ${extra}">${dentro}</td>`;

const fila = (u, i) => {
  const abierto = i === 2;
  return `
            <tr style="border-bottom: 1px solid rgba(212,216,232,.6);${abierto ? ' background: #fafbfd;' : ''}">
              ${td(`
                <div style="display: flex; min-width: 0; align-items: center; gap: 12px;">
                  ${avatarPresencia(u)}
                  <div style="min-width: 0;">
                    <p style="font-size: ${T.sm}; line-height: ${T.lhSm}; font-weight: 600; color: ${T.navy}; ${truncar}">${u.n}</p>
                    <p style="font-size: ${T.xs}; line-height: ${T.lhXs}; color: ${T.sub}; ${truncar}">${u.e}</p>
                  </div>
                </div>`, 'max-width: 340px;')}
              ${td(rol(u.r))}
              ${td(estado(u.on))}
              ${td(`<span style="font-size: ${T.xs}; line-height: ${T.lhXs}; color: ${T.sub}; white-space: nowrap;">${u.act}</span>`)}
              ${td(u.r === 'advisor' ? `<div style="display: flex; justify-content: center;">${interruptor(u.bulk)}</div>` : `<div style="text-align: center; font-size: ${T.xs}; color: ${T.slate400};">—</div>`)}
              ${td(`<span style="font-size: ${T.xs}; line-height: ${T.lhXs}; color: ${T.sub}; white-space: nowrap;">${u.reg}</span>`)}
              ${td(`
                <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px;">${botonIcono('edit-3', 'Editar')}${botonMas(abierto)}</div>${abierto ? menuFila : ''}`, 'position: relative;')}
            </tr>`;
};

const th = (txt, alinear = 'left') =>
  `<th style="padding: 10px 16px; text-align: ${alinear}; font-size: ${T.xs}; line-height: ${T.lhXs}; font-weight: 600; color: ${T.navy}; white-space: nowrap;">${txt}</th>`;

// Filtro de rol con la cifra dentro de cada opción: las tarjetas de métricas ya no hacen falta.
const filtroRol = () => {
  const opcion = (texto, n, activa) => activa
    ? `<div style="display: flex; align-items: center; gap: 8px; border-radius: 10px; padding: 6px 12px; background: ${T.navy}; color: #ffffff; box-shadow: 0 1px 3px 0 rgb(46 63 132 / .2), 0 1px 2px -1px rgb(46 63 132 / .2); white-space: nowrap;"><span style="font-size: ${T.xs}; line-height: ${T.lhXs}; font-weight: 600;">${texto}</span><span style="font-size: 11px; line-height: 1.5; font-weight: 600; color: rgba(255,255,255,.72); font-variant-numeric: tabular-nums;">${n}</span></div>`
    : `<div style="display: flex; align-items: center; gap: 8px; border-radius: 10px; padding: 6px 12px; color: ${T.sub}; white-space: nowrap;"><span style="font-size: ${T.xs}; line-height: ${T.lhXs}; font-weight: 600;">${texto}</span><span style="font-size: 11px; line-height: 1.5; font-weight: 600; color: ${T.muted}; font-variant-numeric: tabular-nums;">${n}</span></div>`;
  return `<div style="display: inline-flex; border-radius: 12px; background: ${T.bg}; padding: 4px;">${opcion('Todos', METRICAS.total, true)}${opcion('Administradores', METRICAS.admins)}${opcion('Asesores', METRICAS.advisors)}</div>`;
};

const pagina = `
  <div style="position: absolute; left: 80px; top: 0; right: 0; bottom: 0; padding: 28px 32px 0;">
    <div style="max-width: 1280px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px;">

      <div style="display: flex; align-items: center; justify-content: space-between; gap: 24px;">
        <div style="min-width: 0;">
          <h1 style="font-size: ${T.x3}; line-height: 1.25; font-weight: 700; color: ${T.navy};">Gestión de usuarios</h1>
          <p style="margin-top: 4px; font-size: ${T.sm}; line-height: 1.5; color: ${T.muted};">Administra los usuarios del sistema</p>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 320px;">${busqueda()}</div>
          ${botonPrimario('Nuevo usuario')}
        </div>
      </div>

      <div style="background: ${T.card}; box-shadow: ${T.cardShadow}; border-radius: 16px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 16px; border-bottom: 1px solid rgba(212,216,232,.8);">
          ${filtroRol()}
          <div style="display: flex; align-items: center; gap: 16px;">
            <span style="display: inline-flex; align-items: center; gap: 8px; font-size: ${T.xs}; line-height: ${T.lhXs}; font-weight: 600; color: ${T.emerald700}; white-space: nowrap;"><span style="width: 8px; height: 8px; border-radius: 9999px; background: ${T.emerald500};"></span>${METRICAS.online} en línea</span>
            <span style="width: 1px; height: 16px; background: ${T.border};"></span>
            <span style="font-size: ${T.xs}; line-height: ${T.lhXs}; color: ${T.sub}; white-space: nowrap;">${METRICAS.total} de ${METRICAS.total} usuarios</span>
          </div>
        </div>
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid rgba(212,216,232,.8); background: ${T.thead};">
              ${th('Usuario')}${th('Rol')}${th('Estado')}${th('Última actividad')}
              <th style="padding: 10px 16px; text-align: center; font-size: ${T.xs}; line-height: ${T.lhXs}; font-weight: 600; color: ${T.navy}; white-space: nowrap;"><span style="display: inline-flex; align-items: center; justify-content: center; gap: 6px;">${icono('send', 14)}Envío masivo<span style="margin-left: 2px; border-radius: 9999px; padding: 0 7px; background: rgba(46,63,132,.1); font-size: 11px; line-height: 18px; font-weight: 600; font-variant-numeric: tabular-nums;">${METRICAS.bulk}</span></span></th>
              ${th('Registro')}${th('Acciones', 'right')}
            </tr>
          </thead>
          <tbody>${USUARIOS.map(fila).join('')}
          </tbody>
        </table>
      </div>

    </div>
  </div>`;

escribir('Main.dc.html', documento(lienzo(rielActual('users') + pagina)));
