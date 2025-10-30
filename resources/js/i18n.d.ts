import 'react-i18next';
import translation from './locales/es/translation.json';

declare module 'react-i18next' {
    interface CustomTypeOptions {
        defaultNS: 'translation';
        resources: {
            translation: typeof translation;
        };
    }
}
