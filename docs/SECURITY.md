# Security

- Never expose service-role keys in the app.
- Use only `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` on the client.
- Keep all authorization in Supabase row-level security policies.
- Use signed URLs for private media if private stories, paid events, or team-only uploads are introduced.
- Rate-limit edge functions for search, push notification fan-out, and media processing.
- Validate form input on client with TypeScript and on backend with database constraints.
- Store push tokens in `push_tokens` with RLS scoped to the current user.
- Restrict message reads to conversation members.
- Restrict event chat to event attendees.
- Add moderation queues before enabling broad public discovery at scale.
- Run security review on OAuth redirect URLs before App Store submission.
