import InboxShell from '@/components/chat/InboxShell';

export const metadata = { title: 'Chat', robots: { index: false } };

export default async function ChatPage({ params }) {
  const { id } = await params;
  return <InboxShell activeId={id} />;
}
