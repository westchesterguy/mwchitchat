import type { MetadataRoute } from "next";

/**
 * Makes the chat app installable on a phone, and is what an Android APK
 * wrapper (a Trusted Web Activity) reads for its name, colors and icons.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // The app's identity, kept from when it lived at /admin so phones that
    // installed it then treat this as the same app, not a second one.
    id: "/admin",
    name: "MW Chat",
    short_name: "MW Chat",
    description: "Live chat with visitors to westchesterguy.com and westchesterhorseproperties.com.",
    start_url: "/chatapp",
    scope: "/chatapp",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafaf7",
    theme_color: "#002349",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
