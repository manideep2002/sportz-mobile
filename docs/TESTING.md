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

## Court discovery and booking lifecycle

Run the database suite with the local Supabase stack:

```powershell
npx.cmd supabase test db
```

The court lifecycle suite covers server-side discovery filters, PostGIS distance calculation, operating hours, closures, court timezones, occupied-slot removal, booking conflicts, cancellation deadlines, administrative confirmation, and user/admin RLS.

Manual mobile QA:

1. Grant location permission and confirm courts are ordered by non-zero distance.
2. Deny permission and confirm profile-city/manual-city discovery remains usable.
3. Filter by sport, surface, maximum distance, maximum price, open-now, and future availability.
4. Open a court that is currently closed but future-bookable and book one server-returned slot.
5. Confirm the slot disappears on another account and a concurrent request is rejected.
6. Review Pending, Upcoming, Confirmed, Cancelled, and Past in My Bookings.
7. Cancel before the deadline, verify the slot returns, and verify late cancellation is blocked.
8. Confirm administrators can still view, confirm, and cancel requests.
9. Test the external Maps link with and without an available map handler.
10. Verify the booking screen states that payment is made directly to the venue or is not required.
