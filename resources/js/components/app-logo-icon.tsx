import { ImgHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';

export default function AppLogoIcon(props: ImgHTMLAttributes<HTMLImageElement>) {
    const { t } = useTranslation();

    return (
        <img
            {...props}
            src="/images/logo.png"
            alt={t('common.institutionalLogoAlt')}
        />
    );
}
