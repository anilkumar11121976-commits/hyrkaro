import HomeView from '@/components/home/HomeView';
import { serverGet } from '@/lib/api';

export const revalidate = 300;

export default async function HomePage() {
  const data = await serverGet('/freelancers?sort=rating&limit=8', { revalidate: 300 });
  return <HomeView top={data?.items || []} />;
}
