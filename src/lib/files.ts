/**
 * Attachments: what may be sent, and reading one from an upload.
 *
 * The browser shrinks photos before sending (see components/chat/attach.ts),
 * so a photo is usually a few hundred KB. The cap stays under Vercel's 4.5 MB
 * request limit.
 */

export const FILE_MAX = 4 * 1024 * 1024;

export interface Upload {
  name: string;
  type: string;
  data: Buffer;
  width: number | null;
  height: number | null;
}

/** The file's real type from its first bytes; the browser's claim is ignored. */
function sniff(b: Buffer): string | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.subarray(0, 6).toString("latin1") === "GIF87a" || b.subarray(0, 6).toString("latin1") === "GIF89a") return "image/gif";
  if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (b.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  return null;
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function cleanName(raw: string, type: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  const name = base.replace(/[\u0000-\u001f\u007f"]/g, "").trim().slice(0, 120);
  const ext = EXT[type];
  if (!name) return type === "application/pdf" ? "document.pdf" : `photo.${ext}`;
  return name.toLowerCase().endsWith(`.${ext}`) || (ext === "jpg" && /\.jpe?g$/i.test(name)) ? name : `${name}.${ext}`;
}

function dimension(v: FormDataEntryValue | null): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= 20_000 ? n : null;
}

/**
 * A message sent as a form: its text, and a photo or PDF if one is attached.
 * Returns an error to show the sender when the file can't be accepted.
 */
export async function readMessageForm(
  req: Request,
): Promise<{ ok: true; text: string; file: Upload | null } | { ok: false; error: string }> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return { ok: false, error: "The message could not be read." };
  }
  const text = typeof form.get("body") === "string" ? (form.get("body") as string) : "";
  const entry = form.get("file");
  if (!(entry instanceof Blob) || entry.size === 0) return { ok: true, text, file: null };
  if (entry.size > FILE_MAX) return { ok: false, error: "Files can be up to 4 MB." };

  const data = Buffer.from(await entry.arrayBuffer());
  const type = sniff(data);
  if (!type) return { ok: false, error: "You can send photos (JPEG, PNG, GIF, WebP) and PDFs." };
  const photo = type !== "application/pdf";
  return {
    ok: true,
    text,
    file: {
      name: cleanName(entry instanceof File ? entry.name : "", type),
      type,
      data,
      width: photo ? dimension(form.get("width")) : null,
      height: photo ? dimension(form.get("height")) : null,
    },
  };
}

/** How a message with only an attachment reads in a list or notification. */
export function attachmentLabel(type: string | null | undefined): string {
  return type === "application/pdf" ? "PDF" : "Photo";
}
