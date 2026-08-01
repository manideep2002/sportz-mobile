# Community lifecycle and canonical links

## Community administration design

`communities` is the lifecycle root for both groups and pages. Memberships use
`owner`, `admin`, `member`, and `follower`; settings mutations and ownership
transfer are RPC-only operations. Owners control settings, branding, role
transitions, archive state, and deletion. Administrators can invite/remove
members, review join requests, moderate community posts, and read the audit log.

Ownership transfer locks the community and its roster, promotes the chosen
member, then demotes the prior owner in one transaction. The final-owner trigger
rejects direct removal, demotion, and departure. There is no implicit successor.

Archiving preserves members and existing content but rejects new membership
rows, invitations, join requests, community posts, and group events at the
database boundary. Restoring is explicit and owner-only. Deletion is permanent:
the community's cascading content and membership data is removed, while the
redacted deletion audit entry survives with a null community foreign key.

Private community metadata remains protected by membership-aware RLS. Changing
a public group to private therefore removes discovery/content access for
non-members as soon as the settings transaction commits.

Branding lives in the public `community-media` bucket under opaque
`<community-id>/...` paths. Only owners can insert, update, or delete those
objects. Do not include member names, private rules, or offer terms in filenames.

Page identity is deliberately disabled. Page administrators publish with their
own profile as `posts.author_id`; the page is represented by `community_id`.
The database rejects attempts to publish as another user. This preserves one
consistent identity in feeds, reports, notifications, and moderation history.

## Canonical URLs

The canonical host defaults to `https://sportz.app` and is configurable with
`EXPO_PUBLIC_CANONICAL_WEB_URL`.

| Entity | Path |
| --- | --- |
| Post | `/posts/:id` |
| Profile | `/profiles/:id` |
| Event | `/events/:id` |
| Court | `/courts/:id` |
| Group | `/groups/:id` |
| Page | `/pages/:id` |
| Recipient-protected community invite | `/invitations/community/:id` |

Chats are not shareable. Current conversations have membership authorization,
but no purpose-built invite token, expiry, or revocation model.

Cold and warm HTTPS/custom-scheme links use the same parser. If authentication
or profile completion is required, the URL is persisted in AsyncStorage and
consumed only after the authenticated navigation tree is ready. Resource screens
use controlled unavailable states for deleted, blocked, private, or invalid IDs.

The web fallback and link-preview metadata are intentionally generic; they do
not fetch or render entity names, chat text, private media URLs, or membership
details. Configure the canonical host to serve `public/link-fallback.html` for
entity paths while preserving `/.well-known/*`.

## Association deployment

See [APP_LINKS.md](APP_LINKS.md) for the protected release inputs, generated
association artifacts, required HTTPS/MIME/cache/no-redirect hosting rules, and
signed iOS/Android verification commands. Association endpoint files are deliberately
not checked in with placeholders; release CI generates and validates them from the
real signing identities before deployment.
