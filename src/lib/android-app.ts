/**
 * The Android app offered for download in Settings (public/downloads). Bump
 * these with each new build; the app reports its own version (v= in its
 * start address) so Settings can tell an older install to update.
 */
export const ANDROID_APP = {
  version: "1.1.0",
  code: 2,
  url: "/downloads/mw-chat.apk",
  bytes: 1264497,
  sha256: "23a632d6e3fdb3003fe3b1ad446ebe4a8e3d37432545f12e853cb326de7332d6",
  packageName: "com.westchesterguy.chat",
} as const;
