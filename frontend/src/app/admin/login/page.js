import { Suspense } from 'react';
import { AdminLoginForm } from '@/components/AuthForms';
import { Loading } from '@/components/common';

export const metadata = { title: 'Admin login', robots: { index: false } };

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AdminLoginForm />
    </Suspense>
  );
}
