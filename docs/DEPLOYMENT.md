# Deployment

## App identifiers

Update the iOS bundle identifier and Android package name in `app.config.js`:

```js
// app.config.js
module.exports = {
  expo: {
    ios: {
      bundleIdentifier: 'com.yourcompany.sportz'
    },
    android: {
      package: 'com.yourcompany.sportz'
    }
  }
};
```

## EAS project

```bash
npm install -g eas-cli
eas login
eas init
```

Copy the generated EAS project ID into `app.config.js` under `extra.eas.projectId`
and update the OTA updates URL in the same file:

```js
// app.config.js
module.exports = {
  expo: {
    extra: {
      eas: {
        projectId: 'your-eas-project-id'
      }
    },
    updates: {
      url: 'https://u.expo.dev/your-eas-project-id'
    }
  }
};
```

> [!NOTE]
> This project uses `app.config.js` (a dynamic JS config), **not** `app.json`.
> All Expo config changes must be made in `app.config.js`.

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

## Supabase Edge Functions

Deploy all functions at once:

```bash
supabase functions deploy
```

Or deploy individually (JWT settings are applied from `supabase/config.toml` automatically):

```bash
supabase functions deploy username-availability   # public — no JWT required
supabase functions deploy chat-message-notifier   # webhook — no JWT required
supabase functions deploy notification-dispatcher # webhook — no JWT required
supabase functions deploy process-social-events   # webhook — no JWT required
supabase functions deploy finalize-media-upload   # webhook — no JWT required
supabase functions deploy feed-fanout             # internal — JWT required
supabase functions deploy push-fanout             # internal — JWT required
supabase functions deploy delete-account          # requires user Bearer token
```

`username-availability` is public so sign-up screens can check handles before login.
All webhook functions verify `x-supabase-webhook-secret` instead of a JWT.

## Required secrets

Set Edge Function secrets before deploying:

```bash
supabase secrets set CHAT_WEBHOOK_SECRET=<32-byte hex>
supabase secrets set NOTIFICATION_WEBHOOK_SECRET=<32-byte hex>
supabase secrets set SOCIAL_EVENTS_WEBHOOK_SECRET=<32-byte hex>
supabase secrets set MEDIA_UPLOAD_WEBHOOK_SECRET=<32-byte hex>
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase.

After setting secrets, also populate `private.edge_function_secrets` in the database
and configure the Postgres `app.settings.*` runtime variables.
See **docs/SETUP.md §6** for the complete SQL and instructions.

## Retry, timeout, and failure-recovery behaviour

| Function | Trigger | Timeout | Retry / recovery |
|---|---|---|---|
| `chat-message-notifier` | DB trigger on `chat_messages INSERT` | 2 000 ms (pg_net) | No automatic retry. Missed pushes are not retried. Online users have the message via realtime. |
| `notification-dispatcher` | DB trigger on `notifications INSERT` | 1 000 ms (pg_net) | Records `push_error` and `push_attempts`. `push-fanout` sweeps missed notifications every 2 min. |
| `process-social-events` | pg_net webhook (PGMQ publish) + pg_cron every 1 min | 5 000 ms | PGMQ visibility timeout (default 120 s) re-queues unacknowledged messages. After `SOCIAL_EVENTS_MAX_QUEUE_ATTEMPTS` (default 6), message is moved to the failure log. |
| `finalize-media-upload` | DB trigger on `storage.objects INSERT/UPDATE` | 3 000 ms (pg_net) | No automatic retry. Client may re-upload; trigger fires again on next `storage.objects` event. |
| `feed-fanout` | pg_cron every 1 min | 5 000 ms | Uses `claim_feed_fanout_jobs` + `complete_feed_fanout_job`. Failed jobs record an error; re-processing on the next invocation. |
| `push-fanout` | pg_cron every 2 min | 5 000 ms | Sweeps all notifications where `push_sent_at IS NULL AND push_attempts < 5`. |
| `username-availability` | Client HTTP | 10 000 ms | N/A — stateless query + Bloom filter. |
| `delete-account` | Client HTTP | 10 000 ms | N/A — idempotent auth.admin.deleteUser. |

### Logging

All Edge Functions write structured JSON to stdout, visible in
**Supabase Dashboard → Edge Functions → Logs** and via:

```bash
supabase functions logs <function-name> --scroll
```

`process-social-events` emits a structured log line per invocation:
```json
{"stage":"process-social-events","read":15,"recorded":15,"archived":15,"poisoned":0,"delivered":3,"failed":0}
```

## Deployment checklist

Before pushing to production, verify:

- [ ] `app.config.js` has the correct `bundleIdentifier` / `package`, `projectId`, and `updates.url`
- [ ] `supabase db push` applied without errors
- [ ] All Edge Functions deployed (`supabase functions deploy`)
- [ ] All secrets set via `supabase secrets set`
- [ ] `private.edge_function_secrets` rows populated (see `docs/SETUP.md §6b`)
- [ ] `app.settings.chat_message_notifier_url` and `app.settings.chat_webhook_secret` set in Postgres
- [ ] `SELECT * FROM public.deployment_health_check` — all `check_ok = true`
- [ ] pg_cron jobs active: `SELECT jobname, active FROM cron.job WHERE jobname LIKE 'sportz-%'`
- [ ] Auth providers enabled and redirect URLs configured
- [ ] EAS production build completed and submitted

## App icons and splash

Before production, add:

- `assets/icon.png`: 1024×1024, no transparency.
- `assets/adaptive-icon.png`: Android foreground with safe area.
- `assets/splash.png`: portrait SPORTZ court-line splash.
- Optional Android notification icon: monochrome white glyph.

Then wire them in `app.config.js`:

```js
module.exports = {
  expo: {
    icon: './assets/icon.png',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#0A0907'
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0A0907'
      }
    }
  }
};
```
