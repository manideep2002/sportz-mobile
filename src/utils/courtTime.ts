import type { CourtBooking } from '@/types/domain';
import { activeLocale } from '@/i18n';

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

export const clampCourtBookingWindowDays = (value: number) => {
  if (!Number.isFinite(value)) return 30;
  return Math.min(90, Math.max(1, Math.trunc(value)));
};

export const addCourtDateKeyDays = (dateKey: string, amount: number) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount, 12));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('-');
};

export const buildCourtBookingDateKeys = (
  nowIso: string,
  timeZone: string,
  bookingWindowDays: number
) => {
  const start = courtDateKey(nowIso, timeZone);
  const days = clampCourtBookingWindowDays(bookingWindowDays);
  return Array.from({ length: days }, (_, index) => addCourtDateKeyDays(start, index));
};

export const formatCourtDateKey = (dateKey: string) =>
  new Intl.DateTimeFormat(activeLocale(), {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  }).format(new Date(`${dateKey}T12:00:00.000Z`));

export const formatCourtDate = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat(activeLocale(), {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  }).format(new Date(iso));

export const formatCourtTime = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat(activeLocale(), {
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
