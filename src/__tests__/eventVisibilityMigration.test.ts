import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/migrations/20260801000001_reconcile_event_visibility.sql'
);
const manageEventPath = path.resolve(process.cwd(), 'src/screens/events/ManageEventScreen.tsx');
const eventDetailPath = path.resolve(process.cwd(), 'src/screens/events/EventDetailScreen.tsx');
const searchMigrationPath = path.resolve(
  process.cwd(),
  'supabase/migrations/20260801000003_reconcile_event_search_visibility.sql'
);
const validationMigrationPath = path.resolve(
  process.cwd(),
  'supabase/migrations/20260801000004_validate_event_visibility_scope.sql'
);

describe('event visibility reconciliation migration', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const manageEventSource = fs.readFileSync(manageEventPath, 'utf8');
  const eventDetailSource = fs.readFileSync(eventDetailPath, 'utf8');
  const searchSql = fs.readFileSync(searchMigrationPath, 'utf8');
  const validationSql = fs.readFileSync(validationMigrationPath, 'utf8');

  it('keeps public and follower events independent while limiting community events to group or invite', () => {
    expect(sql).toMatch(/community_id is null and visibility in \('public', 'followers', 'invite'\)/i);
    expect(sql).toMatch(/community_id is not null and visibility in \('group', 'invite'\)/i);
    expect(validationSql).toMatch(/set visibility = 'group'[\s\S]*?community_id is not null/i);
    expect(validationSql).toMatch(/validate constraint sport_events_visibility_scope_valid/i);
  });

  it('authorizes participation with the same public, follower, group, and invitation rules used for visibility', () => {
    expect(sql).toContain("e.visibility = 'public'");
    expect(sql).toMatch(/e\.visibility = 'followers'[\s\S]*?public\.user_follows/i);
    expect(sql).toMatch(/e\.visibility = 'group'[\s\S]*?public\.is_community_member/i);
    expect(sql).toMatch(/e\.visibility = 'invite'[\s\S]*?public\.event_invitations/i);
  });

  it('uses event-id-aware visibility in global event search', () => {
    expect(searchSql).toContain('public.can_access_sport_event(e.id)');
    expect(searchSql).toContain('public.can_discover_sport_event(e.organizer_id, e.visibility)');
    expect(searchSql).toContain('position(legacy_filter in search_definition) = 0');
  });

  it('serializes joins and RSVP writes against the event row', () => {
    expect(sql).toMatch(/create or replace function public\.join_sport_event[\s\S]*?for update;/i);
    expect(sql).toMatch(/create or replace function public\.set_sport_event_rsvp[\s\S]*?for update;/i);
    expect(sql).toMatch(/on conflict\(event_id, user_id\) do update/i);
  });

  it('preserves editable group or invite visibility and guards duplicate client actions', () => {
    expect(manageEventSource).toContain("visibility,");
    expect(manageEventSource).not.toMatch(/visibility:\s*event\.communityId\s*\?\s*'group'/);
    expect(manageEventSource).toContain('Invite-only');
    expect(eventDetailSource).toContain('participationActionInFlightRef.current');
  });
});
