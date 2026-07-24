import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

import type { AppTheme } from './ThemeProvider';

export const createNavigationTheme = (theme: AppTheme): Theme => ({
  ...(theme.isDark ? DarkTheme : DefaultTheme),
  dark: theme.isDark,
  colors: {
    ...(theme.isDark ? DarkTheme.colors : DefaultTheme.colors),
    primary: theme.colors.accent,
    background: theme.colors.background,
    card: theme.colors.surfaceElevated,
    text: theme.colors.text,
    border: theme.colors.border,
    notification: theme.colors.danger
  }
});
