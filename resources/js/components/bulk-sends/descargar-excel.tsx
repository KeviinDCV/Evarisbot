import { BOTON_APAGADO, BOTON_SECUNDARIO } from '@/components/appointments/piezas-citas';
import { IconoAnimado } from '@/components/icono-animado';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const nuevaMarca = () => Math.random().toString(36).slice(2, 12);

/**
 * «Descargar Excel» de Envío masivo (todos los envíos, o uno). El servidor tarda en empezar a mandar el archivo (unos
 * 10 s con todos): mientras, «Preparando…» y no se puede pedir otra vez. Sabe que llegó por la cookie
 * masivos_export_<marca> que pone la respuesta (el mismo mecanismo de Exportar en Citas).
 */
export function BotonDescargarExcel({
    href,
    ayuda,
    className,
    prefijo = 'masivos_export_',
}: {
    href: string;
    ayuda: string;
    className?: string;
    /** Nombre de la cookie que pone la respuesta (Citas usa citas_export_). */
    prefijo?: string;
}) {
    const { t } = useTranslation();
    const [marca, setMarca] = useState(nuevaMarca);
    const [preparando, setPreparando] = useState(false);

    useEffect(() => {
        if (!preparando) return;
        const cookie = `${prefijo}${marca}`;
        const inicio = Date.now();
        const vigilar = window.setInterval(() => {
            const lista = document.cookie.split('; ').some((c) => c.startsWith(`${cookie}=`));
            // Respaldo: si nunca llega (se cortó la conexión), el botón no se queda apagado para siempre.
            if (lista || Date.now() - inicio > 300000) {
                document.cookie = `${cookie}=; Max-Age=0; path=/`;
                setPreparando(false);
                setMarca(nuevaMarca());
            }
        }, 500);

        return () => window.clearInterval(vigilar);
    }, [preparando, marca, prefijo]);

    return (
        <a
            href={`${href}?descarga=${marca}`}
            onClick={(event) => {
                if (preparando) event.preventDefault();
                else setPreparando(true);
            }}
            aria-disabled={preparando || undefined}
            aria-busy={preparando || undefined}
            title={ayuda}
            className={cn(preparando ? BOTON_APAGADO : BOTON_SECUNDARIO, preparando && 'cursor-wait', className)}
        >
            <IconoAnimado clave={preparando ? 'girando' : 'descargar'}>
                {preparando ? <Spinner className="motion-reduce:animate-none" /> : <Download strokeWidth={2} />}
            </IconoAnimado>
            {preparando ? t('bulkSends.excelPreparing') : t('bulkSends.excelDownload')}
        </a>
    );
}
