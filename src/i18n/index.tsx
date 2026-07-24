import { type PropsWithChildren } from 'react';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next, useTranslation } from 'react-i18next';

import { enIN } from './locales/en-IN';

if (!i18n.isInitialized) {
  // The default instance also lets isolated screens and tests resolve translations
  // when they render outside the application provider.
  // eslint-disable-next-line import/no-named-as-default-member
  void i18n.use(initReactI18next).init({
    compatibilityJSON: 'v4',
    resources: {
      'en-IN': { translation: enIN }
    },
    lng: 'en-IN',
    fallbackLng: 'en-IN',
    interpolation: { escapeValue: false },
    returnNull: false
  });
}

export function I18nProvider({ children }: PropsWithChildren) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

export const useAppTranslation = () => useTranslation(undefined, { i18n });

export const activeLocale = () => 'en-IN' as const;

export const formatLocalizedDate = (
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
  locale = activeLocale()
) => new Intl.DateTimeFormat(locale, options).format(new Date(value));

export const formatLocalizedNumber = (
  value: number,
  options?: Intl.NumberFormatOptions,
  locale = activeLocale()
) => new Intl.NumberFormat(locale, options).format(value);

export const formatLocalizedCurrency = (
  value: number,
  currency = 'INR',
  locale = activeLocale()
) => new Intl.NumberFormat(locale, {
  style: 'currency',
  currency,
  maximumFractionDigits: Number.isInteger(value) ? 0 : 2
}).format(value);

export { i18n };
