import { ConversationView } from "@/components/admin/ConversationView";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConversationView id={id} />;
}
