import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';

import { colors, type ThemeMode } from '@/design/tokens';
import { useUiStore } from '@/store/uiStore';

export interface SemanticThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  inverseText: string;
  accent: string;
  accentPressed: string;
  accentSoft: string;
  accentBorder: string;
  onAccent: string;
  danger: string;
  dangerSoft: string;
  success: string;
  info: string;
  warning: string;
  warningSoft: string;
  warningBorder: string;
  scrim: string;
  nav: string;
  mediaGradientEnd: string;
}

export interface AppTheme {
  mode: ThemeMode;
  isDark: boolean;
  colors: SemanticThemeColors;
}

export function createAppTheme(mode: ThemeMode): AppTheme {
  const isDark = mode === 'dark';
  const accent = isDark
    ? {
        accent: colors.orange[500],
        accentPressed: colors.orange[600],
        accentSoft: colors.overlays.orangeSoft,
        accentBorder: colors.overlays.orangeBorder,
        onAccent: colors.text.inverse
      }
    : {
        accent: '#C2410C',
        accentPressed: '#9A3412',
        accentSoft: 'rgba(194,65,12,0.14)',
        accentBorder: 'rgba(194,65,12,0.45)',
        onAccent: '#FFFFFF'
      };
  return {
    mode,
    isDark,
    colors: {
      ...(isDark ? {
        background: colors.dark[950],
        surface: colors.dark[800],
        surfaceElevated: colors.dark[900],
        surfaceMuted: colors.dark[700],
        border: colors.dark[700],
        text: '#F4EFE9',
        textMuted: '#B6ADA4',
        textSubtle: '#91877E',
        inverseText: '#17130F',
        nav: 'transparent',
        mediaGradientEnd: colors.dark[950]
      } : {
        background: '#F7F3EE',
        surface: '#FFFFFF',
        surfaceElevated: '#FFFFFF',
        surfaceMuted: '#E9E2DA',
        border: '#D8D0C7',
        text: '#17130F',
        textMuted: '#5F574F',
        textSubtle: '#776E66',
        inverseText: '#FFFFFF',
        nav: 'transparent',
        mediaGradientEnd: 'rgba(10,9,7,0.88)'
      }),
      ...accent,
      danger: isDark ? '#F87171' : '#B91C1C',
      dangerSoft: isDark ? colors.overlays.dangerSoft : 'rgba(185,28,28,0.10)',
      success: isDark ? colors.semantic.success : '#15803D',
      info: isDark ? '#60A5FA' : '#1D4ED8',
      warning: isDark ? '#FBBF24' : '#854D0E',
      warningSoft: isDark ? 'rgba(245,158,11,0.15)' : '#FEF3C7',
      warningBorder: isDark ? 'rgba(245,158,11,0.46)' : '#D97706',
      scrim: colors.overlays.scrim
    }
  };
}

const defaultTheme = createAppTheme('dark');
const ThemeContext = createContext<AppTheme>(defaultTheme);

export function ThemeProvider({ children }: PropsWithChildren) {
  const mode = useUiStore((state) => state.themeMode);
  const theme = useMemo(() => createAppTheme(mode), [mode]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export const useAppTheme = () => useContext(ThemeContext);
