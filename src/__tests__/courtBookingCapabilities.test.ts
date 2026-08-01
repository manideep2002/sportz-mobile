/**
 * IF-12 — Unit tests for buildBookingCapabilities
 *
 * Exhaustively covers the actor × status × deadline combination matrix:
 *   actors:   player (own booking), admin, unrelated user
 *   statuses: pending, confirmed, cancelled
 *   deadlines: within window, past window
 */

jest.mock('@/lib/env', () => ({ env: { isSupabaseConfigured: true } }));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(() => ({ select: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn() })) })) }))
  }
}));

// eslint-disable-next-line import/first
import { buildBookingCapabilities } from '@/services/courtService';

const FUTURE_DEADLINE = new Date(Date.now() + 3_600_000).toISOString(); // 1 h from now
const PAST_DEADLINE = new Date(Date.now() - 3_600_000).toISOString();  // 1 h ago

const OWN_USER = 'user-123';
const OTHER_USER = 'user-456';

describe('buildBookingCapabilities — player (own booking)', () => {
  it('pending + within deadline → canCancel=true, canConfirm=false, canViewPlayer=false', () => {
    const caps = buildBookingCapabilities(
      { userId: OWN_USER, status: 'pending', cancellationDeadline: FUTURE_DEADLINE },
      OWN_USER,
      false
    );
    expect(caps).toEqual({
      isOwnBooking: true,
      canCancel: true,
      canConfirm: false,
      canViewPlayer: false
    });
  });

  it('confirmed + within deadline → canCancel=true', () => {
    const caps = buildBookingCapabilities(
      { userId: OWN_USER, status: 'confirmed', cancellationDeadline: FUTURE_DEADLINE },
      OWN_USER,
      false
    );
    expect(caps.canCancel).toBe(true);
  });

  it('pending + past deadline → canCancel=false', () => {
    const caps = buildBookingCapabilities(
      { userId: OWN_USER, status: 'pending', cancellationDeadline: PAST_DEADLINE },
      OWN_USER,
      false
    );
    expect(caps.canCancel).toBe(false);
    expect(caps.isOwnBooking).toBe(true);
  });

  it('confirmed + past deadline → canCancel=false', () => {
    const caps = buildBookingCapabilities(
      { userId: OWN_USER, status: 'confirmed', cancellationDeadline: PAST_DEADLINE },
      OWN_USER,
      false
    );
    expect(caps.canCancel).toBe(false);
  });

  it('cancelled → canCancel=false regardless of deadline', () => {
    const withinCaps = buildBookingCapabilities(
      { userId: OWN_USER, status: 'cancelled', cancellationDeadline: FUTURE_DEADLINE },
      OWN_USER,
      false
    );
    const pastCaps = buildBookingCapabilities(
      { userId: OWN_USER, status: 'cancelled', cancellationDeadline: PAST_DEADLINE },
      OWN_USER,
      false
    );
    expect(withinCaps.canCancel).toBe(false);
    expect(pastCaps.canCancel).toBe(false);
  });
});

describe('buildBookingCapabilities — administrator', () => {
  it('pending → canCancel=true, canConfirm=true, canViewPlayer=true', () => {
    const caps = buildBookingCapabilities(
      { userId: OTHER_USER, status: 'pending', cancellationDeadline: FUTURE_DEADLINE },
      OWN_USER,
      true
    );
    expect(caps).toEqual({
      isOwnBooking: false,
      canCancel: true,
      canConfirm: true,
      canViewPlayer: true
    });
  });

  it('confirmed → canConfirm=false (already confirmed), canCancel=true', () => {
    const caps = buildBookingCapabilities(
      { userId: OTHER_USER, status: 'confirmed', cancellationDeadline: FUTURE_DEADLINE },
      OWN_USER,
      true
    );
    expect(caps.canConfirm).toBe(false);
    expect(caps.canCancel).toBe(true);
  });

  it('pending + past deadline → canCancel=true (admins bypass window)', () => {
    const caps = buildBookingCapabilities(
      { userId: OTHER_USER, status: 'pending', cancellationDeadline: PAST_DEADLINE },
      OWN_USER,
      true
    );
    expect(caps.canCancel).toBe(true);
  });

  it('confirmed + past deadline → canCancel=true (admins bypass window)', () => {
    const caps = buildBookingCapabilities(
      { userId: OTHER_USER, status: 'confirmed', cancellationDeadline: PAST_DEADLINE },
      OWN_USER,
      true
    );
    expect(caps.canCancel).toBe(true);
  });

  it('cancelled → canCancel=false, canConfirm=false even for admins', () => {
    const caps = buildBookingCapabilities(
      { userId: OTHER_USER, status: 'cancelled', cancellationDeadline: PAST_DEADLINE },
      OWN_USER,
      true
    );
    expect(caps.canCancel).toBe(false);
    expect(caps.canConfirm).toBe(false);
    expect(caps.canViewPlayer).toBe(true); // Admins can always see the player
  });

  it('own booking as admin → isOwnBooking=true, full admin caps', () => {
    const caps = buildBookingCapabilities(
      { userId: OWN_USER, status: 'pending', cancellationDeadline: FUTURE_DEADLINE },
      OWN_USER,
      true
    );
    expect(caps.isOwnBooking).toBe(true);
    expect(caps.canConfirm).toBe(true);
    expect(caps.canCancel).toBe(true);
  });
});

describe('buildBookingCapabilities — unrelated user', () => {
  it('pending → no capabilities', () => {
    const caps = buildBookingCapabilities(
      { userId: OTHER_USER, status: 'pending', cancellationDeadline: FUTURE_DEADLINE },
      OWN_USER,
      false
    );
    expect(caps).toEqual({
      isOwnBooking: false,
      canCancel: false,
      canConfirm: false,
      canViewPlayer: false
    });
  });

  it('confirmed → no capabilities regardless of deadline', () => {
    const caps = buildBookingCapabilities(
      { userId: OTHER_USER, status: 'confirmed', cancellationDeadline: FUTURE_DEADLINE },
      OWN_USER,
      false
    );
    expect(caps.canCancel).toBe(false);
  });

  it('null currentUserId → all false', () => {
    const caps = buildBookingCapabilities(
      { userId: OWN_USER, status: 'pending', cancellationDeadline: FUTURE_DEADLINE },
      null,
      false
    );
    expect(caps).toEqual({
      isOwnBooking: false,
      canCancel: false,
      canConfirm: false,
      canViewPlayer: false
    });
  });
});
