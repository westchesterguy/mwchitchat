import { getChatSettings, type ChatSettings } from "./chat-settings";
import { getSetting } from "./db";
import { HEADSHOT_URL, type SiteId } from "./sites";

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

function line(lines: ChatSettings["greeting"]["lines"], site: SiteId, path: string, online: boolean): string {
  if (!online) return lines.away;
  if (site === "horse") return lines.horse;
  const town = /^\/communities\/([a-z-]+)\/?$/.exec(path)?.[1];
  if (town && TOWNS.has(town)) return lines.town.replaceAll("{town}", townName(town));
  return lines.general;
}

/** What the widget on a site's page needs: whether to show the button, and the greeting. */
export async function widgetConfig(site: SiteId, rawPath: string) {
  const [settings, online] = await Promise.all([getChatSettings(), getSetting<boolean>("agent_online", true)]);
  const launcher = settings.launcher[site] !== false;
  const path = rawPath.slice(0, 200).toLowerCase();
  return {
    launcher,
    greeting:
      launcher && settings.greeting.enabled
        ? {
            delay: settings.greeting.delay,
            online,
            name: "Michael Winter",
            photo: HEADSHOT_URL,
            text: line(settings.greeting.lines, site, path, online),
          }
        : null,
  };
}
