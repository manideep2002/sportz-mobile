import { format, formatDistanceToNowStrict } from 'date-fns';

export const compactNumber = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return String(value);
};

export const timeAgo = (iso: string) => `${formatDistanceToNowStrict(new Date(iso))} ago`;

export const eventDate = (iso: string) => format(new Date(iso), 'EEE, MMM d');

export const formatTime = (iso: string) => format(new Date(iso), 'h:mm a');

export const currency = (amount: number, code: string) => {
  if (code === 'INR') return `INR ${amount}`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(amount);
};
