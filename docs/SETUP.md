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

## 2. Mobile app environment variables

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

These variables are injected into `app.config.js` at build time. **Do not commit `.env`.**

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
| `20260710000008_notification_infrastructure` | `user_push_tokens`, bundled `notifications` table, push delivery columns |
| `20260710000009_private_edge_function_secrets` | `private.edge_function_secrets` table and `service_role`-only access |
| `20260710000010_notification_webhook_pg_net` | DB trigger → `notification-dispatcher` via `pg_net` |
| `20260710000011_private_secret_rpc` | `get_edge_function_secret()` RPC callable by Edge Functions |
| `20260711000001_social_interactions_queue` | PGMQ `social_events` queue, `post_likes`, `post_comments`, `user_follows` |
| `20260711000002_resumable_media_placeholders_and_feed_cleanup` | Storage finalizer trigger, `post_media_assets` |
| `20260712000002_deprecate_legacy_push_tokens` | Drops the unused legacy `push_tokens` table |
| `20260722000001_feed_fanout_pg_cron_scheduler` | pg_cron jobs for feed-fanout, push-fanout, social-events; `deployment_health_check` view |
| `20260723000009_private_profile_covers_and_sports_integrity` | Private profile-cover bucket/RLS and primary-sport selection integrity |
| `20260723000010_private_profile_legacy_cover_guard` | Clears legacy public cover URLs whenever a profile becomes private |

---

## 4. Supabase — storage

Storage buckets and their current RLS policies are applied by the migrations:

```bash
supabase db push
```

`profile-covers` is intentionally private. Profile rows store an object path, and
the app requests a short-lived signed URL only after storage RLS verifies that the
viewer is the owner, the profile is public, or the viewer is an approved follower.
Do not change this bucket to public.

---

## 5. Supabase — edge functions

Deploy all Edge Functions at once:

```bash
supabase functions deploy
```

Or individually (with JWT verification flags applied automatically from `supabase/config.toml`):

```bash
supabase functions deploy chat-message-notifier
supabase functions deploy notification-dispatcher
supabase functions deploy process-social-events
supabase functions deploy finalize-media-upload
supabase functions deploy feed-fanout
supabase functions deploy push-fanout
supabase functions deploy delete-account
supabase functions deploy username-availability
```

---

## 6. Supabase — secrets

### 6a. Edge Function environment secrets

These are set with `supabase secrets set` and are available inside Edge Functions as `Deno.env.get(...)`.
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are **automatically injected** by Supabase; you do not need to set them manually.

| Secret name | Required by | Notes |
|---|---|---|
| `CHAT_WEBHOOK_SECRET` | `chat-message-notifier` | Must match `app.settings.chat_webhook_secret` in Postgres. |
| `NOTIFICATION_WEBHOOK_SECRET` | `notification-dispatcher` | Optional — function can also read from `private.edge_function_secrets`. |
| `SOCIAL_EVENTS_WEBHOOK_SECRET` | `process-social-events` | Optional — function can also read from `private.edge_function_secrets`. |
| `MEDIA_UPLOAD_WEBHOOK_SECRET` | `finalize-media-upload` | Optional — function can also read from `private.edge_function_secrets`. |

**Generate strong random secrets (32 bytes hex):**

```bash
# macOS / Linux
openssl rand -hex 32

# Windows PowerShell
[System.Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()
```

**Set them:**

```bash
supabase secrets set CHAT_WEBHOOK_SECRET=<value>
supabase secrets set NOTIFICATION_WEBHOOK_SECRET=<value>
supabase secrets set SOCIAL_EVENTS_WEBHOOK_SECRET=<value>
supabase secrets set MEDIA_UPLOAD_WEBHOOK_SECRET=<value>
```

### 6b. Database secrets (`private.edge_function_secrets`)

The database triggers and pg_cron jobs also read secrets from `private.edge_function_secrets`.
Run this SQL in the Supabase SQL editor or via `psql` to populate all required rows:

> [!IMPORTANT]
> Replace every `<value>` below with the **same random string** you set for the
> corresponding `supabase secrets set` command above. These values must match.

```sql
-- Replace <your-project-ref> with your Supabase project reference.
-- Replace each <secret-value> with the value generated by openssl rand -hex 32.

insert into private.edge_function_secrets (name, secret_value) values
  -- Webhook auth secrets (must match supabase secrets set values)
  ('chat_webhook_secret',             '<CHAT_WEBHOOK_SECRET value>'),
  ('notification_dispatcher_webhook', '<NOTIFICATION_WEBHOOK_SECRET value>'),
  ('process_social_events_webhook',   '<SOCIAL_EVENTS_WEBHOOK_SECRET value>'),
  ('finalize_media_upload_webhook',   '<MEDIA_UPLOAD_WEBHOOK_SECRET value>'),
  -- pg_cron → feed-fanout and push-fanout (generate separate secrets)
  ('feed_fanout_webhook',             '<a new random secret>'),
  ('push_fanout_webhook',             '<a new random secret>'),
  -- Edge Function URLs (replace <your-project-ref> in each)
  ('feed_fanout_url',                 'https://<your-project-ref>.supabase.co/functions/v1/feed-fanout'),
  ('push_fanout_url',                 'https://<your-project-ref>.supabase.co/functions/v1/push-fanout'),
  ('process_social_events_url',       'https://<your-project-ref>.supabase.co/functions/v1/process-social-events'),
  ('finalize_media_upload_url',       'https://<your-project-ref>.supabase.co/functions/v1/finalize-media-upload'),
  ('notification_dispatcher_url',     'https://<your-project-ref>.supabase.co/functions/v1/notification-dispatcher'),
  ('chat_message_notifier_url',       'https://<your-project-ref>.supabase.co/functions/v1/chat-message-notifier')
on conflict (name) do update set secret_value = excluded.secret_value, updated_at = now();
```

