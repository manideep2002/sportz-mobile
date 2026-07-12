# Setup

## Requirements

- Node.js 20 or newer
- Expo CLI via `npx expo`
- Xcode (iOS builds)
- Android Studio (Android builds)
- Supabase CLI — `npm install -g supabase` or see [supabase.com/docs/guides/cli](https://supabase.com/docs/guides/cli)
- EAS CLI — `npm install -g eas-cli`

---

## 1. Install dependencies

```bash
npm install
npx expo install --fix
```

---

## 2. Environment variables

```bash
# macOS / Linux
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

Fill in `.env`:

```text
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
EXPO_PUBLIC_APP_SCHEME=sportz
```

---

## 3. Supabase — database

> [!IMPORTANT]
> **Always use `supabase db push` to apply schema.** The file `supabase/schema.sql`
> is not maintained and will produce an incomplete schema. The authoritative
> source of truth is `supabase/migrations/`.

```bash
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

This applies all migrations in `supabase/migrations/` in order, including:

| Migration | What it creates |
|---|---|
| `20240101000000_initial_schema` | Core tables (profiles, posts, events, communities, …) |
| `20260710000001_thread_first_chat` | `chat_rooms`, `chat_participants`, `chat_messages` |
| `20260710000008_notification_infrastructure` | **`user_push_tokens`**, bundled `notifications` table, push delivery columns |
| `20260711000001_social_interactions_queue` | Social action queue for fan-out |
| `20260712000001_community_post_privacy` | Fixed `posts` RLS for group/followers visibility |
| `20260712000002_deprecate_legacy_push_tokens` | Drops the unused legacy `push_tokens` table |

---

## 4. Supabase — storage

```bash
# Run in the Supabase SQL editor or via psql
supabase db push  # already applies storage.sql if it is in migrations/
```

If you need to apply storage policies manually:

```bash
# Paste supabase/storage.sql in the Supabase SQL editor
```

---

## 5. Supabase — edge functions

Push notification delivery and feed fan-out require the edge functions to be deployed:

```bash
supabase functions deploy push-fanout
supabase functions deploy notification-dispatcher
supabase functions deploy chat-message-notifier
supabase functions deploy feed-fanout
supabase functions deploy finalize-media-upload
supabase functions deploy process-social-events
supabase functions deploy delete-account
```

Or deploy all at once:

```bash
supabase functions deploy
```

Set the required secrets (used inside edge functions):

```bash
supabase secrets set SUPABASE_URL=https://your-project-ref.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 6. Supabase — auth providers

Enable in the Supabase dashboard → Authentication → Providers:

- **Email / Password** (enable "Confirm email" if desired)
- **Google** (OAuth)
- **Apple** (OAuth, iOS only)

Add redirect URLs under Authentication → URL Configuration:

```text
sportz://
sportz://reset-password
```

---

## 7. Expo push notifications

Push tokens are stored in the `user_push_tokens` table and delivered via the
`push-fanout` edge function using the [Expo Push API](https://docs.expo.dev/push-notifications/overview/).

For production builds you need an EAS project ID:

1. Run `eas build:configure` to create / link an EAS project.
2. Copy the `projectId` from `eas.json` into `app.config.js` under `extra.eas.projectId`.
3. For Android, add your FCM credentials via `eas credentials`.
4. For iOS, APNs are managed automatically by EAS.

No action is needed for local Expo Go development — push tokens are skipped on simulators.

---

## 8. Seed data (optional)

```bash
# Paste supabase/seed.sql in the Supabase SQL editor to pre-populate courts
```

---

## 9. Run locally

```bash
npm run start
```

Then press `i` for iOS simulator, `a` for Android emulator, or scan the QR code with Expo Go.

> [!NOTE]
> The app requires a configured Supabase project for authentication, storage,
> realtime, and persistence. An unconfigured Supabase URL will cause the app
> to show an error on launch.

---

## Checklist for a new environment

- [ ] `.env` filled in with correct Supabase URL and publishable key
- [ ] `supabase db push` completed without errors
- [ ] Edge functions deployed (`supabase functions deploy`)
- [ ] Secrets set (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
- [ ] Auth providers enabled (Email, Google, Apple)
- [ ] Redirect URLs added (`sportz://`, `sportz://reset-password`)
- [ ] EAS project linked (production push notifications)
