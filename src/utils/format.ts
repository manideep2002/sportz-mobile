import { formatDistanceToNowStrict } from 'date-fns/formatDistanceToNowStrict';
import { enIN } from 'date-fns/locale/en-IN';
import { hi } from 'date-fns/locale/hi';

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

interface TimeAgoOptions {
  addSuffix?: boolean;
}

export const timeAgo = (iso: string, options: TimeAgoOptions = {}) =>
  formatDistanceToNowStrict(new Date(iso), {
    addSuffix: options.addSuffix ?? true,
    locale: activeLocale() === 'hi-IN' ? hi : enIN
  });

export const eventDate = (iso: string) =>
  formatLocalizedDate(iso, { weekday: 'short', month: 'short', day: 'numeric' });

export const formatTime = (iso: string) =>
  formatLocalizedDate(iso, { hour: 'numeric', minute: '2-digit' });

export const currency = (amount: number, code: string) =>
  formatLocalizedCurrency(amount, code);
