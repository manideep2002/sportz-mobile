import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  I18nProvider,
  formatLocalizedCurrency,
  formatLocalizedDate,
  formatLocalizedNumber,
  i18n
} from '@/i18n';
import { normalizeLocale, useUiStore } from '@/store/uiStore';

function LocaleProbe() {
  const { t } = useTranslation();
  const setLanguage = useUiStore((state) => state.setLanguage);
  return (
    <>
      <Text testID="settings-title">{t('settings.title')}</Text>
      <Pressable accessibilityRole="button" onPress={() => setLanguage('hi-IN')}>
        <Text>Switch Hindi</Text>
      </Pressable>
    </>
  );
}

describe('localization preferences', () => {
  beforeEach(async () => {
    useUiStore.setState({ language: 'en-IN' });
    await i18n.changeLanguage('en-IN');
  });

  afterAll(async () => {
    await i18n.changeLanguage('en-IN');
  });

  it('applies a language change without restarting the app', async () => {
    await render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>
    );

    expect(screen.getByTestId('settings-title').props.children).toBe('Settings');
    fireEvent.press(screen.getByText('Switch Hindi'));
    await waitFor(() => expect(screen.getByTestId('settings-title').props.children).toBe('सेटिंग्स'));
  });

  it('uses English as a safe fallback for unsupported or legacy choices', async () => {
    expect(normalizeLocale('Kannada')).toBe('en-IN');
    expect(normalizeLocale('Hindi')).toBe('hi-IN');

    await i18n.changeLanguage('fr-FR');
    expect(i18n.t('settings.title')).toBe('Settings');
  });

  it('localizes dates, numbers, and currencies with the selected locale', () => {
    expect(formatLocalizedNumber(123456.5, undefined, 'en-IN')).toMatch(/1,23,456/);
    expect(formatLocalizedNumber(123456.5, undefined, 'hi-IN')).toMatch(/1,23,456/);
    expect(formatLocalizedCurrency(500, 'INR', 'en-IN')).toMatch(/₹|INR/);
    expect(formatLocalizedDate('2026-01-05T10:00:00.000Z', { month: 'long' }, 'hi-IN')).toContain('जनवरी');
  });
});
