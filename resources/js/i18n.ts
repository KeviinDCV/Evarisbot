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
        fallbackLng: 'es', // Idioma por defecto es español
        debug: true, // Activar debug temporalmente para ver logs

        interpolation: {
            escapeValue: false, // React ya escapa por defecto
        },

        detection: {
            // Orden de detección de idioma
            order: ['localStorage', 'navigator'],
            // Caché del idioma en localStorage
            caches: ['localStorage'],
            lookupLocalStorage: 'i18nextLng',
        },
    });

export default i18n;
