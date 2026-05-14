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

## Manual QA

- Auth: email login, register, reset, Google, Apple on iOS.
- Feed: infinite scroll, optimistic like rollback, post create, media upload.
- Profiles: edit profile, follow, hireable filters.
- Events: create event, join, RSVP, player count updates, event chat.
- Courts: location permission denied/granted, sport filters, availability labels.
- Messages: realtime receive, optimistic send, read receipts, typing indicators.
- Notifications: push permission, foreground notification, mark all read.
- Offline: launch app offline after a successful online cache fill.
- Dark/light: settings toggle and OS theme behavior.
