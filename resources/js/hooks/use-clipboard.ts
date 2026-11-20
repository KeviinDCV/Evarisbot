// Credit: https://usehooks-ts.com/
import { copiarTexto } from '@/lib/portapapeles';
import { useCallback, useState } from 'react';

type CopiedValue = string | null;

type CopyFn = (text: string) => Promise<boolean>;

export function useClipboard(): [CopiedValue, CopyFn] {
    const [copiedText, setCopiedText] = useState<CopiedValue>(null);

    const copy: CopyFn = useCallback(async (text) => {
        // También por http (la IP de la red interna), donde navigator.clipboard no existe.
        const ok = await copiarTexto(text);
        setCopiedText(ok ? text : null);

        return ok;
    }, []);

    return [copiedText, copy];
}