### 6c. Chat webhook Postgres setting

The `chat-message-notifier` trigger reads its secret and URL from Postgres runtime settings
(set outside source control so they are never committed):

```sql
-- Run in the Supabase SQL editor. Replace placeholders with real values.
alter database postgres
  set "app.settings.chat_message_notifier_url" =
    'https://<your-project-ref>.supabase.co/functions/v1/chat-message-notifier';

alter database postgres
  set "app.settings.chat_webhook_secret" = '<same value as CHAT_WEBHOOK_SECRET>';

select pg_reload_conf();
```

> [!WARNING]
> `app.settings.chat_webhook_secret` **must be identical** to the `CHAT_WEBHOOK_SECRET`
> Edge Function secret. If they differ, the trigger will send requests that the
> function rejects with HTTP 401 and chat push notifications will silently fail.

---

## 7. Supabase — auth providers

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

## 8. Feed fan-out scheduler

The `feed-fanout`, `push-fanout`, and `process-social-events` Edge Functions must
run on a schedule. Migration `20260722000001_feed_fanout_pg_cron_scheduler.sql` registers
**pg_cron jobs** automatically when applied.

### Verifying the schedule

```sql
select jobname, schedule, active from cron.job where jobname like 'sportz-%';
```

Expected output:

| jobname | schedule | active |
|---|---|---|
| sportz-feed-fanout | `* * * * *` | `t` |
| sportz-process-social-events | `* * * * *` | `t` |
| sportz-push-fanout | `*/2 * * * *` | `t` |

### Free-tier alternative (pg_cron unavailable)

If your project is on the **Free tier** and pg_cron is not available, configure an
external scheduler (GitHub Actions, AWS EventBridge, Railway Cron, Render Cron) to
call each function with `POST` and the correct `x-supabase-webhook-secret` header:

```bash
# Example: invoke feed-fanout every minute via curl
curl -s -X POST \
  https://<your-project-ref>.supabase.co/functions/v1/feed-fanout \
  -H "Content-Type: application/json" \
  -H "x-supabase-webhook-secret: <feed_fanout_webhook secret>" \
  -d '{"source":"external-cron"}'
```

---

## 9. Deployment health-check

After completing all setup steps, run the health-check view to verify the configuration:

```sql
select check_type, name, check_ok, status
from public.deployment_health_check
order by check_ok asc, check_type, name;
```

Every row must show `check_ok = true`. A `false` row will print an actionable `status`
message describing what is missing and how to fix it.

---

## 10. Expo push notifications

Push tokens are stored in the `user_push_tokens` table and delivered via the
`notification-dispatcher` and `push-fanout` Edge Functions using the
[Expo Push API](https://docs.expo.dev/push-notifications/overview/).

For production builds you need an EAS project ID:

1. Run `eas build:configure` to create / link an EAS project.
2. Copy the `projectId` from `eas.json` into `app.config.js` under `extra.eas.projectId`.
3. For Android, add your FCM credentials via `eas credentials`.
4. For iOS, APNs are managed automatically by EAS.

No action is needed for local Expo Go development — push tokens are skipped on simulators.

---

## 11. Seed data (optional)

```bash
# Paste supabase/seed.sql in the Supabase SQL editor to pre-populate courts
```

---

## 12. Run locally

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

### Mobile app
- [ ] `.env` filled in with correct Supabase URL and publishable key
- [ ] EAS project linked (`eas build:configure`); `projectId` updated in `app.config.js`

### Database
- [ ] `supabase db push` completed without errors
- [ ] Storage policies applied (`supabase/storage.sql`)

### Edge Functions
- [ ] All functions deployed (`supabase functions deploy`)
- [ ] `CHAT_WEBHOOK_SECRET` set via `supabase secrets set`
- [ ] `NOTIFICATION_WEBHOOK_SECRET` set via `supabase secrets set`
- [ ] `SOCIAL_EVENTS_WEBHOOK_SECRET` set via `supabase secrets set`
- [ ] `MEDIA_UPLOAD_WEBHOOK_SECRET` set via `supabase secrets set`

### Database secrets
- [ ] All rows inserted into `private.edge_function_secrets` (§6b above)
- [ ] `app.settings.chat_message_notifier_url` set in Postgres (§6c above)
- [ ] `app.settings.chat_webhook_secret` set in Postgres and matches `CHAT_WEBHOOK_SECRET` (§6c above)
- [ ] `select pg_reload_conf()` run after setting Postgres settings

### Scheduler
- [ ] `select * from cron.job where jobname like 'sportz-%'` shows three active jobs
- [ ] OR external cron configured to call feed-fanout, push-fanout, and process-social-events

### Health-check
- [ ] `SELECT * FROM public.deployment_health_check` — all rows show `check_ok = true`

### Auth
- [ ] Auth providers enabled (Email, Google, Apple)
- [ ] Redirect URLs added (`sportz://`, `sportz://reset-password`)
