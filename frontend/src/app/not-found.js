'use client';
import Link from 'next/link';
import { useI18n } from '@/i18n/I18nProvider';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
      <img src="/mascot.svg" alt="" width={140} height={140} />
      <h1 style={{ fontFamily: "'Bricolage Grotesque Variable', sans-serif" }}>{t('error.pageNotFound')}</h1>
      <p style={{ color: '#56525F' }}>{t('error.pageNotFoundSub')}</p>
      <Link href="/" style={{ color: '#5B3FC4', fontWeight: 600 }}>
        {t('error.goHome')}
      </Link>
    </div>
  );
}
