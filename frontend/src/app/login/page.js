import { Suspense } from 'react';
import { LoginForm } from '@/components/AuthForms';
import { Loading } from '@/components/common';

export const metadata = { title: 'Login / Account banao', robots: { index: false } };

export default function LoginPage() {
  return (
    <Suspense fallback={<Loading />}>
      <LoginForm />
    </Suspense>
  );
}
