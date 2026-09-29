import { notFound } from 'next/navigation';
import LocalView from './LocalView';
import { serverGet } from '@/lib/api';
import { catBySlug, cityBySlug, localPath, SITE_URL } from '@/lib/constants';

export const revalidate = 600;

function faqsFor(cat, city) {
  return [
    {
      q: `${city.name} mein ${cat.role} hire karne ka kharcha kitna hai?`,
      a: `HyrKro pe har ${cat.role.toLowerCase()} apne charges khud rakhta hai. Profiles pe per ghanta, per din ya per project rate dikhta hai. Client se HyrKro koi fee nahi leta.`,
    },
    {
      q: 'Payment safe kaise hai?',
      a: 'Aap jo payment karte ho wo HyrKro ke paas safe rehta hai. Kaam approve karne ke baad hi freelancer ko release hota hai. Bade kaam ko 2–3 milestones mein baant sakte ho.',
    },
    {
      q: 'Kya hire karne se pehle baat kar sakte hain?',
      a: 'Haan. HyrKro pe pehle chat hoti hai – kaam samjhao, offer bhejo, negotiate karo, video meeting karo. Rate tay hone ke baad chat se hi hire karo.',
    },
    {
      q: `Kya ${city.name} ke freelancer se mil bhi sakte hain?`,
      a: `HyrKro city-first hai, isliye freelancers aapke shehar ke hote hain. Zarurat ho to mil sakte ho, lekin deal aur payment sirf HyrKro pe karo – bahar ki deal ke liye HyrKro zimmedar nahi.`,
    },
  ];
}

export async function generateMetadata({ params }) {
  const { category, city } = await params;
  const cat = catBySlug(category);
  const c = cityBySlug(city);
  if (!cat || !c) return {};
  const title = `Best ${cat.role}s in ${c.name} | Hire Verified Freelancers`;
  const description = `${c.name} ke verified ${cat.role.toLowerCase()}s ko HyrKro pe hire karo. Unke charges dekho, chat karo, safe payment. Client fee ₹0.`;
  return {
    title: { absolute: `${title} | HyrKro` },
    description,
    alternates: { canonical: localPath(cat.slug, c.slug) },
    openGraph: { title, description, url: `${SITE_URL}${localPath(cat.slug, c.slug)}` },
  };
}

export default async function LocalPage({ params }) {
  const { category, city } = await params;
  const cat = catBySlug(category);
  const c = cityBySlug(city);
  if (!cat || !c) notFound();

  const [list, st] = await Promise.all([
    serverGet(`/freelancers?category=${cat.slug}&city=${c.slug}&sort=rating&limit=12`, { revalidate: 600 }),
    serverGet(`/freelancers/stats?category=${cat.slug}&city=${c.slug}`, { revalidate: 600 }),
  ]);
  const faqs = faqsFor(cat, c);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: `${cat.name} in ${c.name}`, item: `${SITE_URL}${localPath(cat.slug, c.slug)}` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LocalView cat={cat} city={c} items={list?.items || []} stats={st?.stats} faqs={faqs} />
    </>
  );
}
