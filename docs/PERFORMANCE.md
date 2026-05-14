# Performance

- Use native lists (`FlatList`) for high-volume feeds, search results, comments, and messages.
- Keep heavy media outside React render trees and cache using CDN URLs from Supabase Storage.
- Use image thumbnails for feed cards and full media only on detail screens.
- Keep realtime subscriptions scoped to the active conversation/event.
- Persist TanStack Query cache with AsyncStorage for offline reads.
- Use optimistic updates for likes and chat sends.
- Avoid re-rendering tab roots by keeping service state in React Query and local toggles in Zustand.
- Use pagination (`range`) for feed, messages, events, comments, and notifications before production traffic.
- Add server-side indexes for sort/filter columns; current schema includes feed, message, event, notification, and geospatial indexes.
- Use EAS production builds for Hermes and release-mode performance.
