import { notFound } from "next/navigation";
import { ChatWindow } from "@/components/ChatWindow";
import { getSite, legal } from "@/lib/sites";

/** The visitor chat window. widget.js shows it in a frame on the sites. */
export default async function Embed({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const site = getSite((await searchParams).site);
  if (!site) notFound();
  return <ChatWindow site={site.id} privacyUrl={legal.privacy} />;
}
