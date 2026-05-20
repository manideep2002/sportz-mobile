# SPORTZ Mobile — Codebase Analysis

> Generated: 2026-05-20. Use this document as persistent context for future agent sessions and onboarding.

## 1. Repository Overview

### Top-level layout

| Path | Purpose |
|------|---------|
| `src/` | Application source (TypeScript/React Native) |
| `supabase/` | Postgres schema, storage policies, seed data |
| `docs/` | Setup, architecture, security, performance, testing, deployment |
| `assets/` | Static assets |
| `android/` | Native Android project (gitignored; generated via prebuild) |
| `.expo/` | Expo dev cache (gitignored) |
| `index.js` | App entry (registers root component) |
| `app.config.js` / `app.json` | Expo app configuration |
| `package.json` / `package-lock.json` | Dependencies and scripts |
| `eas.json` | EAS Build profiles |
| `babel.config.js` / `metro.config.js` | Bundler config |
| `jest.config.js` / `tsconfig.json` | Test and TypeScript config |
| `.env.example` | Required environment variables template |

### Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript (strict mode) |
| UI framework | React 18.2 + React Native 0.72 |
| Mobile platform | Expo SDK 49 |
| Navigation | React Navigation 6 (native stack + bottom tabs) |
| Server state | TanStack React Query 5 + AsyncStorage persistence |
| Client state | Zustand 4 |
| Backend | Supabase (Postgres, Auth, Realtime, Storage, RLS) |
| Forms / validation | react-hook-form, zod |
| Maps / location | react-native-maps, expo-location |
| Push | expo-notifications |
| Build / deploy | EAS CLI, expo-updates (OTA) |

### Project purpose

**SPORTZ** is a native sports social platform: feed, stories, events, courts, messaging, notifications, community groups/pages, and athlete profiles. It implements an HTML prototype as a production-oriented Expo app with a Supabase relational backend (followers, posts, likes, events, courts, conversations, RLS, realtime).

---

## 2. Architecture & Structure

### Pattern

**Client–BaaS layered architecture** (not microservices):

```
index.js → App.tsx → AppProviders → RootNavigator
                ↓
         Screens (feature UI)
                ↓
    Hooks (React Query / realtime)
                ↓
    Services (Supabase API boundary)
                ↓
         supabase.ts → Supabase cloud
```

Screens and components **must not** call the Supabase client directly; they go through `src/services/*` and hooks.

### Entry points

| File | Role |
|------|------|
| `index.js` | Polyfills, `registerRootComponent(App)` |
| `src/bootstrap/App.tsx` | Fonts, auth bootstrap, splash, push setup |
| `src/bootstrap/AppProviders.tsx` | GestureHandler, SafeArea, PersistQueryClient |
| `src/navigation/RootNavigator.tsx` | Auth vs App stack split by `profile` |
| `src/navigation/MainTabs.tsx` | Feed, Events, Create (sheet), Messages, Profile |

### Module map

| Module | Location | Responsibility |
|--------|----------|----------------|
| Design system | `src/design/tokens.ts`, `theme.ts` | Colors, typography, spacing, nav themes |
| UI primitives | `src/components/ui/` | Button, Card, Input, BottomSheet, etc. |
| Feature components | `src/components/{feed,events,courts,messages,community,notifications}/` | Domain-specific UI |
| Screens | `src/screens/{auth,feed,events,courts,messages,notifications,community,profile,settings}/` | 23 route-level screens |
| Services | `src/services/` (10 modules) | Auth, posts, events, courts, messages, profiles, notifications, search, storage, realtime |
| Hooks | `src/hooks/` (9 files) | Query keys, mutations, optimistic updates, realtime |
| Stores | `src/store/` (4 files) | auth, ui, feed, messaging (Zustand) |
| Lib | `src/lib/` | supabase client, env, queryClient, notifications |
| Types | `src/types/domain.ts`, `database.types.ts` | Domain + DB shapes |
| Mock fallback | `src/data/mockData.ts` | Demo data when Supabase env unset |
| Backend SQL | `supabase/schema.sql`, `storage.sql`, `seed.sql` | Schema, buckets, seed courts |

### Navigation structure

- **Auth stack**: Splash → Login → Register → ForgotPassword
- **App stack** (modal-style pushes): Search, Courts, Community, Notifications, Settings, EditProfile, EventDetail, CreateEvent, UserProfile, Chat, FindPlayers, CreatePost, PostDetail, GroupDetail, PageDetail
- **Main tabs**: Feed, Events, centered Create (opens `CreateActionSheet`), Messages, Profile

### Key configuration

- `app.config.js` — injects `EXPO_PUBLIC_*` from `.env` into `expo.extra`
- `src/lib/env.ts` — reads env, detects placeholder values, sets `isSupabaseConfigured`
- Path alias `@/*` → `src/*` (tsconfig + babel module-resolver)

---

## 3. Dependencies

### Direct production dependencies (high level)

- **Expo ecosystem**: expo 49, expo-auth-session, expo-apple-authentication, expo-notifications, expo-location, expo-image-picker, etc.
- **Navigation**: @react-navigation/native, bottom-tabs, native-stack
- **Data**: @supabase/supabase-js, @tanstack/react-query (+ persist), zustand
- **UI**: lucide-react-native, react-native-maps, react-native-reanimated, gesture-handler

### Versioning concerns

