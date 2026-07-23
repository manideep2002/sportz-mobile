# Security

- Never expose service-role keys in the app.
- Use only `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` on the client.
- Keep all authorization in Supabase row-level security policies.
- Use signed URLs for private media if private stories, paid events, or team-only uploads are introduced.
- Rate-limit edge functions for search, push notification fan-out, and media processing.
- Validate form input on client with TypeScript and on backend with database constraints.
- Registration requires users to be at least 13 years old. The client schema is
  enforced again in the auth service before any Supabase signup request.
- Mobile numbers are normalized as Indian E.164 contact data. Phone verification is
  deferred until a production SMS provider and abuse-protected server flow are configured;
  the app must not label stored numbers as verified or generate client-side OTPs.
- Store push tokens in `push_tokens` with RLS scoped to the current user.
- Send push notifications only from the `push-fanout` Edge Function; it must use the service-role key server-side and respect `notification_preferences` plus `conversation_mutes`.
- Restrict message reads to conversation members.
- Use the `create_direct_conversation`, group conversation, and message RLS paths so blocked users cannot start or continue chats.
- Restrict event chat to event attendees.
- Route all event attendance and waitlist writes through the locked lifecycle RPCs. Direct
  authenticated inserts, updates, and deletes on `event_attendees` and `event_waitlist` are denied.
- Use organizer/admin RPCs for event attendee removal, waitlist removal and promotion, and court booking confirmation.
- Review reports through the admin-only moderation queue before enabling broad public discovery at scale.
- Account deletion must go through the `delete-account` Edge Function; never expose auth admin APIs in the client.
- Run security review on OAuth redirect URLs before App Store submission.

## Court discovery and bookings

- Court distance, discovery filters, opening state, and future availability are calculated by database RPCs.
- Weekly operating hours and closures are publicly readable but writable only by administrators under RLS.
- Authenticated users may read only their own court bookings; administrators retain all-booking read access.
- Direct booking inserts and updates are denied. Booking, cancellation, confirmation, and administrative cancellation use checked `security definer` RPCs.
- `court_bookings_no_overlap` remains the final database-level conflict guarantee for pending and confirmed bookings. The booking RPC additionally locks the court row to serialize competing slot requests.
- User cancellation is limited to pending or confirmed bookings before the court-specific notice deadline. Administrators may cancel active bookings but cannot reopen cancelled bookings.
- SPORTZ does not process court payments. A court must declare `external` payment or `not_required`.
