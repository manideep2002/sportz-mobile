import { format } from 'date-fns';

/**
 * Result of parsing a manual date + time string pair.
 * Either a valid `Date` or a human-readable `error`.
 */
export type ManualStartDateResult = { date: Date } | { error: string };

/**
 * Parse a user-entered date (YYYY-MM-DD) and time (HH:mm) into a Date.
 * Returns `{ error }` with a user-facing message when the input is invalid.
 */
export const parseManualStartDate = (dateText: string, timeText: string): ManualStartDateResult => {
  const trimmedDate = dateText.trim();
  const trimmedTime = timeText.trim();
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmedDate);
  if (!dateMatch) {
    return { error: 'Enter the date as YYYY-MM-DD.' };
  }

  const timeMatch = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(trimmedTime);
  if (!timeMatch) {
    return { error: 'Enter the time as HH:mm using 24-hour time.' };
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return { error: 'Enter a valid calendar date.' };
  }

  return { date: parsed };
};

/** Format a Date into a YYYY-MM-DD string for display in date inputs. */
export const formatDateInput = (date: Date): string => format(date, 'yyyy-MM-dd');

/** Format a Date into a HH:mm string for display in time inputs. */
export const formatTimeInput = (date: Date): string => format(date, 'HH:mm');

/** Get a human-readable error message from an unknown thrown value. */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'Please try again.';
};
