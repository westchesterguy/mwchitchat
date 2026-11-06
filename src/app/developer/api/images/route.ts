import { db } from "@/lib/db";
import { devGuard } from "@/lib/dev-auth";
import { jsonError } from "@/lib/guard";
import { imageUrl } from "@/lib/widget-look";

export const dynamic = "force-dynamic";

/** The developer page shrinks an image before sending it; this is a generous ceiling. */
const MAX = 512 * 1024;

function sniff(b: Buffer): string | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

/** Stores an image for the chat button or the greeting; it is used once the settings are saved. */
export async function POST(req: Request) {
  const denied = await devGuard(req);
  if (denied) return denied;
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX) return Response.json({ error: "too_large", message: "Images can be up to 512 KB." }, { status: 413 });
  const data = Buffer.from(await req.arrayBuffer());
  if (data.length > MAX) return Response.json({ error: "too_large", message: "Images can be up to 512 KB." }, { status: 413 });
  const type = sniff(data);
  if (!type) return jsonError(415, "unsupported");
  const [row] = await db()`insert into widget_images (type, data) values (${type}, ${data}) returning id`;
  return Response.json({ id: row.id, url: imageUrl(row.id as string) });
}
