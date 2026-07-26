# Privacy-safe observability

SPORTZ uses Sentry for Expo application crashes and structured Supabase Edge
Function logs for delivery and queue health. Monitoring is operational only: it
is not product analytics, advertising, profiling, or session replay.

## Environment and release isolation

The EAS profiles set `EXPO_PUBLIC_APP_ENV` to `development`, `preview`, or
`production`. Sentry receives that environment plus:

- application release (`sportz-mobile@<app version>`);
- runtime version;
- Expo update ID (or `embedded`);
- current route name;
- operation name and a generated correlation ID.

Development monitoring is disabled even when a DSN exists unless
`EXPO_PUBLIC_ENABLE_DEV_MONITORING=true`. Test events are always disabled.
Preview and production must use the corresponding Sentry environment filters;
separate Sentry projects/DSNs may be used for stricter physical separation.

Set these as EAS environment variables rather than committing values:

- `EXPO_PUBLIC_SENTRY_DSN` (public client configuration);
- `SENTRY_AUTH_TOKEN` (secret, build-time source-map upload only);
- `SENTRY_ORG` and `SENTRY_PROJECT` (build-time project selection).

## Data minimization

`sendDefaultPii`, screenshots, view hierarchy capture, and replay are disabled.
Navigation breadcrumbs contain route names only—never route params. The mobile
and Edge scrubbers recursively remove:

- access/refresh tokens, authorization headers, cookies, passwords, and secrets;
- email addresses and phone/mobile numbers;
- chat/message bodies and generic request body fields;
- signed, private, storage, avatar, cover, and media URLs/paths;
- URLs, JWT-shaped strings, and bearer credentials embedded in error messages.

Do not add raw Supabase responses, user records, navigation params, notification
content, chat text, upload paths, or request bodies to monitoring context.
Stable database IDs may be supplied only where they are needed to diagnose an
operation; Edge logs additionally redact user/actor/recipient IDs.

Expected validation failures (for example invalid credentials, denied
permissions, oversized media, full events, or unavailable booking slots) remain
user-facing errors and are not reported as crashes.

## Mobile coverage

Unexpected errors are captured at auth, upload, event-join, court-booking,
chat-send, push-registration, notification, React Query, and application error
boundaries. The error boundary presents a recoverable screen and creates a
correlated report without showing technical details.

Use `captureControlledTestError()` only in a preview build to verify transport.
Confirm the event is tagged `environment=preview`, includes release/route/
correlation fields, and contains none of the fixture PII. Never trigger this in a
production user flow.

## Edge Function logging and alerts

Edge Functions accept a valid `x-correlation-id`/`x-request-id` or generate one,
include it in every response, and emit one-line JSON logs with environment,
function name, event, level, and elapsed time. Webhook authentication failures,
push failures, social queue failures, and media-processing failures use
structured event names.

`observability-health` runs every five minutes and checks:

- oldest pending feed/push work (default stale threshold: 300 seconds);
- feed/push records with at least three attempts;
- failed or stale media processing.

Create log alerts for:

- `health.stale_queue`;
- `health.repeated_delivery_failure`;
- `health.media_processing_failure`;
- `push.delivery_failed`;
- `social_queue.background_failed`;
- `media.processing_failed`;
- `webhook.secret_lookup_failed`.

Thresholds can be tuned with `OBSERVABILITY_STALE_QUEUE_SECONDS` and
`OBSERVABILITY_REPEATED_FAILURE_ATTEMPTS`.

## Supabase deployment

The health schedule and function resolve the same generated
`observability_health_webhook` value from `private.edge_function_secrets`; the
deployed endpoint is stored as `observability-health_url`. Never print or commit
the generated webhook value.

Deploy in this order:

```bash
supabase db push
supabase functions deploy notification-dispatcher --no-verify-jwt
supabase functions deploy process-social-events --no-verify-jwt
supabase functions deploy finalize-media-upload --no-verify-jwt
supabase functions deploy observability-health --no-verify-jwt
supabase secrets set APP_ENV=production
```

Then invoke the health function with the webhook header and confirm the response
contains `x-correlation-id`. In the database, verify the schedule:

```sql
select jobname, schedule, active
from cron.job
where jobname = 'sportz-observability-health';
```

## Verification

- Run Jest monitoring/redaction/error-boundary tests.
- Run `deno test supabase/functions/_shared/observability.test.ts`.
- Exercise a controlled preview exception and a controlled Edge failure.
- Search emitted reports/logs for the test email, phone, token, body, and media
  URL fixtures; every search must return zero.
- Confirm preview events do not appear under the production environment.
