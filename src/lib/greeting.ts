import { activeLines, getChatSettings, type LineContext } from "./chat-settings";
import { getSetting } from "./db";
import { HEADSHOT_URL, type SiteId } from "./sites";
import { lookForWidget } from "./widget-look";

/** The hub's town pages, /communities/<slug>, that get the town line. */
const TOWNS = new Set([
  "armonk",
  "bedford",
  "bedford-hills",
  "chappaqua",
  "greenwich",
  "katonah",
  "larchmont",
  "mount-kisco",
  "new-canaan",
  "north-salem",
  "pound-ridge",
  "ridgefield",
  "scarsdale",
  "south-salem",
]);

function townName(slug: string): string {
  return slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

/** The town a chat started in, from a /communities/<slug> page address. */
export function townFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const slug = /^\/communities\/([a-z-]+)\/?$/.exec(new URL(url).pathname.toLowerCase())?.[1];
    return slug && TOWNS.has(slug) ? townName(slug) : null;
  } catch {
    return null;
  }
}

/** Which set of lines a page gets, and the town's name on a town page. */
function contextOf(site: SiteId, path: string, online: boolean): { context: LineContext; town: string | null } {
  if (!online) return { context: "away", town: null };
  if (site === "horse") return { context: "horse", town: null };
  const slug = /^\/communities\/([a-z-]+)\/?$/.exec(path)?.[1];
  if (slug && TOWNS.has(slug)) return { context: "town", town: townName(slug) };
  return { context: "general", town: null };
}

/** What the widget on a site's page needs: whether to show the button, how it looks, and the greeting. */
export async function widgetConfig(site: SiteId, rawPath: string) {
  const [settings, online] = await Promise.all([getChatSettings(), getSetting<boolean>("agent_online", true)]);
  const launcher = settings.launcher[site] !== false;
  const path = rawPath.slice(0, 200).toLowerCase();
  const g = settings.greeting;
  const { context, town } = contextOf(site, path, online);
  let lines = activeLines(g, context);
  // A town page with every town line off gets the lines for other pages.
  if (!lines.length && context === "town") lines = activeLines(g, "general");
  const shown = lines.map((l) => ({ id: l.id, text: town ? l.text.replaceAll("{town}", town) : l.text }));
  const look = lookForWidget(settings.look);
  return {
    launcher,
    look,
    greeting:
      launcher && g.enabled && shown.length
        ? {
            delay: g.delay,
            online,
            name: "Michael Winter",
            // For copies of widget.js from before lines rotated: one line, and a photo.
            photo: look.card.photoUrl ?? HEADSHOT_URL,
            text: shown[Math.floor(Math.random() * shown.length)].text,
            lines: shown,
            ripple: g.ripple,
            typing: g.typing,
            stay: g.stay,
          }
        : null,
  };
}
