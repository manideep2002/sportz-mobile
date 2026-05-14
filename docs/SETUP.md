# Setup

## Requirements

- Node.js 20 or newer.
- Expo CLI through `npx expo`.
- Xcode for iOS builds.
- Android Studio for Android builds.
- Supabase CLI for local database work.
- EAS CLI for cloud builds.

## Install dependencies

```bash
npm install
npx expo install --fix
```

## Environment

```bash
cp .env.example .env
```

Set these values:

```text
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
EXPO_PUBLIC_APP_SCHEME=sportz
```

## Supabase

```bash
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

Or paste the SQL files in this order:

1. `supabase/schema.sql`
2. `supabase/storage.sql`
3. `supabase/seed.sql`

Enable auth providers in Supabase:

- Email/password
- Google
- Apple

Add redirect URLs:

```text
sportz://
sportz://reset-password
```

## Run locally

```bash
npm run start
```

The app has mock fallbacks when Supabase env values are missing, but authentication, storage, realtime, and persistence require a configured Supabase project.
