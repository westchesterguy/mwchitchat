import { db } from "@/lib/db";
import { jsonError, UUID } from "@/lib/guard";

/**
 * A photo or PDF from a chat. The id is random and only ever shown to the
 * two people in that chat, so knowing it is what lets a browser load it.
 * Types were checked from the file's own bytes on upload, never trusted
 * from the sender, so nothing here can run as a page.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return jsonError(404, "not_found");
  const [file] = await db()`select name, type, data from attachments where id = ${id}`;
  if (!file) return jsonError(404, "not_found");
  const data = file.data as Buffer;
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": file.type as string,
      "content-length": String(data.length),
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name as string)}`,
      "cache-control": "private, max-age=31536000, immutable",
      "cross-origin-resource-policy": "same-origin",
    },
  });
}
