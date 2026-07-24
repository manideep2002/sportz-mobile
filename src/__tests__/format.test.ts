import { i18n } from '@/i18n';
import { compactNumber, currency, eventDate, formatTime, timeAgo } from '@/utils/format';

describe('compactNumber', () => {
  it('formats numbers below 1 000 as plain strings', () => {
    expect(compactNumber(0)).toBe('0');
    expect(compactNumber(999)).toBe('999');
  });

  it('formats thousands with one decimal place', () => {
    expect(compactNumber(1000)).toMatch(/^1(?:\.0)?[kK]$/);
    expect(compactNumber(1500)).toMatch(/^1\.5[kK]$/);
    expect(compactNumber(9999)).toMatch(/^10(?:\.0)?[kK]$/);
  });

  it('formats ten-thousands without decimal', () => {
    expect(compactNumber(10000)).toMatch(/^10[kK]$/);
    expect(compactNumber(99999)).toMatch(/^(?:100[kK]|1(?:\.0)?[lL])$/);
  });

  it('formats millions with one decimal place', () => {
    expect(compactNumber(1000000)).toMatch(/^(?:1(?:\.0)?[mM]|10[lL])$/);
    expect(compactNumber(2500000)).toMatch(/^(?:2\.5[mM]|25[lL])$/);
  });
});

describe('currency', () => {
  it('formats INR using the active locale', () => {
    expect(currency(500, 'INR')).toMatch(/₹|INR/);
  });

  it('formats USD using Intl currency formatting', () => {
    const result = currency(9.99, 'USD');
    // Intl.NumberFormat output varies by environment — just verify it contains the amount
    expect(result).toContain('9.99');
  });
});

describe('eventDate', () => {
  it('formats an ISO date as a human-readable event label', () => {
    // 2026-01-05 is a Monday
    const result = eventDate('2026-01-05T10:00:00.000Z');
    expect(result).toMatch(/Mon, (?:Jan 5|5 Jan)/);
  });
});

describe('formatTime', () => {
  it('returns 12-hour time with am/pm marker', () => {
    // Use a fixed UTC time and accept either 12h format variation
    const result = formatTime('2026-06-15T14:30:00.000Z');
    expect(result).toMatch(/\d+:\d{2} [ap]m/i);
  });
});

describe('timeAgo', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-24T12:00:00.000Z'));
    await i18n.changeLanguage('en-IN');
  });

  afterEach(async () => {
    jest.useRealTimers();
    await i18n.changeLanguage('en-IN');
  });

  it('formats feed timestamps when Hermes does not provide Intl.RelativeTimeFormat', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(Intl, 'RelativeTimeFormat');
    Object.defineProperty(Intl, 'RelativeTimeFormat', {
      configurable: true,
      value: undefined
    });

    try {
      expect(timeAgo('2026-07-24T11:58:00.000Z')).toBe('2 minutes ago');
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(Intl, 'RelativeTimeFormat', originalDescriptor);
      } else {
        delete (Intl as typeof Intl & { RelativeTimeFormat?: unknown }).RelativeTimeFormat;
      }
    }
  });

  it('supports suffix-free timestamps without English-only string manipulation', () => {
    expect(timeAgo('2026-07-24T11:58:00.000Z', { addSuffix: false })).toBe('2 minutes');
  });
});
