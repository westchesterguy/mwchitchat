# Android app

The chat app wrapped as an Android app (a Trusted Web Activity): a thin
shell that opens https://chat.westchesterguy.com/chatapp full-screen through
Chrome. Changes to the web app reach the installed app without a new APK.

- `twa-manifest.json`: the app's settings for Bubblewrap.
- `../public/.well-known/assetlinks.json`: proves the app and the site belong
  together, so the app opens without a browser address bar. It lists the
  SHA-256 fingerprint of the signing key.

The signing key (`mwchat-upload.keystore`) and its password are not in this
repo. Every update must be signed with the same key. If the app is published
through Google Play with Play App Signing, add Play's app-signing fingerprint
to `assetlinks.json` as well.

To build a new version: bump `appVersionCode` and `appVersion` here, then
`bubblewrap update && bubblewrap build` in a folder holding this file and the
keystore.
