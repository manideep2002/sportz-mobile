import { formatDateInput, formatTimeInput, parseManualStartDate } from '@/utils/eventDateValidation';

describe('event date validation', () => {
  it('parses valid YYYY-MM-DD and 24-hour time values', () => {
    const result = parseManualStartDate('2099-08-21', '18:30');

    expect('date' in result).toBe(true);
    if ('date' in result) {
      expect(formatDateInput(result.date)).toBe('2099-08-21');
      expect(formatTimeInput(result.date)).toBe('18:30');
    }
  });

  it.each([
    ['21-08-2099', '18:30', 'Enter the date as YYYY-MM-DD.'],
    ['2099-02-30', '18:30', 'Enter a valid calendar date.'],
    ['2099-08-21', '25:00', 'Enter the time as HH:mm using 24-hour time.']
  ])('rejects invalid manual values', (dateText, timeText, message) => {
    expect(parseManualStartDate(dateText, timeText)).toEqual({ error: message });
  });
});
