# Security

- Never expose service-role keys in the app.
- Use only `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` on the client.
- Keep all authorization in Supabase row-level security policies.
- Use signed URLs for private media if private stories, paid events, or team-only uploads are introduced.
- Rate-limit edge functions for search, push notification fan-out, and media processing.
- Validate form input on client with TypeScript and on backend with database constraints.
- Store push tokens in `push_tokens` with RLS scoped to the current user.
- Send push notifications only from the `push-fanout` Edge Function; it must use the service-role key server-side and respect `notification_preferences` plus `conversation_mutes`.
- Restrict message reads to conversation members.
- Use the `create_direct_conversation`, group conversation, and message RLS paths so blocked users cannot start or continue chats.
- Restrict event chat to event attendees.
- Use organizer/admin RPCs for event attendee removal, waitlist promotion, and court booking confirmation.
- Review reports through the admin-only moderation queue before enabling broad public discovery at scale.
- Account deletion must go through the `delete-account` Edge Function; never expose auth admin APIs in the client.
- Run security review on OAuth redirect URLs before App Store submission.
