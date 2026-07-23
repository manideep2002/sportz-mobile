import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/migrations/20260723000001_event_waitlist_lifecycle.sql'
);

describe('event waitlist database lifecycle migration', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');

  it('serializes every capacity-changing operation on the event row', () => {
    expect(sql).toMatch(/create or replace function public\.join_sport_event[\s\S]*?for update;/i);
    expect(sql).toMatch(/create or replace function public\.leave_sport_event[\s\S]*?for update;/i);
    expect(sql).toMatch(/create or replace function public\.promote_event_waitlist_locked[\s\S]*?for update;/i);
  });

  it('enforces capacity independently of UI and RPC callers', () => {
    expect(sql).toContain('event_attendees_enforce_capacity');
    expect(sql).toMatch(/if existing_going >= event_capacity then/i);
    expect(sql).toMatch(/before insert or update of event_id, status on public\.event_attendees/i);
  });

  it('prevents duplicate active waitlist entries and supports leaving', () => {
    expect(sql).toMatch(/create unique index[\s\S]*?where status = 'waiting'/i);
    expect(sql).toContain('public.leave_event_waitlist');
  });

  it('promotes in FIFO order and emits a routed promotion notification', () => {
    expect(sql).toMatch(/order by created_at, id[\s\S]*?for update;/i);
    expect(sql).toContain('public.notify_event_waitlist_promotion');
    expect(sql).toContain("'source', 'waitlist_promotion'");
    expect(sql).toContain("'event_waitlist_promotion:event:'");
  });

  it('removes direct authenticated writes so lifecycle RPCs cannot be bypassed', () => {
    expect(sql).toContain('drop policy if exists "users manage own rsvp"');
    expect(sql).toContain('drop policy if exists "users manage own event waitlist rows"');
    expect(sql).toMatch(/grant execute on function public\.join_sport_event\(uuid\) to authenticated/i);
    expect(sql).not.toMatch(/grant (insert|update|delete).*event_(attendees|waitlist)/i);
  });

  it('defines capacity-safe organizer removal and manual promotion behavior', () => {
    expect(sql).toContain('public.remove_event_attendee');
    expect(sql).toContain('public.remove_event_waitlist_user');
    expect(sql).toContain('public.promote_event_waitlist_user');
    expect(sql).toContain('No event space is available for manual promotion.');
  });
});
