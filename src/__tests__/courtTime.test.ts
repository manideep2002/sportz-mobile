import type { CourtBooking } from '@/types/domain';
import {
  bookingMatchesFilter,
  buildCourtBookingDateKeys,
  clampCourtBookingWindowDays,
  courtDateKey,
  formatCourtTime
} from '@/utils/courtTime';

const booking = {
  status: 'confirmed',
  startsAt: '2026-07-25T18:30:00.000Z',
  endsAt: '2026-07-25T19:30:00.000Z'
} as CourtBooking;

describe('court timezone and booking sections', () => {
  it('uses the court timezone for date and time rendering', () => {
    expect(courtDateKey(booking.startsAt, 'Asia/Kolkata')).toBe('2026-07-26');
    expect(formatCourtTime(booking.startsAt, 'Asia/Kolkata')).toMatch(/12:00\s*am/i);
    expect(courtDateKey(booking.startsAt, 'America/New_York')).toBe('2026-07-25');
  });

  it('classifies upcoming, confirmed, cancelled, and past bookings', () => {
    const now = new Date('2026-07-24T00:00:00.000Z');
    expect(bookingMatchesFilter(booking, 'upcoming', now)).toBe(true);
    expect(bookingMatchesFilter(booking, 'confirmed', now)).toBe(true);
    expect(bookingMatchesFilter(booking, 'pending', now)).toBe(false);
    expect(bookingMatchesFilter({ ...booking, status: 'cancelled' }, 'cancelled', now)).toBe(true);
    expect(bookingMatchesFilter(booking, 'past', new Date('2026-07-26T00:00:00.000Z'))).toBe(true);
  });

  it.each([
    [1, '2026-07-26'],
    [7, '2026-08-01'],
    [30, '2026-08-24'],
    [90, '2026-10-23']
  ])('builds an exact %i-day court-local booking window', (days, expectedLastDay) => {
    const keys = buildCourtBookingDateKeys(
      '2026-07-25T20:30:00.000Z',
      'Asia/Kolkata',
      days
    );

    expect(keys).toHaveLength(days);
    expect(keys[0]).toBe('2026-07-26');
    expect(keys[keys.length - 1]).toBe(expectedLastDay);
  });

  it('uses the court timezone at date boundaries and enforces backend limits', () => {
    expect(buildCourtBookingDateKeys('2026-07-26T00:30:00.000Z', 'America/New_York', 1))
      .toEqual(['2026-07-25']);
    expect(clampCourtBookingWindowDays(0)).toBe(1);
    expect(clampCourtBookingWindowDays(120)).toBe(90);
  });
});
