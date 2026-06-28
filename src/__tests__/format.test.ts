import { compactNumber, currency, eventDate, formatTime } from '@/utils/format';

describe('compactNumber', () => {
  it('formats numbers below 1 000 as plain strings', () => {
    expect(compactNumber(0)).toBe('0');
    expect(compactNumber(999)).toBe('999');
  });

  it('formats thousands with one decimal place', () => {
    expect(compactNumber(1000)).toBe('1.0k');
    expect(compactNumber(1500)).toBe('1.5k');
    expect(compactNumber(9999)).toBe('10.0k');
  });

  it('formats ten-thousands without decimal', () => {
    expect(compactNumber(10000)).toBe('10k');
    expect(compactNumber(99999)).toBe('100k');
  });

  it('formats millions with one decimal place', () => {
    expect(compactNumber(1000000)).toBe('1.0m');
    expect(compactNumber(2500000)).toBe('2.5m');
  });
});

describe('currency', () => {
  it('formats INR with a plain prefix', () => {
    expect(currency(500, 'INR')).toBe('INR 500');
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
    expect(result).toMatch(/Mon, Jan 5/);
  });
});

describe('formatTime', () => {
  it('returns 12-hour time with am/pm marker', () => {
    // Use a fixed UTC time and accept either 12h format variation
    const result = formatTime('2026-06-15T14:30:00.000Z');
    expect(result).toMatch(/\d+:\d{2} [ap]m/i);
  });
});
