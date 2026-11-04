import { adminGuard } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { allFields, FIELD_TYPES, type FieldType } from "@/lib/fields";
import { jsonError } from "@/lib/guard";
import { readJson } from "@/lib/request";
import { sites } from "@/lib/sites";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await adminGuard(req);
  if (denied) return denied;
  return Response.json({ fields: await allFields() }, { headers: { "cache-control": "no-store" } });
}

const KEY = /^[a-z][a-z0-9_]{0,39}$/;

interface FieldInput {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string[];
  sites: string[];
  active: boolean;
}

function parseField(raw: unknown): FieldInput | string {
  if (!raw || typeof raw !== "object") return "Every question needs details.";
  const f = raw as Record<string, unknown>;
  const label = typeof f.label === "string" ? f.label.trim() : "";
  const key = typeof f.key === "string" ? f.key.trim() : "";
  if (!label || label.length > 600) return "Every question needs a label (600 characters at most).";
  if (!KEY.test(key)) return `"${label}" has an invalid key.`;
  if (!FIELD_TYPES.includes(f.type as FieldType)) return `"${label}" has an unknown type.`;
  const options = Array.isArray(f.options)
    ? f.options.filter((o): o is string => typeof o === "string").map((o) => o.trim()).filter(Boolean)
    : [];
  if (f.type === "select" && (options.length === 0 || options.length > 20)) {
    return `"${label}" needs between 1 and 20 choices.`;
  }
  if (options.some((o) => o.length > 100)) return `A choice in "${label}" is too long.`;
  const siteIds = Array.isArray(f.sites) ? f.sites.filter((s): s is string => typeof s === "string" && s in sites) : [];
  if (siteIds.length === 0) return `"${label}" must be shown on at least one site.`;
  return {
    key,
    label,
    type: f.type as FieldType,
    required: f.required === true,
    options: f.type === "select" ? options : [],
    sites: siteIds,
    active: f.active !== false,
  };
}

/** Saves the whole questionnaire, in the order given. */
export async function PUT(req: Request) {
  const denied = await adminGuard(req);
  if (denied) return denied;

  const list = (await readJson(req))?.fields;
  if (!Array.isArray(list) || list.length > 30) return jsonError(400, "bad_request");

  const fields: FieldInput[] = [];
  for (const raw of list) {
    const parsed = parseField(raw);
    if (typeof parsed === "string") return Response.json({ error: "invalid", message: parsed }, { status: 400 });
    if (fields.some((f) => f.key === parsed.key)) {
      return Response.json({ error: "invalid", message: `Two questions share the key "${parsed.key}".` }, { status: 400 });
    }
    fields.push(parsed);
  }

  await db().begin(async (tx) => {
    const keys = fields.map((f) => f.key);
    await tx`delete from prechat_fields where not (key = any(${keys}::text[]))`;
    for (const [i, f] of fields.entries()) {
      await tx`
        insert into prechat_fields (position, key, label, type, required, options, sites, active)
        values (${(i + 1) * 10}, ${f.key}, ${f.label}, ${f.type}, ${f.required}::boolean,
                ${tx.json(f.options)}, ${f.sites}::text[], ${f.active}::boolean)
        on conflict (key) do update set
          position = excluded.position, label = excluded.label, type = excluded.type,
          required = excluded.required, options = excluded.options,
          sites = excluded.sites, active = excluded.active`;
    }
  });

  return Response.json({ fields: await allFields() });
}
