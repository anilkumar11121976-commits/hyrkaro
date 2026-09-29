'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RequireAuth, Loading } from '@/components/common';
import { useAuth } from '@/context/AuthContext';
import FreelancerDashboard from '@/components/dashboard/FreelancerDashboard';
import ClientDashboard from '@/components/dashboard/ClientDashboard';

function Inner() {
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (user?.role === 'admin') router.replace('/admin');
  }, [user, router]);
  if (user.role === 'freelancer') return <FreelancerDashboard />;
  if (user.role === 'client') return <ClientDashboard />;
  return <Loading />;
}

export default function DashboardView() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}
