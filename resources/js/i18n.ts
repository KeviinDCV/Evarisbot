import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import translationES from './locales/es/translation.json';

/**
 * Sólo el ESPAÑOL entra en el bundle inicial.
 *
 * Antes se importaban los dos locales estáticamente y ambos acababan en el chunk de entrada:
 * ~78KB de inglés que el 99% de este hospital nunca usa (y la causa real del crecimiento de
 * app.js, no la sidebar). El inglés se carga bajo demanda con import() dinámico.
 *
 * El español es el fallbackLng y el idioma por defecto, así que sigue siendo estático: nunca
 * hay un parpadeo de claves crudas ni una pantalla vacía mientras se resuelve nada.
 */
const loaded = new Set<string>(['es']);

async function ensureLanguage(lng: string | undefined): Promise<void> {
    // Normaliza 'en-US' → 'en'. Sólo existe es/en (supportedLngs).
    const base = (lng ?? '').split('-')[0];
    if (base !== 'en' || loaded.has('en')) return;

    try {
        const mod = await import('./locales/en/translation.json');
        i18n.addResourceBundle('en', 'translation', mod.default, true, true);
        loaded.add('en');
        // addResourceBundle no repinta por sí solo: re-emitir languageChanged hace que
        // react-i18next vuelva a renderizar ya con el bundle dentro. No hay bucle: la
        // segunda pasada sale temprano por loaded.has('en').
        await i18n.changeLanguage('en');
    } catch {
        // Si la carga falla (red caída), i18next sigue con el fallback español.
    }
}

i18n
    // Detecta el idioma del navegador
    .use(LanguageDetector)
    // Pasa la instancia i18n a react-i18next
    .use(initReactI18next)
    // Inicializa i18next
    .init({
        resources: {
            es: { translation: translationES },
        },
        fallbackLng: 'es', // Idioma por defecto: español
        // NO usar lng aquí para permitir que LanguageDetector funcione
        debug: false, // Debug desactivado para producción

        supportedLngs: ['es', 'en'], // Idiomas soportados

        interpolation: {
            escapeValue: false, // React ya escapa por defecto
        },

        detection: {
            // Orden de detección de idioma - localStorage primero para respetar selección del usuario
            order: ['localStorage', 'navigator'],
            // Caché del idioma en localStorage
            caches: ['localStorage'],
            lookupLocalStorage: 'i18nextLng',
        },

        react: {
            useSuspense: false, // Evitar problemas de Suspense con Inertia
        },
    });

// Al cambiar de idioma (selector) y al arrancar (si el detector ya dice 'en').
i18n.on('languageChanged', (lng) => {
    void ensureLanguage(lng);
});
void ensureLanguage(i18n.language);

export default i18n;
