# 🌍 Guía Rápida de i18n - Ejemplos Prácticos

## Ejemplo 1: Componente Simple

```tsx
import { useTranslation } from 'react-i18next';

function Welcome() {
    const { t } = useTranslation();
    
    return (
        <div>
            <h1>{t('common.dashboard')}</h1>
            <button>{t('common.save')}</button>
        </div>
    );
}
```

## Ejemplo 2: Con Variables (Interpolación)

Archivo de traducción:
```json
{
  "welcome": "Bienvenido, {{name}}",
  "unreadMessages": "Tienes {{count}} mensajes sin leer"
}
```

Uso en componente:
```tsx
const { t } = useTranslation();

<h1>{t('welcome', { name: 'Juan' })}</h1>
// Resultado: "Bienvenido, Juan"

<p>{t('unreadMessages', { count: 5 })}</p>
// Resultado: "Tienes 5 mensajes sin leer"
```

## Ejemplo 3: Pluralización

Archivo de traducción:
```json
{
  "message": "{{count}} mensaje",
  "message_plural": "{{count}} mensajes"
}
```

Uso:
```tsx
<p>{t('message', { count: 1 })}</p>  // "1 mensaje"
<p>{t('message', { count: 5 })}</p>  // "5 mensajes"
```

## Ejemplo 4: Traducir Formularios

```tsx
import { useTranslation } from 'react-i18next';

function LoginForm() {
    const { t } = useTranslation();
    
    return (
        <form>
            <label>{t('auth.username')}</label>
            <input 
                type="email" 
                placeholder={t('auth.emailPlaceholder')} 
            />
            
            <label>{t('common.password')}</label>
            <input 
                type="password" 
                placeholder={t('auth.passwordPlaceholder')} 
            />
            
            <button type="submit">
                {t('auth.login')}
            </button>
        </form>
    );
}
```

## Ejemplo 5: Traducir Listas Dinámicas

```tsx
function UserList({ users }) {
    const { t } = useTranslation();
    
    return (
        <div>
            <h2>{t('users.title')}</h2>
            {users.length === 0 ? (
                <p>{t('users.noUsers')}</p>
            ) : (
                <ul>
                    {users.map(user => (
                        <li key={user.id}>
                            {user.name} - {t(`users.roles.${user.role}`)}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
```

## Ejemplo 6: Mensajes de Estado

```tsx
function ConversationStatus({ status }) {
    const { t } = useTranslation();
    
    const getStatusLabel = (status: string) => {
        return t(`conversations.conversationStatus.${status}`);
    };
    
    return (
        <span className="status-badge">
            {getStatusLabel(status)}
        </span>
    );
}
```

## Ejemplo 7: Fechas y Tiempos

```tsx
import { useTranslation } from 'react-i18next';

function MessageTime({ timestamp }) {
    const { t, i18n } = useTranslation();
    
    const formatDate = (date: Date) => {
        return date.toLocaleDateString(i18n.language);
    };
    
    return (
        <time>
            {formatDate(new Date(timestamp))}
        </time>
    );
}
```

## Ejemplo 8: Selector de Idioma Custom

```tsx
import { useTranslation } from 'react-i18next';

function SimpleLanguageSelector() {
    const { i18n } = useTranslation();
    
    return (
        <select 
            value={i18n.language} 
            onChange={(e) => i18n.changeLanguage(e.target.value)}
        >
            <option value="es">Español</option>
            <option value="en">English</option>
        </select>
    );
}
```

## Ejemplo 9: Botones de Acción

```tsx
function ActionButtons() {
    const { t } = useTranslation();
    
    return (
        <div className="action-buttons">
            <button>{t('common.save')}</button>
            <button>{t('common.cancel')}</button>
            <button>{t('common.delete')}</button>
            <button>{t('common.edit')}</button>
        </div>
    );
}
```

## Ejemplo 10: Mensajes de Error y Éxito

