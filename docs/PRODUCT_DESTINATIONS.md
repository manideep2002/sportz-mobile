# Product destinations

Release configuration, rather than source code, supplies every public Help and install destination. Do not ship guessed store IDs, temporary support mailboxes, or unpublished URLs.

Set these production values in the EAS/CI environment used to build the app and generate static site assets:

| Variable | Required value |
| --- | --- |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | A monitored production support mailbox. Set this or `EXPO_PUBLIC_SUPPORT_URL`. |
| `EXPO_PUBLIC_SUPPORT_URL` | HTTPS support page. Used when the mail client cannot open or when no email is configured. |
| `EXPO_PUBLIC_APP_STORE_URL` | Published HTTPS App Store product URL for the production iOS app. |
| `EXPO_PUBLIC_PLAY_STORE_URL` | Published HTTPS Google Play product URL for the production Android app. |
| `EXPO_PUBLIC_INSTALL_FALLBACK_URL` | HTTPS browser page that helps a device choose the correct install destination. |

The app validates URLs at runtime and hides actions with no valid destination. It first asks the operating system whether it can open the native/email target, then tries the configured browser fallback. If neither opens, Help shows an inline error and lets the user retry.

Before a release, run:

```bash
npm run config:destinations
npm run links:fallback
```

`links:fallback` generates `public/link-fallback.html` from the same environment values. Deploy that generated artifact with the website; do not hand-edit or commit a fallback page containing production destinations. `npm run links:release-assets` runs destination validation, association generation, fallback generation, and association validation together.

After deploying the site, test Contact Support on a device with and without a configured mail client, and test an app-link fallback in an iOS and Android browser. The store URLs and support destination remain public app configuration, never credentials.
