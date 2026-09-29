import { redirect } from 'next/navigation';

export const metadata = { title: 'Account banao', robots: { index: false } };

/** PDF §2: signup and login are the same OTP flow, so /register points there
 *  with the signup framing (and keeps ?role= / ?next=). */
export default async function RegisterPage({ searchParams }) {
  const sp = await searchParams;
  const qs = new URLSearchParams(
    Object.entries(sp || {}).filter(([, v]) => typeof v === 'string'),
  );
  if (!qs.has('role')) qs.set('intent', 'signup');
  redirect(`/login?${qs.toString()}`);
}
