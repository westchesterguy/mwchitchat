import { db } from "./db";

export const FIELD_TYPES = ["text", "email", "tel", "textarea", "select", "checkbox"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export interface PrechatField {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string[];
  sites: string[];
  position: number;
  active: boolean;
}

export interface Answer {
  key: string;
  label: string;
  value: string;
}

function toField(row: Record<string, unknown>): PrechatField {
  return {
    id: row.id as string,
    key: row.key as string,
    label: row.label as string,
    type: row.type as FieldType,
    required: Boolean(row.required),
    options: Array.isArray(row.options) ? (row.options as string[]) : [],
    sites: (row.sites as string[]) ?? [],
    position: Number(row.position),
    active: Boolean(row.active),
  };
}

export async function allFields(): Promise<PrechatField[]> {
  const rows = await db()`select * from prechat_fields order by position, created_at`;
  return rows.map(toField);
}

/** The questionnaire a visitor on this site sees. */
export async function fieldsForSite(site: string): Promise<PrechatField[]> {
  const rows = await db()`
    select * from prechat_fields
    where active and ${site} = any(sites)
    order by position, created_at`;
  return rows.map(toField);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[+()\-.\s\d]{7,25}$/;

/**
 * Checks a visitor's answers against the questionnaire and returns them in
 * the questionnaire's order, labelled as the visitor saw them.
 */
export function validateAnswers(
  fields: PrechatField[],
  raw: unknown,
): { ok: true; answers: Answer[] } | { ok: false; field: string; error: string } {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const answers: Answer[] = [];

  for (const f of fields) {
    const value = input[f.key];

    if (f.type === "checkbox") {
      const checked = value === true;
      if (f.required && !checked) return { ok: false, field: f.key, error: "Please check this box." };
      answers.push({ key: f.key, label: f.label, value: checked ? "Yes" : "No" });
      continue;
    }

    const text = typeof value === "string" ? value.trim() : "";
    if (!text) {
      if (f.required) return { ok: false, field: f.key, error: "This field is required." };
      continue;
    }
    const max = f.type === "textarea" ? 2_000 : 200;
    if (text.length > max) return { ok: false, field: f.key, error: "That is too long." };
    if (f.type === "email" && !EMAIL.test(text)) {
      return { ok: false, field: f.key, error: "Please enter a valid email." };
    }
    if (f.type === "tel" && !PHONE.test(text)) {
      return { ok: false, field: f.key, error: "Please enter a valid phone number." };
    }
    if (f.type === "select" && !f.options.includes(text)) {
      return { ok: false, field: f.key, error: "Please choose one of the options." };
    }
    answers.push({ key: f.key, label: f.label, value: text });
  }
  return { ok: true, answers };
}

/** The answer to a well-known question (name, email, phone), if asked. */
export function answerOf(answers: Answer[], key: string): string | null {
  return answers.find((a) => a.key === key)?.value ?? null;
}