```tsx
function FormWithFeedback() {
    const { t } = useTranslation();
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    
    return (
        <div>
            <form onSubmit={handleSubmit}>
                {/* form fields */}
            </form>
            
            {status === 'success' && (
                <div className="alert-success">
                    {t('success.saved')}
                </div>
            )}
            
            {status === 'error' && (
                <div className="alert-error">
                    {t('errors.somethingWentWrong')}
                </div>
            )}
        </div>
    );
}
```

## Ejemplo 11: Navegación con Traducciones

```tsx
function Navigation() {
    const { t } = useTranslation();
    
    const navItems = [
        { href: '/dashboard', label: t('navigation.home') },
        { href: '/conversations', label: t('navigation.conversations') },
        { href: '/templates', label: t('navigation.templates') },
        { href: '/users', label: t('navigation.users') },
        { href: '/settings', label: t('navigation.settings') },
    ];
    
    return (
        <nav>
            {navItems.map(item => (
                <Link key={item.href} href={item.href}>
                    {item.label}
                </Link>
            ))}
        </nav>
    );
}
```

## Ejemplo 12: Modal de Confirmación

```tsx
function DeleteConfirmationModal({ isOpen, onConfirm, onCancel }) {
    const { t } = useTranslation();
    
    return (
        <Dialog open={isOpen}>
            <DialogTitle>
                {t('common.delete')}
            </DialogTitle>
            <DialogContent>
                <p>{t('confirmations.deleteMessage')}</p>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel}>
                    {t('common.cancel')}
                </Button>
                <Button onClick={onConfirm} variant="destructive">
                    {t('common.delete')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
```

## 💡 Tips y Trucos

### 1. Usar constantes para claves

```tsx
const TRANSLATION_KEYS = {
    SAVE: 'common.save',
    CANCEL: 'common.cancel',
    DELETE: 'common.delete',
} as const;

// Uso
<button>{t(TRANSLATION_KEYS.SAVE)}</button>
```

### 2. Función helper para traducciones de estado

```tsx
function useStatusTranslation() {
    const { t } = useTranslation();
    
    return (status: string) => {
        return t(`conversations.conversationStatus.${status}`);
    };
}

// Uso
const translateStatus = useStatusTranslation();
<span>{translateStatus('active')}</span>
```

### 3. Traducir arrays de opciones

```tsx
const { t } = useTranslation();

const themeOptions = [
    { value: 'light', label: t('settings.themes.light') },
    { value: 'dark', label: t('settings.themes.dark') },
    { value: 'system', label: t('settings.themes.system') },
];
```

### 4. Traducir títulos de página con Inertia

```tsx
import { Head } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';

function MyPage() {
    const { t } = useTranslation();
    
    return (
        <>
            <Head title={t('conversations.title')} />
            {/* contenido */}
        </>
    );
}
```

## 🎯 Checklist para Traducir una Página

- [ ] Importar `useTranslation` hook
- [ ] Extraer la función `t`
- [ ] Identificar todos los textos hardcodeados
- [ ] Agregar las traducciones a los archivos JSON (español e inglés)
- [ ] Reemplazar textos con `t('clave')`
- [ ] Probar en ambos idiomas
- [ ] Verificar variables dinámicas
- [ ] Revisar pluralizaciones
- [ ] Actualizar el título de la página con `<Head>`

## 🚀 Patrón Recomendado para Nuevas Páginas

```tsx
import { useTranslation } from 'react-i18next';
import { Head } from '@inertiajs/react';

function NewPage() {
    const { t } = useTranslation();
    
    return (
        <div>
            <Head title={t('newPage.title')} />
            
            <h1>{t('newPage.heading')}</h1>
            <p>{t('newPage.description')}</p>
            
            {/* resto del contenido */}
        </div>
    );
}

export default NewPage;
```

Archivo de traducción:
```json
{
  "newPage": {
    "title": "Nueva Página",
    "heading": "Bienvenido a la Nueva Página",
    "description": "Esta es una descripción"
  }
}
```
