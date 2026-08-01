# Universal Links and Android App Links

`sportz.app` is the HTTPS authority for native links. Association files are generated
only in the release/hosting environment; no Apple team identifier or Android signing
fingerprint is committed to the repository.

## Release identity inputs

Set these protected CI/hosting variables for the production build. Do not use an iOS
simulator identity, Android debug keystore, or Android upload-key fingerprint.

```text
IOS_TEAM_ID=<10-character Apple Developer Team ID>
IOS_BUNDLE_IDENTIFIER=<the signed iOS bundle identifier; normally com.sportz.mobile>
ANDROID_APPLICATION_ID=<the signed Android application ID; normally com.sportz.mobile>
ANDROID_SHA256_CERT_FINGERPRINTS=<Google Play App Signing SHA-256[,additional production SHA-256]>
EXPO_PUBLIC_CANONICAL_WEB_URL=https://sportz.app
```

Get the Apple team ID from the Apple Developer account that signs the release. Get the
Android fingerprint from Play Console → Release → Setup → App integrity → App signing
key certificate. If EAS signs an APK/AAB before Play distribution, use the certificate
shown by `eas credentials -p android`; after Play app signing is enabled, the Play
certificate is the one that must be published. Treat these values as release identity
material and store them only in CI/hosting secrets.

## Generate and deploy

Run this in the same release environment that has the protected variables:

```bash
npm run links:associations
npm run links:validate
```

Deploy the generated `public/.well-known/apple-app-site-association` and
`public/.well-known/assetlinks.json` verbatim at the canonical host. Configure the
hosting/CDN rules exactly as follows:

| Path | Status/redirect | Content-Type | Cache-Control |
| --- | --- | --- | --- |
| `/.well-known/apple-app-site-association` | HTTPS `200`, no redirect, no extension | `application/json` | `public, max-age=3600, must-revalidate` |
| `/.well-known/assetlinks.json` | HTTPS `200`, no redirect | `application/json` | `public, max-age=3600, must-revalidate` |

Do not route either well-known path through the SPA fallback, login middleware, locale
redirects, or a CDN HTML error page. Canonical entity paths may still route to
`public/link-fallback.html` for users without the app.

After deployment, run from the same release environment:

```bash
npm run links:validate:remote
curl -i https://sportz.app/.well-known/apple-app-site-association
curl -i https://sportz.app/.well-known/assetlinks.json
```

The remote validator rejects redirects, non-JSON MIME types, unsafe/missing cache
headers, mismatched identities, and route drift.

## Signed-device verification

Build and install a release/TestFlight iOS app and an Android APK/AAB signed with the
identities above. Debug builds and simulators do not prove production association.

1. Install the signed app fresh, with normal network access; wait for the operating
   system to fetch the association files.
2. Open each of these in Safari/Notes on iOS and a browser/ADB on Android: a post,
   profile, event, court, group, page, community invitation, booking, offer, and
   `https://sportz.app/reset-password` link.
3. Confirm a signed-out canonical link is stored and opens after authentication; the
   reset-password link must enter recovery without requiring a logged-in session.
4. On Android, inspect verification with:

   ```bash
   adb shell pm get-app-links com.sportz.mobile
   adb shell am start -W -a android.intent.action.VIEW -d https://sportz.app/posts/<id>
   ```

5. On iOS, long-press the URL to confirm SPORTZ is offered, then open it from Safari.
   If a previous browser choice is cached, remove/reinstall the app or reset the domain
   preference before retesting.

If the actual Apple team, bundle ID, Android application ID, or Play signing fingerprint
differs from the defaults shown above, release remains blocked until the protected values
are supplied and the generated files are redeployed.
