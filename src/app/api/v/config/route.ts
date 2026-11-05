import { getChatSettings } from "@/lib/chat-settings";
import { getSetting } from "@/lib/db";
import { fieldsForSite } from "@/lib/fields";
import { jsonError } from "@/lib/guard";
import { contact, getSite } from "@/lib/sites";

export const dynamic = "force-dynamic";

/** What the chat window needs before the visitor types: questions and status. */
export async function GET(req: Request) {
  const site = getSite(new URL(req.url).searchParams.get("site"));
  if (!site) return jsonError(400, "bad_site");

  const [online, fields, settings] = await Promise.all([
    getSetting<boolean>("agent_online", true),
    fieldsForSite(site.id),
    getChatSettings(),
  ]);

  return Response.json(
    {
      online,
      attachments: settings.visitorAttachments,
      phone: contact.phoneDisplay,
      phoneHref: `tel:${contact.phone}`,
      fields: fields.map(({ key, label, type, required, options }) => ({
        key,
        label,
        type,
        required,
        options,
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
