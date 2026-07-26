# Athlete offers and structured statistics

## Hiring domain

- `teams` is the private workflow identity for a team or organization. It can link to a public Page community.
- Page owners/admins synchronize to `team_managers`; manager roles are owner, manager, coach, and recruiter.
- `team_offers` stores private terms, optional compensation, dates, expiry, and terminal audit timestamps.
- The state machine is `draft → sent → accepted | declined | withdrawn | expired`; terminal states cannot transition.
- Every transition appends `team_offer_history`. Accept/withdraw lock the offer row, and acceptance writes `team_roster` in the same transaction.
- RLS exposes an offer only to its recipient, sender, current authorized managers, and moderators. Public team/roster records never include offer terms.
- Blocking is checked at creation, sending, and acceptance. A scheduled expiry function closes stale sent offers.
- Notifications use `entity_type = team_offer` and deep-link to the private detail screen. Offers can be reported through the existing moderation queue.

## Statistics domain

- `athlete_seasons` provides sport-specific, data-backed labels and date boundaries.
- `athlete_matches` records opponent, team, score/result, and verification status/source.
- `sport_stat_definitions` defines the allowed fields, types, bounds, aggregation behavior, and display order for basketball, football, and cricket.
- `athlete_match_stats` stores values against those definitions. Database and client validators reject missing or cross-sport fields.
- `athlete_stat_aggregates` deterministically derives totals, averages, and personal bests from non-rejected records.
- Achievement definitions are rules; awarded achievements are recomputed from structured aggregates.
- Athletes can create their own seasons and self-reported matches. Only moderators or managers of a team whose roster includes the athlete can verify them.
- Free-form stats posts remain shareable presentation content and no longer update profile statistics.

