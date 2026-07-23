# Architecture

## Client

- Expo React Native with TypeScript.
- React Navigation handles auth stack, app stack, and bottom tabs.
- Zustand handles local auth/UI/messaging state.
- TanStack Query handles API cache, offline persistence, and optimistic mutation state.
- Supabase is isolated behind service modules so screens never call SQL clients directly.

### Auth lifecycle

- `useAuthBootstrap` owns the single application-level Supabase auth subscription.
- `authStore` serializes bootstrap and auth events into explicit signed-out, profile-loading,
  profile-completion, password-recovery, error, and signed-in states.
- A token refresh only replaces the live session. Sign-out and account changes clear the
  persisted React Query client, hot caches, story-seen state, and session messaging/UI state.
- Authenticated users with a missing or generated profile stay signed in and complete their
  profile through the auth gate. The database permits only an authenticated user to insert
  a profile row with their own user ID.

## Feature Modules

- Auth: `src/screens/auth`, `src/services/authService.ts`
- Feed: `src/screens/feed`, `src/services/postService.ts`
- Events: `src/screens/events`, `src/services/eventService.ts`
- Courts: `src/screens/courts`, `src/services/courtService.ts`
- Community: `src/screens/community`
- Messaging: `src/screens/messages`, `src/services/messageService.ts`
- Notifications: `src/screens/notifications`, `src/services/notificationService.ts`
- Profiles: `src/screens/profile`, `src/services/profileService.ts`

## Backend

Supabase tables:

- `profiles`
- `follows`
- `follow_requests`
- `blocks`
- `reports`
- `stories`
- `story_views`
- `story_reactions`
- `story_replies`
- `posts`
- `post_mentions`
- `post_shares`
- `comments`
- `likes`
- `sport_events`
- `event_attendees`
- `event_waitlist`
- `event_messages`
- `courts`
- `court_bookings`
- `communities`
- `community_members`
- `community_invites`
- `conversations`
- `conversation_members`
- `messages`
- `message_receipts`
- `conversation_mutes`
- `notifications`
- `notification_preferences`
- `push_tokens`

Realtime tables:

- `messages`
- `notifications`
- `event_attendees`
- `event_waitlist`
- `event_messages`

Realtime broadcast channels:

- `typing:{conversationId}` for ephemeral typing indicators.

Edge functions:

- `push-fanout` sends Expo push notifications from persisted `notifications`.
- `delete-account` deletes the authenticated Supabase user through the service role.

Storage buckets:

- `avatars`
- `post-media`
- `story-media`
- `event-covers`
- `profile-covers` (private; signed reads are authorized by profile privacy, follow, and block state)
