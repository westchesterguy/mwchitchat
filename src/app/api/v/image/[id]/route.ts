import { db } from "@/lib/db";
import { jsonError, UUID } from "@/lib/guard";

/**
 * A logo or photo uploaded for the chat button or the greeting. Public, since
 * every visitor's browser loads it on the sites. Its type was checked from
 * its own bytes on upload, and an id is never reused, so it can be cached for good.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return jsonError(404, "not_found");
  const [img] = await db()`select type, data from widget_images where id = ${id}`;
  if (!img) return jsonError(404, "not_found");
  const data = img.data as Buffer;
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": img.type as string,
      "content-length": String(data.length),
      "cache-control": "public, max-age=31536000, immutable",
      "cross-origin-resource-policy": "cross-origin",
      "content-security-policy": "default-src 'none'",
    },
  });
}