- Many packages use **`"latest"`** in `package.json` (fonts, supabase-js, zod, zustand, date-fns, lucide, react-hook-form, testing libs). This hurts reproducible builds; prefer pinned semver.
- **Expo SDK 49** / **RN 0.72** are behind current Expo (52+) — plan upgrade path for security and tooling.
- `npm audit` (2026-05-20): **41 vulnerabilities** — 31 high, 5 moderate, 5 low, 0 critical. Most are transitive (jest-expo → jsdom, @expo/plist → @xmldom/xmldom). Fixes often require `npm audit fix --force` with breaking Expo/jest upgrades.

### Indirect dependency scale

~1,862 total packages (1,572 prod + 276 dev per audit metadata).

---

## 4. Code Quality & Patterns

### Design patterns in use

| Pattern | Where |
|---------|--------|
| **Service layer** | `src/services/*` object exports (`postService`, `authService`, …) |
| **Repository-style API boundary** | Services wrap Supabase; screens use hooks |
| **Custom hooks + query keys** | `useFeed`, `useMessages`, `feedKeys`, etc. |
| **Optimistic updates** | `useOptimisticPostLike`, chat sends |
| **Fallback / demo mode** | `env.isSupabaseConfigured` → `mockData` |
| **Global client state** | Zustand stores for auth, UI, messaging |
| **Provider composition** | `AppProviders` wraps query persistence + safe area |

### Code style

- TypeScript `strict: true`
- Lint via `expo lint` (no standalone `.eslintrc` in repo root)
- No Prettier config found
- `@/` path alias consistently used

### Notable files

| File | ~Lines | Note |
|------|--------|------|
| `src/data/mockData.ts` | ~505 | Large demo dataset; central fallback |
| `supabase/schema.sql` | ~462 | Full production schema + RLS |
| `src/types/database.types.ts` | Hand-maintained DB types | Script exists for generated types |

### Anti-patterns / tech debt

- **`any` casts** in service mappers (`postService`, `eventService`, `messageService`, `notificationService`, `realtimeService`) — weakens strict typing
- **Mock fallback on API error** (e.g. `postService` returns `posts` if Supabase errors) — can hide production failures
- **Hardcoded UI**: Messages tab `tabBarBadge: 2` in `MainTabs.tsx`
- **Create tab** uses `FeedScreen` as placeholder component (tab press prevented; sheet handles UX)
- **`database.generated.ts`** referenced in npm script but may be missing; hand types in `database.types.ts`

---

## 5. Testing & Documentation

### Tests

| Type | Status |
|------|--------|
| Unit | `src/__tests__/tokens.test.ts` only (design token assertions) |
| Integration / E2E | None in repo |
| Coverage | Minimal (~1 test suite) |

**Jest issue**: `setupFilesAfterEnv` references `@testing-library/react-native/extend-expect` which is **not found** — `npm test` fails until config is fixed or dependency installed correctly.

### Documentation quality

| Doc | Quality |
|-----|---------|
| `README.md` | Strong — phases, tree, install, env, build |
| `docs/ARCHITECTURE.md` | Clear module/backend map |
| `docs/SETUP.md`, `DEPLOYMENT.md`, `SECURITY.md`, `PERFORMANCE.md`, `TESTING.md` | Good operational guides |
| Inline code comments | Sparse; code is mostly self-explanatory |

---

## 6. Potential Issues

### Security

| Risk | Severity | Detail |
|------|----------|--------|
| Secrets in repo | Low | `.env` gitignored; `.env.example` has placeholders only |
| Client key exposure | Expected | Only `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — correct for Supabase anon/publishable key |
| RLS reliance | Medium | Authorization must stay in Supabase policies (~60 RLS/policy statements in schema); client checks are not enough |
| OAuth redirect URLs | Medium | Documented need for review before App Store |
| Dependency CVEs | Medium–High | 31 high-severity transitive issues via Expo/jest chain |

### Performance

- Documented guidance: FlatList, pagination, scoped realtime, query cache (24h maxAge)
- Risk: screens using `.map()` instead of virtualized lists at scale (verify per screen before production traffic)
- PostGIS + geospatial indexes in schema for courts — good

### Maintainability

- Dual code paths (Supabase + mock) in every service increases complexity
- SDK 49 + `latest` deps → upgrade friction
- Thin test coverage → regressions likely on refactors
- `feedStore` vs React Query overlap — some state duplicated between Zustand and Query

---

## 7. Quick Reference

### npm scripts

```bash
npm run start      # Expo dev server
npm run typecheck  # tsc --noEmit
npm run lint       # expo lint
npm test           # jest (currently broken setup)
npm run supabase:types  # generate DB types locally
```

### Environment variables

`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, Google OAuth client IDs (iOS/Android/Web), `EXPO_PUBLIC_APP_SCHEME`, `EXPO_PUBLIC_MAP_PROVIDER`

### Supabase tables (core)

profiles, follows, stories, posts, comments, likes, sport_events, event_attendees, event_messages, courts, communities, community_members, conversations, conversation_members, messages, message_receipts, notifications, push_tokens

### Realtime tables

messages, notifications, event_attendees, event_messages

### Storage buckets

avatars, post-media, story-media, event-covers

---

## Recommended next steps (for maintainers)

1. Fix Jest setup (`extend-expect` path or remove deprecated setup).
2. Pin `latest` dependencies to explicit versions.
3. Plan Expo SDK upgrade and run `npm audit fix` in a controlled branch.
4. Expand tests: services (mock Supabase), hooks (React Query), critical screens.
5. Generate `database.generated.ts` from Supabase CLI and reduce `any` in mappers.
6. Replace hardcoded message badge with store/query-driven count.
7. Consider failing loudly when Supabase is configured but API returns errors (vs silent mock fallback).
