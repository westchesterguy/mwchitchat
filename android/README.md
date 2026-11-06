# Android app

The chat app wrapped as an Android app (a Trusted Web Activity): a thin
shell that opens https://chat.westchesterguy.com/chatapp full-screen through
Chrome. Changes to the web app reach the installed app without a new APK.

The current build is offered for download in the chat app's Settings
(Android app). It lives at `public/downloads/mw-chat.apk`, and its version
is in `src/lib/android-app.ts`.

- `twa-manifest.json`: the app's settings for Bubblewrap. The start address
  carries `?app=android&v=<versionCode>` so Settings knows it is in the app
  and which version.
- `native/`: MW Chat's own Android code, added on top of what Bubblewrap
  generates:
  - `Tones.java`: the alert sounds in `res/raw` (the same tones as in the web
    app's `src/components/admin/tones.ts`). Android fixes a notification
    channel's sound when it is made, so each tone has its own channel and
    only the chosen one is kept.
  - `ToneActivity.java`: opened by Settings with `mwchat://tone?id=bell` to set
    the alert sound.
  - `DelegationService.java`: posts each notification Chrome hands over onto
    the chosen tone's channel.
  - `prepare.mjs`: copies the above into a generated project, registers the
    link, and points the build at Google's mirror of Maven Central.
- `../public/.well-known/assetlinks.json`: proves the app and the site belong
  together, so the app opens without a browser address bar. It lists the
  SHA-256 fingerprint of each signing key in use.

## Signing key

Version 1.1.0 onward is signed with `mwchat-android.keystore` (alias
`mwchat`), SHA-256 `16:0A:6C:2F:DF:05:3B:9F:67:F1:28:52:3A:C6:EB:11:B7:8B:16:B8:B8:0E:F6:70:A9:46:28:AA:54:7C:96:A9`.
The key and its password are not in this repo; Michael keeps them. Every
update must be signed with the same key, or Android will only install it
after the old app is removed. Version 1.0.0's key (the first fingerprint in
`assetlinks.json`) is no longer available.

## Building a new version

1. Bump `appVersionCode`, `appVersionName` and `appVersion` here, and `v=` in
   `startUrl`; then the same numbers in `src/lib/android-app.ts`.
2. If tones changed in `tones.ts`, render them to `native/res/raw/tone_<id>.ogg`
   (OfflineAudioContext, as the Settings page's "Save to this device" does,
   then `ffmpeg -c:a libvorbis -q:a 5`) and add them to `Tones.java`.
3. Generate the project with `@bubblewrap/core` (`TwaGenerator`) from this
   file (drop `webManifestUrl` if the site can't be fetched from where you
   build), then `node native/prepare.mjs <project>`.
4. With the Android SDK (platform 36, build-tools 35) and JDK 17 or later:
   `./gradlew assembleRelease`, then `zipalign -p 4` and
   `apksigner sign --ks mwchat-android.keystore --ks-key-alias mwchat`.
5. Copy the signed APK to `public/downloads/mw-chat.apk`, update `bytes` and
   `sha256` in `src/lib/android-app.ts`, and deploy.
