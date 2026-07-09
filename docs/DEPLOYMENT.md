# Deployment

## App identifiers

Update `app.json`:

```json
{
  "ios": {
    "bundleIdentifier": "com.yourcompany.sportz"
  },
  "android": {
    "package": "com.yourcompany.sportz"
  }
}
```

## EAS project

```bash
npm install -g eas-cli
eas login
eas init
```

Copy the generated EAS project id into `app.json`.

After `eas init`, add the updates URL back to `app.json`:

```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "your-eas-project-id"
      }
    },
    "updates": {
      "url": "https://u.expo.dev/your-eas-project-id"
    }
  }
}
```

## Production builds

```bash
eas build --platform android --profile production
eas build --platform ios --profile production
```

## Submit

```bash
eas submit --platform android --profile production
eas submit --platform ios --profile production
```

## OTA updates

```bash
eas update --branch production --message "SPORTZ production update"
```

Only ship OTA updates for JavaScript/assets. Native dependency changes require a new binary build.

## Supabase functions

```bash
npx supabase functions deploy username-availability --no-verify-jwt
npx supabase functions deploy feed-fanout
npx supabase functions deploy push-fanout
```

`username-availability` is public so signup screens can check handles before login. Keep `SUPABASE_SERVICE_ROLE_KEY` set in Supabase function secrets; the function only returns availability and does not mutate profile data.

## App icons and splash

Before production, add:

- `assets/icon.png`: 1024x1024, no transparency.
- `assets/adaptive-icon.png`: Android foreground with safe area.
- `assets/splash.png`: portrait SPORTZ court-line splash.
- Optional Android notification icon: monochrome white glyph.

Then wire them in `app.json`.
