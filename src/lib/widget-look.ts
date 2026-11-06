import { HEADSHOT_URL, MARK_URL } from "./sites";

/**
 * How the chat button and the greeting beside it look on the sites, set on
 * the developer page. Part of the chat settings (see chat-settings.ts).
 */

export type IconKind = "chat" | "mark" | "photo" | "image";
export type CardForm = "card" | "compact" | "bubble";
export type CardSize = "small" | "medium" | "large";
export type CardStyle = "light" | "dark";
export type CardPhoto = "headshot" | "mark" | "image" | "none";

export interface WidgetLook {
  /** The button's color, and the icon's (the chat bubble and the close arrow). */
  color: string;
  iconColor: string;
  /** What is on the button: a chat bubble, the MW mark, Michael's photo, or an uploaded image. */
  icon: IconKind;
  iconImage: string | null;
  /** The button's width, in pixels. */
  size: number;
  /** Which bottom corner, and how far from the side and the bottom, in pixels. */
  side: "right" | "left";
  x: number;
  y: number;
  card: {
    form: CardForm;
    size: CardSize;
    style: CardStyle;
    photo: CardPhoto;
    photoImage: string | null;
  };
}

export const SOTHEBYS_BLUE = "#002349";

export const LOOK_DEFAULTS: WidgetLook = {
  color: SOTHEBYS_BLUE,
  iconColor: "#ffffff",
  icon: "chat",
  iconImage: null,
  size: 60,
  side: "right",
  x: 20,
  y: 20,
  card: { form: "card", size: "medium", style: "light", photo: "headshot", photoImage: null },
};

export const LOOK_LIMITS = {
  size: [44, 80],
  x: [0, 160],
  y: [0, 240],
} as const;

const HEX = /^#[0-9a-f]{6}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function oneOf<T extends string>(v: unknown, options: readonly T[], fallback: T): T {
  return options.includes(v as T) ? (v as T) : fallback;
}

/** Stored or sent values laid over the defaults. Anything out of range is reported, not quietly fixed. */
export function readLook(input: unknown): { look: WidgetLook; error: string | null } {
  const i = (input ?? {}) as Record<string, unknown>;
  const c = (i.card ?? {}) as Record<string, unknown>;
  const d = LOOK_DEFAULTS;
  let error: string | null = null;
  const color = (v: unknown, fallback: string, what: string) => {
    if (v === undefined) return fallback;
    if (typeof v === "string" && HEX.test(v)) return v.toLowerCase();
    error ??= `${what} must be a color like #002349.`;
    return fallback;
  };
  const num = (v: unknown, [min, max]: readonly [number, number], fallback: number, what: string) => {
    if (v === undefined) return fallback;
    if (typeof v === "number" && Number.isInteger(v) && v >= min && v <= max) return v;
    error ??= `${what} must be between ${min} and ${max} pixels.`;
    return fallback;
  };
  const image = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v.toLowerCase() : null);

  const look: WidgetLook = {
    color: color(i.color, d.color, "The button color"),
    iconColor: color(i.iconColor, d.iconColor, "The icon color"),
    icon: oneOf(i.icon, ["chat", "mark", "photo", "image"], d.icon),
    iconImage: image(i.iconImage),
    size: num(i.size, LOOK_LIMITS.size, d.size, "The button size"),
    side: oneOf(i.side, ["right", "left"], d.side),
    x: num(i.x, LOOK_LIMITS.x, d.x, "The distance from the side"),
    y: num(i.y, LOOK_LIMITS.y, d.y, "The distance from the bottom"),
    card: {
      form: oneOf(c.form, ["card", "compact", "bubble"], d.card.form),
      size: oneOf(c.size, ["small", "medium", "large"], d.card.size),
      style: oneOf(c.style, ["light", "dark"], d.card.style),
      photo: oneOf(c.photo, ["headshot", "mark", "image", "none"], d.card.photo),
      photoImage: image(c.photoImage),
    },
  };
  if (look.icon === "image" && !look.iconImage) error ??= "Upload an image for the button, or pick another icon.";
  if (look.card.photo === "image" && !look.card.photoImage) error ??= "Upload a photo for the greeting, or pick another.";
  return { look, error };
}

/** Where an uploaded image is served from; relative, so widget.js puts the chat app's address in front. */
export function imageUrl(id: string): string {
  return `/api/v/image/${id}`;
}

/** Whether a color is light enough to need a dark icon or edge on it. */
function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 160;
}

/** The look as widget.js uses it: images as addresses, colors worked out. */
export function lookForWidget(look: WidgetLook) {
  const photo =
    look.card.photo === "headshot"
      ? HEADSHOT_URL
      : look.card.photo === "image" && look.card.photoImage
        ? imageUrl(look.card.photoImage)
        : null;
  return {
    color: look.color,
    iconColor: look.iconColor,
    // The ring needs an edge that shows against the button.
    light: isLight(look.color),
    // A dark card on a light button would not match; Sotheby's blue then.
    dark: isLight(look.color) ? SOTHEBYS_BLUE : look.color,
    icon: look.icon,
    iconUrl:
      look.icon === "photo"
        ? HEADSHOT_URL
        : look.icon === "mark"
          ? MARK_URL
          : look.icon === "image" && look.iconImage
            ? imageUrl(look.iconImage)
            : null,
    mark: MARK_URL,
    size: look.size,
    side: look.side,
    x: look.x,
    y: look.y,
    card: { form: look.card.form, size: look.card.size, style: look.card.style, photo: look.card.photo, photoUrl: photo },
  };
}
