import {
  formatLocalizedCurrency,
  formatLocalizedDate,
  formatLocalizedNumber,
  i18n
} from '@/i18n';

describe('localization preferences', () => {
  it('uses English as the only locale', async () => {
    await i18n.changeLanguage('fr-FR');
    expect(i18n.t('settings.title')).toBe('Settings');
  });

  it('localizes dates, numbers, and currencies with en-IN', () => {
    expect(formatLocalizedNumber(123456.5, undefined, 'en-IN')).toMatch(/1,23,456/);
    expect(formatLocalizedCurrency(500, 'INR', 'en-IN')).toMatch(/₹|INR/);
    expect(formatLocalizedDate('2026-01-05T10:00:00.000Z', { month: 'long' }, 'en-IN')).toContain('January');
  });
});
