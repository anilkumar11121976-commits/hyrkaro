import { Suspense } from 'react';
import RequirementsView from './RequirementsView';
import { Loading } from '@/components/common';

export const metadata = {
  title: 'Requirements',
  description: 'Clients post the work they need; verified freelancers send their interest.',
};

export default function RequirementsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <RequirementsView />
    </Suspense>
  );
}
