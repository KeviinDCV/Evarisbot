import { cn } from '@/lib/utils';
import { Fragment, type ReactNode } from 'react';
import { ACENTO, TINTA, nombreVisible } from './piezas-chat';

/* Texto de un mensaje: @menciones resaltadas y *negrita* al estilo WhatsApp. SOLO presentación: el
   texto guardado no cambia (los asteriscos siguen en el dato; aquí se pintan como negrita). */

/** *así* → <strong>así</strong>. Solo dentro de una línea y sin asteriscos anidados. */
function conNegrita(texto: string, clave: string): ReactNode[] {
    const out: ReactNode[] = [];
    const re = /\*([^*\n]+)\*/g;
    let ultimo = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = re.exec(texto))) {
        if (m.index > ultimo) out.push(texto.slice(ultimo, m.index));
        out.push(
            <strong key={`${clave}-b${i++}`} className="font-semibold">
                {m[1]}
            </strong>
        );
        ultimo = m.index + m[0].length;
    }
    if (ultimo < texto.length) out.push(texto.slice(ultimo));
    return out;
}

export interface PersonaMencionable {
    id: number;
    name: string;
}

export function TextoMensaje({
    texto,
    personas,
    miId,
    propia,
    hueco = 0,
}: {
    texto: string;
    /** Quién se puede mencionar en este chat (los nombres tal como se guardan). */
    personas: PersonaMencionable[];
    miId: number;
    propia: boolean;
    /** Ancho reservado al final de la última línea para la hora (px). */
    hueco?: number;
}) {
    const nombres = personas.map((u) => u.name).sort((a, b) => b.length - a.length);
    let partes: ReactNode[];
    if (nombres.length === 0) {
        partes = conNegrita(texto, 't');
    } else {
        const escapados = nombres.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const regex = new RegExp(`(@(?:${escapados.join('|')}))`, 'g');
        partes = texto.split(regex).map((parte, pi) => {
            if (parte.startsWith('@')) {
                const nombre = parte.slice(1);
                const mencionada = personas.find((u) => u.name === nombre);
                if (mencionada) {
                    const soyYo = mencionada.id === miId;
                    return (
                        <span
                            key={pi}
                            title={nombreVisible(nombre)}
                            className={cn(
                                'rounded font-semibold',
                                ACENTO,
                                !propia && (soyYo ? 'bg-[#2e3f84]/12 px-0.5 dark:bg-white/12' : 'bg-[#2e3f84]/8 px-0.5 dark:bg-white/8')
                            )}
                        >
                            @{nombreVisible(nombre)}
                        </span>
                    );
                }
            }
            return <Fragment key={pi}>{conNegrita(parte, String(pi))}</Fragment>;
        });
    }
    return (
        <p className={cn('text-[14px] leading-5 whitespace-pre-wrap [overflow-wrap:anywhere]', TINTA)}>
            {partes}
            {hueco > 0 && <span className="inline-block h-px" style={{ width: hueco }} aria-hidden="true" />}
        </p>
    );
}
