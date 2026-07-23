# Performance

- Use native lists (`FlatList`) for high-volume feeds, search results, comments, and messages.
- Keep heavy media outside React render trees and cache using CDN URLs from Supabase Storage.
- Use image thumbnails for feed cards and full media only on detail screens.
- Never render raw Supabase image uploads directly in hot paths; use `mediaVariants` to request transformed CDN URLs for avatars, profile covers, feed images, stories, event covers, messages, and full-screen viewers.
- Service reads use cache-aside through `hotCacheService`: memory first, persisted TTL cache second, then Supabase, with write-back before returning.
- Keep cache TTLs short for mutable objects: session lookups are memory-only, profiles are cached for minutes, and post details are cached briefly per viewer.
- Username availability checks call the public `username-availability` Edge Function, which keeps a warm in-memory Bloom filter per Deno worker and only queries Postgres when the filter returns a possible match or the app forces an exact submit-time check.
- New rows in append-heavy app tables use `public.uuid_generate_v7()` IDs, giving posts, comments, messages, stories, notifications, follows, bookings, and feed jobs time-sortable primary keys with better B-tree locality than random UUIDv4.
- Keep realtime subscriptions scoped to the active conversation/event.
- Persist TanStack Query cache with AsyncStorage for offline reads.
- Use optimistic updates for likes and chat sends.
- Avoid re-rendering tab roots by keeping service state in React Query and local toggles in Zustand.
- Use pagination (`range`) for feed, messages, events, comments, and notifications before production traffic.
- Add server-side indexes for sort/filter columns; current schema includes feed, message, event, notification, and geospatial indexes. Keep using `created_at` indexes for explicit chronological queries, and use UUIDv7 primarily for insert locality and cursor-friendly IDs.
- Home feeds use a hybrid fan-out cache: standard accounts enqueue `feed_fanout_jobs` on post creation and the `feed-fanout` Edge Function writes `feed_items`; high-follower accounts are merged on read via `list_home_feed`.
- `feed-fanout`, `push-fanout`, and `process-social-events` run on pg_cron schedules registered by migration `20260722000001_feed_fanout_pg_cron_scheduler.sql`. On the free tier (pg_cron unavailable), configure an external cron to POST each function — see `docs/SETUP.md §8`.
- Use EAS production builds for Hermes and release-mode performance.
