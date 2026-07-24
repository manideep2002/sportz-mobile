import {
  activeLocale,
  formatLocalizedCurrency,
  formatLocalizedDate,
  formatLocalizedNumber
} from '@/i18n';

export const compactNumber = (value: number) =>
  formatLocalizedNumber(value, {
    notation: value >= 1000 ? 'compact' : 'standard',
    compactDisplay: 'short',
    maximumFractionDigits: value >= 10000 ? 0 : 1
  });

export const timeAgo = (iso: string) => {
  const elapsedSeconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(elapsedSeconds);
  const [divisor, unit]: [number, Intl.RelativeTimeFormatUnit] =
    absoluteSeconds >= 31_536_000 ? [31_536_000, 'year'] :
    absoluteSeconds >= 2_592_000 ? [2_592_000, 'month'] :
    absoluteSeconds >= 86_400 ? [86_400, 'day'] :
    absoluteSeconds >= 3_600 ? [3_600, 'hour'] :
    absoluteSeconds >= 60 ? [60, 'minute'] : [1, 'second'];
  return new Intl.RelativeTimeFormat(activeLocale(), { numeric: 'auto' }).format(
    Math.round(elapsedSeconds / divisor),
    unit
  );
};

export const eventDate = (iso: string) =>
  formatLocalizedDate(iso, { weekday: 'short', month: 'short', day: 'numeric' });

export const formatTime = (iso: string) =>
  formatLocalizedDate(iso, { hour: 'numeric', minute: '2-digit' });

export const currency = (amount: number, code: string) =>
  formatLocalizedCurrency(amount, code);
