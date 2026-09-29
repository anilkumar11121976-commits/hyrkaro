import { Suspense } from 'react';
import ProfileView from './ProfileView';
import { serverGet } from '@/lib/api';
import { catName, cityName } from '@/lib/constants';
import { Loading } from '@/components/common';

async function load(id) {
  return serverGet(`/freelancers/${encodeURIComponent(id)}`, { revalidate: 120 });
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const data = await load(id);
  const p = data?.profile;
  if (!p) return { title: 'Freelancer', robots: { index: false } };
  const title = `${p.user?.name} – ${p.title || catName(p.category)} in ${cityName(p.city)}`;
  return {
    title,
    description: (p.bio || '').slice(0, 155),
    alternates: { canonical: `/freelancers/${p._id}` },
    openGraph: { title, images: p.user?.avatar?.url ? [p.user.avatar.url] : undefined },
  };
}

export default async function FreelancerPage({ params }) {
  const { id } = await params;
  const data = await load(id);
  return (
    <Suspense fallback={<Loading />}>
      <ProfileView id={id} initial={data?.profile ? data : null} />
    </Suspense>
  );
}
