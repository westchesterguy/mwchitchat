import type { NextConfig } from "next";
import { DEFAULT_FRAME_ANCESTORS } from "./src/lib/sites";

/** Pages allowed to show the chat window in a frame: the two sites. */
const frameAncestors = (
  process.env.FRAME_ANCESTORS?.split(",").map((s) => s.trim()).filter(Boolean) ??
  DEFAULT_FRAME_ANCESTORS
).join(" ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Shown on the developer page: which version is running.
  env: {
    BUILD_TIME: new Date().toISOString(),
    BUILD_COMMIT: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
    BUILD_MESSAGE: (process.env.VERCEL_GIT_COMMIT_MESSAGE ?? "").split("\n")[0].slice(0, 160),
    BUILD_BRANCH: process.env.VERCEL_GIT_COMMIT_REF ?? "",
  },
  // Browsers ask for /favicon.ico on their own; answer with the app icon.
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icons/icon-192.png" }];
  },
  async headers() {
    return [
      {
        // Nothing here belongs in search results.
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        // The visitor chat window: framed by the sites only.
        source: "/embed",
        headers: [
          { key: "Content-Security-Policy", value: `frame-ancestors 'self' ${frameAncestors}` },
        ],
      },
      {
        // Everything else, the admin app above all, is never framed.
        source: "/((?!embed$).*)",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'none'" }],
      },
      {
        source: "/widget.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=300, must-revalidate" }],
      },
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};

export default nextConfig;
