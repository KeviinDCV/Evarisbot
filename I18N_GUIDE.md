# Internacionalización (i18n) con i18next

## 📋 Resumen

Se ha implementado **i18next** con **react-i18next** para proporcionar soporte de internacionalización en la aplicación. Los idiomas disponibles son:

- 🇪🇸 **Español** (idioma por defecto)
- 🇺🇸 **Inglés**

## 🎯 Características Implementadas

1. **Configuración de i18n** con detección automática de idioma del navegador
2. **Selector de idioma** en el header de la aplicación
3. **Traducción de páginas principales** (Login, menú de usuario, etc.)
4. **Persistencia del idioma** en localStorage
5. **Type-safety** con TypeScript

## 📂 Estructura de Archivos

```
resources/js/
├── i18n.ts                          # Configuración principal de i18next
├── i18n.d.ts                        # Tipos de TypeScript para i18n
├── locales/
│   ├── es/
│   │   └── translation.json         # Traducciones en español
│   └── en/
│       └── translation.json         # Traducciones en inglés
└── components/
    └── language-selector.tsx        # Componente selector de idioma
```

## 🚀 Cómo Usar

### 1. Usar traducciones en un componente

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
    const { t } = useTranslation();
    
    return (
        <div>
            <h1>{t('common.dashboard')}</h1>
            <p>{t('auth.loginTitle')}</p>
        </div>
    );
}
```

### 2. Traducciones con variables

```tsx
const { t } = useTranslation();

// En el archivo de traducción:
// "welcome": "Bienvenido, {{name}}"

<h1>{t('welcome', { name: user.name })}</h1>
```

### 3. Traducciones con pluralización

```tsx
// En el archivo de traducción:
// "items": "{{count}} item",
// "items_plural": "{{count}} items"

<p>{t('items', { count: 5 })}</p>
```

### 4. Cambiar idioma programáticamente

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
    const { i18n } = useTranslation();
    
    const changeToEnglish = () => {
        i18n.changeLanguage('en');
    };
    
    return <button onClick={changeToEnglish}>Change to English</button>;
}
```

## 📝 Agregar Nuevas Traducciones

### 1. Editar los archivos JSON

Edita `resources/js/locales/es/translation.json` y `resources/js/locales/en/translation.json`:

```json
{
  "myNewSection": {
    "title": "Mi Título",
    "description": "Mi Descripción"
  }
}
```

### 2. Usar en el componente

```tsx
const { t } = useTranslation();

<h1>{t('myNewSection.title')}</h1>
<p>{t('myNewSection.description')}</p>
```

## 🎨 Selector de Idioma

El selector de idioma está disponible en el header de la aplicación. Puedes acceder a él haciendo clic en el ícono de idioma (🌐).

### Ubicación del componente

El componente `LanguageSelector` se encuentra en:
- `resources/js/components/language-selector.tsx`

Está integrado en:
- `resources/js/components/app-header.tsx`

## 📚 Estructura de Traducciones

Las traducciones están organizadas por secciones:

- **common**: Textos comunes (botones, acciones, etc.)
- **auth**: Autenticación (login, registro, etc.)
- **conversations**: Conversaciones de WhatsApp
- **templates**: Plantillas de mensajes
- **users**: Gestión de usuarios
- **settings**: Configuración
- **admin**: Administración
- **errors**: Mensajes de error
- **success**: Mensajes de éxito
- **navigation**: Navegación

## 🔧 Configuración Avanzada

### Cambiar el idioma por defecto

Edita `resources/js/i18n.ts`:

```typescript
i18n.init({
    // ...
    fallbackLng: 'en', // Cambiar de 'es' a 'en'
    lng: 'en',         // Cambiar de 'es' a 'en'
    // ...
});
```

### Agregar un nuevo idioma

1. Crea un nuevo archivo: `resources/js/locales/fr/translation.json`
2. Copia el contenido de `es/translation.json` y traduce
3. Importa en `resources/js/i18n.ts`:

```typescript
import translationFR from './locales/fr/translation.json';

const resources = {
    en: { translation: translationEN },
    es: { translation: translationES },
    fr: { translation: translationFR }, // Nuevo idioma
};
```

4. Agrega al selector de idioma en `language-selector.tsx`:

```typescript
const languages = [
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' }, // Nuevo
];
```

## 🧪 Mejores Prácticas

1. **Usa nombres descriptivos** para las claves de traducción
2. **Organiza por módulos** (auth, users, etc.)
3. **Mantén sincronizados** ambos archivos de idioma
4. **Usa interpolación** para valores dinámicos
5. **Type-safety**: Aprovecha los tipos de TypeScript

## 🐛 Solución de Problemas

### Las traducciones no aparecen

1. Verifica que el archivo JSON esté bien formado
2. Asegúrate de que la clave existe en ambos idiomas
3. Revisa que el componente esté usando `useTranslation()`

### El idioma no persiste

El idioma se guarda en `localStorage`. Si no persiste, verifica:
- La configuración en `i18n.ts`
- Que el navegador permita localStorage

### Errores de TypeScript

Si obtienes errores de tipo, ejecuta:
```bash
npm run types
```

## 📖 Recursos Adicionales

- [Documentación oficial de i18next](https://www.i18next.com/)
- [react-i18next](https://react.i18next.com/)
- [i18next Browser Language Detector](https://github.com/i18next/i18next-browser-languageDetector)

## ✅ Estado Actual

### Páginas/Componentes Traducidos
- ✅ Login
- ✅ Header
- ✅ User Menu
- ✅ Language Selector

### Pendientes de Traducción
- ⏳ Conversaciones
- ⏳ Plantillas
- ⏳ Usuarios
- ⏳ Configuración
- ⏳ Dashboard

Para traducir más páginas, simplemente:
1. Importa `useTranslation`
2. Usa `t('clave.de.traduccion')`
3. Asegúrate de que las traducciones existan en ambos archivos JSON
