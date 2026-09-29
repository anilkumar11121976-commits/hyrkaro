import { Suspense } from 'react';
import SearchView from './SearchView';
import { Loading } from '@/components/common';

export const metadata = {
  title: 'Freelancers dhoondo',
  description: 'Apne shehar ke verified freelancers dhoondo – category, charges aur rating ke hisaab se.',
};

export default function FreelancersPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SearchView />
    </Suspense>
  );
}
