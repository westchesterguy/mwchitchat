import { contact, sites, type SiteId } from "../sites";
import type { AiSettings } from "./settings";

/** What the assistant is told about the chat it is answering. */
export interface ChatContext {
  site: SiteId;
  page: { url: string | null; title: string | null };
  visitor: { name: string | null; email: string | null; phone: string | null };
  answers: { label: string; value: string }[];
  online: boolean;
}

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

/**
 * The part of the instructions that is the same for every chat, so the
 * services can cache it: who it is, the rules, Michael's voice, the context.
 */
export function stableInstructions(s: AiSettings, draft = false): string {
  const handoff = s.handoff
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `- ${l}`)
    .join("\n");
  const domains = Object.values(sites)
    .map((x) => x.domain)
    .join(" and ");
  const parts = [
    draft
      ? `You draft chat replies for Michael Winter, a real estate agent known as The Westchester Guy, to visitors of his websites, ${domains}. Write his next message in the first person, as Michael. He reviews and edits every draft and sends it himself.`
      : `You are ${s.name}, the website assistant for Michael Winter, a real estate agent known as The Westchester Guy. You answer visitors who start a chat on his websites, ${domains}. Michael reads every chat and follows up personally.`,
    `## Rules you always follow
${draft ? "" : "- You are an AI assistant, not Michael and not a person. Say so plainly if asked, and never sign as Michael.\n"}- Only state facts that are in the Context below or in this chat. Never invent or estimate prices, home values, taxes, square footage, acreage, school ratings, market statistics, dates or listing details. If you don't have it, say Michael will follow up with the specifics.
- Fair housing: never describe, compare or recommend areas by the race, color, religion, national origin, sex, disability or family status of the people who live there. Don't call areas "safe", "good for families" or similar, and don't rank schools; offer objective sources or Michael's follow-up instead.
- Don't give legal, tax, mortgage or financing advice.
- Don't promise availability, showings, prices or terms; Michael confirms those.
- Never recommend or vouch for another business.
- Never ask for financial details, ID numbers or passwords.`,
    handoff ? `## Hand these to Michael\nSay he will follow up, and don't answer them yourself:\n${handoff}` : "",
    `## How to reply
- Plain text only: no markdown, headings or bullet lists unless the visitor asks for a list.
- ${s.length === "short" ? "Reply in one to three short sentences." : "Reply in a short paragraph at most."}${
      s.askContact
        ? "\n- If the visitor's name, email or phone number is missing below, ask once, naturally, for what's missing so Michael can follow up."
        : ""
    }${s.matchLanguage ? "\n- Reply in the language the visitor writes in." : ""}`,
    s.instructions ? `## Michael's voice\n${s.instructions}` : "",
    `## Context\n${s.context || "(No context has been added yet. Answer only general questions and hand the rest to Michael.)"}`,
  ];
  return parts.filter(Boolean).join("\n\n");
}

/** The part that changes per chat: the site, the page, the visitor, whether Michael is around. */
export function chatInstructions(s: AiSettings, c: ChatContext): string {
  const site = sites[c.site];
  const details = [
    c.visitor.name && `Name: ${c.visitor.name}`,
    c.visitor.email && `Email: ${c.visitor.email}`,
    c.visitor.phone && `Phone: ${c.visitor.phone}`,
    ...c.answers.filter((a) => !/^(name|email|phone)$/i.test(a.label)).map((a) => `${a.label}: ${a.value}`),
  ].filter(Boolean);
  return [
    `## This chat
- Site: ${site?.domain ?? c.site}
- Page they started on: ${[c.page.title, c.page.url].filter(Boolean).join(", ") || "unknown"}
- Michael is ${c.online ? "online and may join the chat" : "away right now and will follow up later"}.
- Michael's phone number, if they would rather call: ${contact.phoneDisplay}`,
    `## The visitor\n${details.length ? details.join("\n") : "No details given yet."}`,
    s.siteContext[c.site] ? `## About ${site?.domain ?? c.site}\n${s.siteContext[c.site]}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** The chat as the services expect it: visitor turns and Michael's (or the assistant's) turns. */
export function toTurns(
  messages: { sender: string; body: string; ai?: boolean; attachment?: { name: string; type: string } | null }[],
): Turn[] {
  const turns: Turn[] = [];
  for (const m of messages) {
    const file = m.attachment ? `[${m.attachment.type === "application/pdf" ? "A PDF" : "A photo"}: ${m.attachment.name}]` : "";
    if (m.sender === "visitor") {
      turns.push({ role: "user", content: [m.body, file].filter(Boolean).join("\n") || "(empty message)" });
    } else if (m.sender === "agent") {
      turns.push({ role: "assistant", content: [m.body, file].filter(Boolean).join("\n") || "(attachment)" });
    } else if (m.sender === "system") {
      turns.push({ role: "assistant", content: `[Automatic note shown to the visitor: ${m.body}]` });
    }
  }
  // The services want the chat to open with the visitor.
  while (turns.length && turns[0].role !== "user") turns.shift();
  return turns;
}

/** Michael's house style, enforced after the fact as well as asked for. */
export function tidy(text: string): string {
  return text
    .replace(/\s*—\s*/g, ", ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 2000);
}
