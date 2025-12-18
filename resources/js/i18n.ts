import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import translationEN from './locales/en/translation.json';
import translationES from './locales/es/translation.json';

// Recursos de traducción
const resources = {
    en: {
        translation: translationEN,
    },
    es: {
        translation: translationES,
    },
};

i18n
    // Detecta el idioma del navegador
    .use(LanguageDetector)
    // Pasa la instancia i18n a react-i18next
    .use(initReactI18next)
    // Inicializa i18next
    .init({
        resources,
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

export default i18n;

