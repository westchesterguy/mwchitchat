/**
 * The lines the greeting beside the chat button can say. Pure data and
 * helpers, so the developer page's preview can use them too.
 */

/** Where a greeting line is shown. */
export type LineContext = "general" | "town" | "horse" | "away";
export const LINE_CONTEXTS: LineContext[] = ["general", "town", "horse", "away"];

export interface GreetingLine {
  id: string;
  context: LineContext;
  /** On town pages, {town} is replaced with the town's name. */
  text: string;
}

export interface CustomLine extends GreetingLine {
  on: boolean;
}

/**
 * The greeting lines that come with the chat. Each can be switched off on
 * the developer page; their wording is changed here, and ids never reused,
 * so a visitor's record of lines already seen stays right.
 */
export const BUILT_IN_LINES: GreetingLine[] = [
  { id: "g1", context: "general", text: "Have a question about a house or a town? I'm here." },
  { id: "g2", context: "general", text: "Thinking about buying or selling? Send me a question." },
  { id: "g3", context: "general", text: "Curious about a listing or a neighborhood? Ask me directly." },
  { id: "g4", context: "general", text: "If something on this page raises a question, send it my way." },
  { id: "g5", context: "general", text: "Want a second opinion on a house you've seen? Ask me." },
  { id: "t1", context: "town", text: "Looking at {town}? Ask me anything about the town or a house." },
  { id: "t2", context: "town", text: "Curious what living in {town} is like day to day? Ask me." },
  { id: "t3", context: "town", text: "Have a question about a house in {town}? Send it my way." },
  { id: "t4", context: "town", text: "Weighing {town} against a nearby town? I can help you compare." },
  { id: "h1", context: "horse", text: "Questions about a farm, barn or acreage? Ask me here." },
  { id: "h2", context: "horse", text: "Looking for room for horses? Ask me about a property." },
  { id: "h3", context: "horse", text: "Curious about a property's barn, paddocks or trails? Send me a question." },
  { id: "h4", context: "horse", text: "Buying or selling a horse property? Let's talk it through." },
  { id: "a1", context: "away", text: "Leave me a message and I'll follow up." },
  { id: "a2", context: "away", text: "I'm away from my desk. Leave a message and I'll get back to you." },
  { id: "a3", context: "away", text: "Send me your question and I'll reply as soon as I'm back." },
  { id: "a4", context: "away", text: "Not here right now, but leave a note and I'll be in touch." },
];

/** Before lines could be switched on and off, there was one per context; these were its defaults. */
export const FIRST_LINES: Record<LineContext, { id: string; text: string }> = {
  general: { id: "g1", text: "Have a question about a house or a town? I'm here." },
  town: { id: "t1", text: "Looking at {town}? Ask me anything about the town or a house." },
  horse: { id: "h1", text: "Questions about a farm, barn or acreage? Ask me here." },
  away: { id: "a1", text: "Leave me a message and I'll follow up." },
};

export const LINE_MAX = 140;
export const CUSTOM_MAX = 40;

/** The lines that show in a context: built-in ones not switched off, then Michael's own that are on. */
export function activeLines(g: { off: string[]; custom: CustomLine[] }, context: LineContext): GreetingLine[] {
  const off = new Set(g.off);
  return [
    ...BUILT_IN_LINES.filter((l) => l.context === context && !off.has(l.id)),
    ...g.custom.filter((l) => l.context === context && l.on).map(({ id, context, text }) => ({ id, context, text })),
  ];
}
