# SPORTZ - Sports Social Platform

Native Expo + React Native implementation of the provided HTML prototype. This project keeps the dark sports aesthetic, orange accent system, compact card layout, bottom create action, profile/stat surfaces, social feed, events, courts, messaging, notifications, and community flows as reusable native components.

## Backend Choice

SPORTZ uses Supabase because the product needs a relational social graph: followers, posts, comments, likes, event attendees, court availability, message membership, read receipts, notifications, storage, row-level security, and realtime updates. Postgres with RLS and Supabase Realtime is a cleaner fit than modeling the same joins in Firebase documents.

## Phase 1 - Analysis, Design System, Architecture

- Extracted colors, typography, spacing, radii, shadows, badges, cards, chips, inputs, bottom navigation, stories, post cards, event cards, court map, chat bubbles, and settings rows from `sportz_app.html`.
- Centralized design tokens in `src/design/tokens.ts`.
- Created scalable app layers:
  - `src/components`: reusable native UI and feature components.
  - `src/screens`: route-level features.
  - `src/services`: Supabase API boundary.
  - `src/hooks`: React Query and realtime hooks.
  - `src/store`: Zustand state.
  - `supabase`: SQL schema, storage policies, seed data.

## Phase 2 - Components, Navigation, Theme

- `src/navigation/RootNavigator.tsx`: auth/app split.
- `src/navigation/MainTabs.tsx`: SPORTZ bottom tabs with centered create action.
- `src/navigation/CreateActionSheet.tsx`: native bottom sheet for post/event/community actions.
- `src/components/ui`: AppText, Button, Card, Avatar, Badge, Chip, Input, BottomSheet, segmented control, stat cards.
- `src/design/theme.ts`: React Navigation dark/light themes.

## Phase 3 - Authentication

- Email/password: `src/services/authService.ts`.
- Google: Expo Auth Session ID token flow.
- Apple: Expo Apple Authentication ID token flow for iOS.
- Password reset: `ForgotPasswordScreen`.
- Session persistence: Supabase auth with React Native AsyncStorage and app-state auto refresh.

## Phase 4 - Feed and Social

- Feed, stories, live banner, posts, optimistic likes, post detail, comments, create post.
- Files:
  - `src/screens/feed/*`
  - `src/components/feed/*`
  - `src/hooks/useFeed.ts`
  - `src/services/postService.ts`

## Phase 5 - Events and Courts

- Event list, calendar strip, create event, event detail, join/RSVP hooks.
- Court discovery map preview, nearby court listings, hire-athlete path.
- Files:
  - `src/screens/events/*`
  - `src/screens/courts/CourtsScreen.tsx`
  - `src/components/events/EventCard.tsx`
  - `src/components/courts/*`

## Phase 6 - Messaging and Notifications

- Conversation list, realtime chat subscription, optimistic sends, notification list, mark-all-read.
- Files:
  - `src/screens/messages/*`
  - `src/screens/notifications/NotificationsScreen.tsx`
  - `src/hooks/useMessages.ts`
  - `src/hooks/useRealtimeMessages.ts`
  - `src/hooks/useNotifications.ts`

## Phase 7 - Backend Integration

- Schema: `supabase/schema.sql`
- Storage buckets/policies: `supabase/storage.sql`
- Seed courts: `supabase/seed.sql`
- API services live in `src/services`.
- Environment variables are defined in `.env.example`.

## Phase 8 - Testing and Optimization

- Type check: `npm run typecheck`
- Unit tests: `npm test`
- React Query persistent cache provides offline read caching for feed/events/courts/messages.
- Optimistic UI is used for likes and chat sends.
- Realtime is scoped per conversation to avoid broad subscriptions.

## Phase 9 - Production Deployment

- EAS config: `eas.json`
- OTA updates: `expo-updates` configured with runtime version policy.
- Build commands are in `docs/DEPLOYMENT.md`.

## Install

```bash
npm install
npx expo install --fix
```

Create `.env`:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Fill in:

```text
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
```

## Run

```bash
npm run start
```

Then press `i` for iOS simulator, `a` for Android emulator, or scan the Expo QR code.

## Build

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile production
eas build --platform ios --profile production
```

## Source Tree

```text
sportz-mobile/
  src/bootstrap/           app bootstrap and providers
  src/components/ui/        design-system primitives
  src/components/feed/      stories, posts, live cards, court artwork
  src/components/events/    event cards
  src/components/courts/    map preview, court cards
  src/components/messages/  rows and bubbles
  src/components/community/ group/page cards
  src/design/               tokens and navigation themes
  src/hooks/                React Query, realtime, push hooks
  src/lib/                  Supabase, env, query cache, notifications
  src/navigation/           root stack, tabs, create sheet, route types
  src/screens/              native feature screens
  src/services/             API/service layer
  src/store/                Zustand stores
  src/types/                domain and database types
  supabase/                 schema, storage policies, seed
  docs/                     setup, deployment, security, performance
```
