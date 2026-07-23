# Testing

## Static checks

```bash
npm run typecheck
npm run lint
```

## Unit tests

```bash
npm test
```

Database lifecycle tests live under `supabase/tests/database/` and run against the local Supabase stack:

```bash
npx supabase test db
```

## Manual QA

- Auth: email login, validated 13+ registration, email confirmation, reset, Google,
  Apple on iOS, and OAuth profile completion. Phone verification is intentionally deferred.
- Feed: infinite scroll, optimistic like rollback, post create/edit/delete, media upload, comments and replies.
- Profiles: edit profile, public follow, private follow request accept/decline, hireable filters.
- Events: create event, join, waitlist when full, refresh/restart persistence, leave waitlist,
  duplicate join, RSVP, FIFO promotion and promotion notification, concurrent join/leave,
  organizer attendee/waitlist removal, capacity-checked manual promotion, player count updates,
  and event chat.
- Courts: location permission denied/granted, sport filters, availability labels, booking request, admin confirm/cancel.
- Messages: realtime receive, optimistic send, read receipts, typing indicator, group create/add/leave, mute preferences, and per-user clear history.
- Notifications: push permission, foreground notification, mark all read, push fan-out preferences, conversation mute suppression.
- Moderation: report submission, admin review/dismiss/action states.
- Account deletion: destructive confirmation, Edge Function success/failure handling.
- Offline: launch app offline after a successful online cache fill.
- Dark/light: settings toggle and OS theme behavior.
