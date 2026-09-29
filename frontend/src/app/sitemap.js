import { CATEGORIES, CITIES, SITE_URL, localPath } from '@/lib/constants';

export default function sitemap() {
  const now = new Date();
  const staticPages = ['', '/freelancers', '/cities', '/waitlist', '/privacy', '/terms'].map((p) => ({
    url: `${SITE_URL}${p}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: p === '' ? 1 : 0.6,
  }));
  const local = CITIES.flatMap((c) =>
    CATEGORIES.map((cat) => ({
      url: `${SITE_URL}${localPath(cat.slug, c.slug)}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    })),
  );
  return [...staticPages, ...local];
}
