import RequirementDetail from '@/components/requirements/RequirementDetail';

export const metadata = { title: 'Requirement', robots: { index: false } };

export default async function RequirementPage({ params }) {
  const { id } = await params;
  return <RequirementDetail id={id} />;
}
