# Android Continuous Native Generation

SPORTZ uses Expo Continuous Native Generation (CNG). `android/` and `ios/` are intentionally ignored because the source of truth is `app.config.js`, installed Expo plugins, and JavaScript dependencies. Do not hand-edit or commit files below `android/`.

Before any local Android run, regenerate from the current SDK and app configuration:

```bash
npm run android:generate
npm run android:check -- --variant debug
npm run android
```

`android:generate` uses `expo prebuild --clean --platform android --no-install`, which removes stale generated output before recreating it. The `android` script always performs this generation and configuration check before calling `expo run:android`; use it instead of invoking `expo run:android` directly.

The clean-generation check validates the generated package ID, permissions, HTTPS app-link routes, Expo OTA URL/SDK metadata, Android Gradle tooling, and signing wiring against `app.config.js`.

## Signing

Debug builds use the generated debug keystore only. The generated release variant is explicitly wired to `signingConfigs.release`, never `signingConfigs.debug`. EAS Build injects managed Android credentials into that release configuration during its secure build step. For a local release build, use an ignored Gradle properties file:

```properties
SPORTZ_RELEASE_STORE_FILE=/absolute/path/to/release.keystore
SPORTZ_RELEASE_STORE_PASSWORD=...
SPORTZ_RELEASE_KEY_ALIAS=...
SPORTZ_RELEASE_KEY_PASSWORD=...
```

Do not add these values, a keystore, or a `credentials.json` file to source control. A release assemble without secure credentials must fail; that is intentional. Validate generated release wiring without credentials with:

```bash
npm run android:release:check
```

For a production artifact, use `eas build --platform android --profile production` after verifying that EAS managed credentials and the Play App Signing identity match `ANDROID_SHA256_CERT_FINGERPRINTS` used by `npm run links:associations`. Expo documents that CNG clean prebuilds and managed credentials are injected into Gradle during EAS Android builds: [Android build process](https://docs.expo.dev/build-reference/android-builds/).
