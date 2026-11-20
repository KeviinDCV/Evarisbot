import { BOTON_PELIGRO, BOTON_PRIMARIO, BOTON_SECUNDARIO, FOCO, TEXTO_NAVY } from '@/components/appointments/piezas-citas';
import { cn } from '@/lib/utils';
import { ArrowLeft, Check, LogOut, Pencil, Search, Trash2, UserMinus, UserPlus, X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { AvatarGrupo, AvatarPersona, BOTON_ICONO_CHAT, FILETE_CHAT, GRIS, SOMBRA_PANEL, nombreVisible } from './piezas-chat';

/* Detalles del grupo: panel a la derecha de la conversación (en el celular, a pantalla completa).
   Solo presentación: las acciones llegan por props y son las mismas llamadas de siempre. */

export interface PersonaDetalle {
    id: number;
    name: string;
    role: string;
    is_online: boolean;
}

export interface TextosDetalles {
    titulo: string;
    tituloAnadir: string;
    cerrar: string;
    volver: string;
    renombrar: string;
    resumen: string;
    rotuloParticipantes: string;
    anadir: string;
    anadirTitulo: string;
    tu: string;
    creador: string;
    enLinea: string;
    quitar: (nombre: string) => string;
    rol: (rol: string) => string;
    eliminarGrupo: string;
    eliminarNota: string;
    salirGrupo: string;
    salirNota: string;
    buscar: string;
    soloFuera: string;
    sinResultados: string;
    anadirN: string;
}

function FilaPersona({
    p,
    t,
    yo,
    creador,
    marcada,
    onMarcar,
    onQuitar,
}: {
    p: PersonaDetalle;
    t: TextosDetalles;
    yo?: boolean;
    creador?: boolean;
    marcada?: boolean;
    onMarcar?: () => void;
    onQuitar?: () => void;
}) {
    const cuerpo = (
        <>
            {onMarcar && (
                <span
                    className={cn(
                        'flex size-[18px] shrink-0 items-center justify-center rounded-[5px]',
                        marcada ? 'bg-[#2e3f84] text-white dark:bg-[#8b9ae0] dark:text-neutral-900' : 'bg-white shadow-[inset_0_0_0_1.5px_var(--color-slate-500)] dark:bg-transparent dark:shadow-[inset_0_0_0_1.5px_var(--color-neutral-400)]'
                    )}
                    aria-hidden="true"
                >
                    {marcada && <Check className="size-3" strokeWidth={3} />}
                </span>
            )}
            <AvatarPersona nombre={p.name} rol={p.role} enLinea={p.is_online} tam={32} anillo="ring-white dark:ring-neutral-900" />
            <span className="flex min-w-0 flex-1 flex-col gap-px text-left">
                <span className={cn('truncate text-[13px] leading-[18px]', marcada || !onMarcar ? 'font-semibold' : 'font-medium', TEXTO_NAVY)}>
                    {nombreVisible(p.name)}
                    {yo && <span className={cn('font-normal', GRIS)}> {t.tu}</span>}
                </span>
                <span className={cn('flex min-w-0 items-center gap-1.5 text-[12px] leading-4 whitespace-nowrap', GRIS)}>
                    <span className="truncate">{t.rol(p.role)}</span>
                    {p.is_online && <span className="font-medium text-emerald-700 dark:text-emerald-400">· {t.enLinea}</span>}
                    {creador && (
                        <span className={cn('inline-flex h-[18px] shrink-0 items-center rounded-[5px] bg-[#2e3f84]/7 px-1.5 text-[11px] leading-3 font-semibold dark:bg-white/8', TEXTO_NAVY)}>{t.creador}</span>
                    )}
                </span>
            </span>
        </>
    );
    if (onMarcar) {
        return (
            <button
                type="button"
                role="checkbox"
                aria-checked={!!marcada}
                onClick={onMarcar}
                className={cn(
                    'flex h-[50px] w-full shrink-0 cursor-pointer items-center gap-[11px] rounded-[9px] px-2 transition-colors',
                    FOCO,
                    marcada ? 'bg-[#2e3f84]/5 dark:bg-white/[0.06]' : 'hover:bg-[#2e3f84]/[0.035] dark:hover:bg-white/[0.04]'
                )}
            >
                {cuerpo}
            </button>
        );
    }
    return (
        <div className="group/p flex h-[50px] shrink-0 items-center gap-[11px] rounded-[9px] px-2 transition-colors hover:bg-[#2e3f84]/[0.045] dark:hover:bg-white/[0.04]">
            {cuerpo}
            {onQuitar && (
                <button
                    type="button"
                    onClick={onQuitar}
                    title={t.quitar(nombreVisible(p.name))}
                    aria-label={t.quitar(nombreVisible(p.name))}
                    className={cn(
                        BOTON_ICONO_CHAT,
                        'size-[30px] text-red-700 opacity-0 group-focus-within/p:opacity-100 group-hover/p:opacity-100 hover:bg-red-50 hover:text-red-700 focus-visible:opacity-100 max-md:opacity-100 dark:text-red-300 dark:hover:bg-red-500/10 dark:hover:text-red-300'
                    )}
                >
                    <UserMinus className="size-4" strokeWidth={1.9} aria-hidden="true" />
                </button>
            )}
        </div>
    );
}

export function PanelDetalles({
    nombreGrupo,
    participantes,
    miId,
    creadorId,
    soyCreador,
    vista,
    t,
    onCerrar,
    onRenombrar,
    onVerAnadir,
    onVolver,
    onQuitar,
    onEliminarOSalir,
    busqueda,
    onBusqueda,
    candidatos,
    elegidos,
    onMarcar,
    anadiendo,
    onAnadir,
}: {
    nombreGrupo: string;
    participantes: PersonaDetalle[];
    miId: number;
    creadorId?: number;
    /** Solo quien creó el grupo lo administra (renombrar, añadir, quitar). */
    soyCreador: boolean;
    vista: 'personas' | 'anadir';
    t: TextosDetalles;
    onCerrar: () => void;
    onRenombrar: () => void;
    onVerAnadir: () => void;
    onVolver: () => void;
    onQuitar: (p: PersonaDetalle) => void;
    onEliminarOSalir: () => void;
    busqueda: string;
    onBusqueda: (v: string) => void;
    candidatos: PersonaDetalle[];
    elegidos: number[];
    onMarcar: (id: number) => void;
    anadiendo: boolean;
    onAnadir: () => void;
}) {
    // Al abrir, el foco pasa al panel (sin anillo) para que el teclado siga desde aquí.
    const panelRef = useRef<HTMLElement>(null);
    useEffect(() => {
        if (vista === 'personas') panelRef.current?.focus({ preventScroll: true });
    }, [vista]);

    const cabecera = (titulo: string, atras?: ReactNode) => (
        <div className={cn('flex h-14 shrink-0 items-center gap-2 border-b pr-2.5 pl-[18px]', FILETE_CHAT)}>
            {atras}
            <h2 id="titulo-detalles" className={cn('min-w-0 flex-1 truncate text-[14.5px] leading-5 font-semibold', TEXTO_NAVY)}>
                {titulo}
            </h2>
            <button type="button" onClick={onCerrar} title={t.cerrar} aria-label={t.cerrar} className={cn(BOTON_ICONO_CHAT, 'size-[30px]')}>
                <X className="size-4" strokeWidth={2} aria-hidden="true" />
            </button>
        </div>
    );

    return (
        <aside
            ref={panelRef}
            tabIndex={-1}
            aria-labelledby="titulo-detalles"
            className={cn('absolute inset-y-0 right-0 z-30 flex w-full flex-col overflow-hidden bg-white outline-none sm:inset-y-3 sm:right-3 sm:w-[360px] sm:rounded-[14px] dark:bg-neutral-900', SOMBRA_PANEL)}
        >
            {vista === 'anadir' ? (
                <>
                    {cabecera(
                        t.tituloAnadir,
                        <button type="button" onClick={onVolver} title={t.volver} aria-label={t.volver} className={cn(BOTON_ICONO_CHAT, '-ml-2 size-[30px]', TEXTO_NAVY)}>
                            <ArrowLeft className="size-[17px]" strokeWidth={1.9} aria-hidden="true" />
                        </button>
                    )}
                    <div className="flex flex-col gap-2 px-[18px] pt-3.5 pb-2">
                        <div className="relative">
                            <Search className={cn('pointer-events-none absolute top-1/2 left-[11px] size-4 -translate-y-1/2', GRIS)} strokeWidth={1.75} aria-hidden="true" />
                            <input
                                type="text"
                                value={busqueda}
                                onChange={(e) => onBusqueda(e.target.value)}
                                placeholder={t.buscar}
                                aria-label={t.buscar}
                                autoFocus
                                className={cn(
                                    'h-9 w-full rounded-[10px] bg-[#2e3f84]/[0.035] pr-3 pl-9 text-[13px] leading-[18px] text-[#2e3f84] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.1)] outline-none placeholder:text-[#5c6485] focus:shadow-[inset_0_0_0_1px_#2e3f84,0_0_0_3px_rgba(46,63,132,0.14)]',
                                    'dark:bg-white/[0.04] dark:text-neutral-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] dark:placeholder:text-neutral-400 dark:focus:shadow-[inset_0_0_0_1px_#8b9ae0,0_0_0_3px_rgba(139,154,224,0.3)]'
                                )}
                            />
                        </div>
                        <span className={cn('text-[12px] leading-4', GRIS)}>{t.soloFuera}</span>
                    </div>
                    <div className="custom-scrollbar-light flex min-h-0 flex-1 flex-col overflow-y-auto px-2.5 pb-2">
                        {candidatos.length === 0 ? (
                            <p className={cn('px-2 py-6 text-center text-[12.5px] leading-[18px]', GRIS)}>{t.sinResultados}</p>
                        ) : (
                            candidatos.map((p) => <FilaPersona key={p.id} p={p} t={t} marcada={elegidos.includes(p.id)} onMarcar={() => onMarcar(p.id)} />)
                        )}
                    </div>
                    <div className={cn('flex items-center justify-between gap-2 border-t bg-[#2e3f84]/[0.028] px-[18px] py-3 dark:bg-white/[0.03]', FILETE_CHAT)}>
                        <button type="button" onClick={onVolver} className={BOTON_SECUNDARIO}>
                            {t.volver}
                        </button>
                        <button type="button" disabled={elegidos.length === 0 || anadiendo} onClick={onAnadir} className={BOTON_PRIMARIO}>
                            {anadiendo ? <span className="size-4 animate-spin rounded-full border-2 border-white/50 border-t-white" aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
                            {t.anadirN}
                        </button>
                    </div>
                </>
            ) : (
                <>
                    {cabecera(t.titulo)}
                    <div className={cn('flex flex-col items-center gap-2.5 border-b px-[18px] pt-[18px] pb-4', FILETE_CHAT)}>
                        <AvatarGrupo tam={56} />
                        <div className="flex max-w-full min-w-0 items-center gap-1.5">
                            <span className={cn('min-w-0 text-center text-[16px] leading-[22px] font-semibold [overflow-wrap:anywhere]', TEXTO_NAVY)}>{nombreGrupo}</span>
                            {soyCreador && (
                                <button type="button" onClick={onRenombrar} title={t.renombrar} aria-label={t.renombrar} className={cn(BOTON_ICONO_CHAT, 'size-7', TEXTO_NAVY)}>
                                    <Pencil className="size-4" strokeWidth={1.9} aria-hidden="true" />
                                </button>
                            )}
                        </div>
                        <span className={cn('text-center text-[12.5px] leading-4 tabular-nums', GRIS)}>{t.resumen}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 px-[18px] pt-3 pb-1.5">
                        <span className={cn('text-[11px] leading-4 font-semibold tracking-[0.07em] whitespace-nowrap uppercase', GRIS)}>{t.rotuloParticipantes}</span>
                        {soyCreador && (
                            <button type="button" onClick={onVerAnadir} title={t.anadirTitulo} className={cn(BOTON_SECUNDARIO, 'h-[30px] pr-3 pl-2.5')}>
                                <UserPlus aria-hidden="true" />
                                {t.anadir}
                            </button>
                        )}
                    </div>
                    <div className="custom-scrollbar-light flex min-h-0 flex-1 flex-col overflow-y-auto px-2.5 pb-2">
                        {participantes.map((p) => {
                            const esCreador = creadorId !== undefined && p.id === creadorId;
                            // Igual que siempre: ni a ti ni al creador; y ahora, solo si tú creaste el grupo.
                            const puedeQuitar = soyCreador && p.id !== miId && !esCreador;
                            return <FilaPersona key={p.id} p={p} t={t} yo={p.id === miId} creador={esCreador} onQuitar={puedeQuitar ? () => onQuitar(p) : undefined} />;
                        })}
                    </div>
                    <div className={cn('flex flex-col gap-2 border-t px-[18px] pt-3 pb-3.5', FILETE_CHAT)}>
                        <button type="button" onClick={onEliminarOSalir} className={cn(BOTON_PELIGRO, 'w-full')}>
                            {soyCreador ? <Trash2 aria-hidden="true" /> : <LogOut aria-hidden="true" />}
                            {soyCreador ? t.eliminarGrupo : t.salirGrupo}
                        </button>
                        <span className={cn('text-[12px] leading-4', GRIS)}>{soyCreador ? t.eliminarNota : t.salirNota}</span>
                    </div>
                </>
            )}
        </aside>
    );
}
