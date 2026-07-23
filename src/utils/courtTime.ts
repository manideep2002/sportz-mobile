import type { CourtBooking } from '@/types/domain';

const partsFor = (iso: string, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date(iso));

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
};

export const courtDateKey = (iso: string, timeZone: string) => {
  const parts = partsFor(iso, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const formatCourtDate = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat('en-IN', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  }).format(new Date(iso));

export const formatCourtTime = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat('en-IN', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(new Date(iso));

export type CourtBookingFilter = 'upcoming' | 'pending' | 'confirmed' | 'cancelled' | 'past';

export const bookingMatchesFilter = (
  booking: CourtBooking,
  filter: CourtBookingFilter,
  now = new Date()
) => {
  const ended = new Date(booking.endsAt) <= now;
  if (filter === 'past') return ended && booking.status !== 'cancelled';
  if (filter === 'cancelled') return booking.status === 'cancelled';
  if (ended || booking.status === 'cancelled') return false;
  if (filter === 'upcoming') return true;
  return booking.status === filter;
};

