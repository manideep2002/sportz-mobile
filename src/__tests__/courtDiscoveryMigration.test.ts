import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/migrations/20260723000002_court_discovery_booking_lifecycle.sql'
);
const cancellationFixPath = path.resolve(
  process.cwd(),
  'supabase/migrations/20260723000003_fix_court_cancellation_reason.sql'
);
const openStateFixPath = path.resolve(
  process.cwd(),
  'supabase/migrations/20260723000004_separate_court_open_state.sql'
);

describe('court discovery and booking lifecycle migration', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const cancellationFixSql = fs.readFileSync(cancellationFixPath, 'utf8');
  const openStateFixSql = fs.readFileSync(openStateFixPath, 'utf8');

  it('adds timezone-aware operating hours, closures, and court policies', () => {
    expect(sql).toContain('create table if not exists public.court_operating_hours');
    expect(sql).toContain('create table if not exists public.court_closures');
    expect(sql).toContain("add column if not exists timezone text not null default 'Asia/Kolkata'");
    expect(sql).toContain('slot_duration_minutes integer not null default 60');
    expect(sql).toContain("payment_policy in ('external', 'not_required')");
    expect(sql).toContain('pg_timezone_names');
  });

  it('calculates distance and applies discovery filters on the server', () => {
    expect(sql).toContain('public.discover_courts');
    expect(sql).toMatch(/st_distance\([\s\S]*?\/ 1000\.0/i);
    expect(sql).toContain('max_distance_km');
    expect(sql).toContain('max_price_cents');
    expect(sql).toContain('require_open_now');
    expect(sql).toContain('require_future_availability');
    expect(sql).toMatch(/order by d\.calculated_distance_km asc nulls last/i);
    expect(openStateFixSql).not.toMatch(/c\.booking_enabled/i);
  });

  it('generates only operating-hour slots that are not closed or occupied', () => {
    expect(sql).toContain('public.get_court_availability');
    expect(sql).toMatch(/join public\.court_operating_hours[\s\S]*?not h\.is_closed/i);
    expect(sql).toMatch(/public\.court_closures[\s\S]*?tstzrange/i);
    expect(sql).toMatch(/public\.court_bookings[\s\S]*?booking\.status in \('pending', 'confirmed'\)/i);
  });

  it('serializes booking and preserves the exclusion conflict guarantee', () => {
    expect(sql).toMatch(/create function public\.book_court_slot[\s\S]*?for update;/i);
    expect(sql).toContain('when exclusion_violation then');
    expect(sql).toContain('That slot was just booked.');
    expect(sql).not.toContain('drop constraint if exists court_bookings_no_overlap');
  });

  it('enforces user cancellation policy and preserves admin management', () => {
    expect(sql).toContain('public.cancel_court_booking');
    expect(sql).toMatch(/selected_booking\.starts_at - make_interval\(hours => notice_hours\)/i);
    expect(sql).toContain('Only admins can manage court bookings.');
    expect(sql).toContain('Cancelled bookings cannot be reopened.');
    expect(cancellationFixSql).toContain('provided_reason text := cancellation_reason');
    expect(cancellationFixSql).toContain("cancellation_reason = nullif(left(trim(provided_reason), 240), '')");
  });

  it('removes bypass writes and adds RLS for schedule administration', () => {
    expect(sql).toContain('drop policy if exists "users create own court bookings"');
    expect(sql).toContain('drop policy if exists "users update own court bookings"');
    expect(sql).toContain('drop policy if exists "admins update all court bookings"');
    expect(sql).toContain('create policy "admins manage court operating hours"');
    expect(sql).toContain('create policy "admins manage court closures"');
    expect(sql).toMatch(/grant execute on function public\.book_court_slot[\s\S]*?to authenticated/i);
  });
});
