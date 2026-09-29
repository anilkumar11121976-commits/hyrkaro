import { cookies } from 'next/headers';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import '@fontsource/hind/400.css';
import '@fontsource/hind/500.css';
import '@fontsource/hind/600.css';
import '@fontsource-variable/bricolage-grotesque';
import './globals.css';
import Providers from './providers';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { SITE_URL } from '@/lib/constants';
import { LANG_COOKIE, htmlLangFor, normalizeLang, translate } from '@/i18n';

/** The cookie the switcher writes; read here so the first paint is right. */
export async function getLang() {
  const store = await cookies();
  return normalizeLang(store.get(LANG_COOKIE)?.value);
}

export async function generateMetadata() {
  const lang = await getLang();
  const t = (k, v) => translate(lang, k, v);
  const tagline = t('footer.tagline');
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `HyrKro – ${tagline}`, template: '%s | HyrKro' },
    description: t('home.heroSub'),
    applicationName: 'HyrKro',
    keywords: ['freelancer', 'hire freelancer', 'freelancer India', 'Noida freelancer', 'web developer', 'graphic designer', 'HyrKro'],
    openGraph: {
      type: 'website',
      siteName: 'HyrKro',
      title: `HyrKro – ${tagline}`,
      description: t('footer.taglineSub'),
      images: [{ url: '/og-image.png', width: 1080, height: 1080 }],
      locale: lang === 'hi' ? 'hi_IN' : 'en_IN',
    },
    twitter: { card: 'summary', site: '@hyrkroindia' },
  };
}

export const viewport = { themeColor: '#FFFFFF', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }) {
  const lang = await getLang();
  return (
    <html lang={htmlLangFor(lang)}>
      <body>
        <AppRouterCacheProvider options={{ key: 'css' }}>
          <Providers lang={lang}>
            <div className="app-shell">
              <Header />
              <main className="app-main">{children}</main>
              <Footer />
            </div>
          </Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
