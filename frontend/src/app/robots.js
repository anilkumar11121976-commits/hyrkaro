import { SITE_URL } from '@/lib/constants';

export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/inbox', '/orders', '/dashboard', '/settings', '/admin'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
