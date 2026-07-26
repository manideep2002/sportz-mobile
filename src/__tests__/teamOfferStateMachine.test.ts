import fs from 'fs';
import path from 'path';

import { canTransitionOffer, OFFER_TRANSITIONS } from '@/services/teamOfferService';

const migration = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20260727000001_team_offers.sql'),
  'utf8'
);

describe('team offer state machine', () => {
  it('allows only valid non-terminal transitions', () => {
    expect(canTransitionOffer('draft', 'sent')).toBe(true);
    expect(canTransitionOffer('sent', 'accepted')).toBe(true);
    expect(canTransitionOffer('sent', 'declined')).toBe(true);
    expect(canTransitionOffer('sent', 'withdrawn')).toBe(true);
    expect(canTransitionOffer('sent', 'expired')).toBe(true);
    expect(canTransitionOffer('draft', 'accepted')).toBe(false);
    expect(OFFER_TRANSITIONS.accepted).toEqual([]);
    expect(OFFER_TRANSITIONS.withdrawn).toEqual([]);
    expect(OFFER_TRANSITIONS.expired).toEqual([]);
  });

  it('serializes accept and withdraw before checking the current state', () => {
    const respond = migration.match(
      /create or replace function public\.respond_team_offer[\s\S]*?\n\$\$;/
    )?.[0] ?? '';
    const withdraw = migration.match(
      /create or replace function public\.withdraw_team_offer[\s\S]*?\n\$\$;/
    )?.[0] ?? '';
    expect(respond).toMatch(/for update/i);
    expect(withdraw).toMatch(/for update/i);
    expect(respond).toMatch(/status <> 'sent'/i);
    expect(withdraw).toMatch(/status not in \('draft', 'sent'\)/i);
  });

  it('updates the roster in the same acceptance function', () => {
    const respond = migration.match(
      /create or replace function public\.respond_team_offer[\s\S]*?\n\$\$;/
    )?.[0] ?? '';
    expect(respond).toMatch(/insert into public\.team_roster/i);
    expect(respond).toMatch(/source_offer_id/i);
    expect(respond).toMatch(/on conflict \(team_id, athlete_id\) do update/i);
  });

  it('enforces manager authorization, blocking, expiry, and private RLS', () => {
    expect(migration).toContain('public.is_team_manager(target_team_id, current_user_id)');
    expect(migration).toContain('public.users_blocked_each_other(current_user_id, target_recipient_id)');
    expect(migration).toContain('public.expire_team_offers()');
    expect(migration).toContain("'expire-team-offers'");
    expect(migration).toMatch(/team offers are private to participants and managers/i);
    expect(migration).toMatch(/auth\.uid\(\) in \(sender_id, recipient_id\)/i);
    expect(migration).toMatch(/revoke insert, update, delete on public\.team_offers/i);
  });

  it('keeps an immutable audit trail and enables abuse reporting', () => {
    expect(migration).toContain('create table if not exists public.team_offer_history');
    expect(migration).toContain("'offer_accepted'");
    expect(migration).toContain("'offer_withdrawn'");
    expect(migration).toContain("'offer_expired'");
    expect(migration).toContain("'team_offer'");
    expect(migration).toMatch(/reports_entity_type_check/i);
  });
});

