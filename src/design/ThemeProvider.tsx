import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';

import { colors, type ThemeMode } from '@/design/tokens';
import { useUiStore, type AccentColor } from '@/store/uiStore';

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
  scrim: string;
  nav: string;
  mediaGradientEnd: string;
}

export interface AppTheme {
  mode: ThemeMode;
  accentName: AccentColor;
  isDark: boolean;
  colors: SemanticThemeColors;
}

const accentPalettes: Record<AccentColor, Pick<SemanticThemeColors, 'accent' | 'accentPressed' | 'accentSoft' | 'accentBorder' | 'onAccent'>> = {
  orange: {
    accent: '#C2410C',
    accentPressed: '#9A3412',
    accentSoft: 'rgba(194,65,12,0.14)',
    accentBorder: 'rgba(194,65,12,0.45)',
    onAccent: '#FFFFFF'
  },
  green: {
    accent: '#15803D',
    accentPressed: '#166534',
    accentSoft: 'rgba(21,128,61,0.14)',
    accentBorder: 'rgba(21,128,61,0.45)',
    onAccent: '#FFFFFF'
  },
  blue: {
    accent: '#2563EB',
    accentPressed: '#1D4ED8',
    accentSoft: 'rgba(37,99,235,0.14)',
    accentBorder: 'rgba(37,99,235,0.45)',
    onAccent: '#FFFFFF'
  },
  pink: {
    accent: '#BE185D',
    accentPressed: '#9D174D',
    accentSoft: 'rgba(190,24,93,0.14)',
    accentBorder: 'rgba(190,24,93,0.45)',
    onAccent: '#FFFFFF'
  }
};

export function createAppTheme(mode: ThemeMode, accentName: AccentColor): AppTheme {
  const accent = accentPalettes[accentName] ?? accentPalettes.orange;
  const isDark = mode === 'dark';
  return {
    mode,
    accentName,
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
        nav: 'rgba(14,12,9,0.96)',
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
        nav: 'rgba(255,255,255,0.96)',
        mediaGradientEnd: 'rgba(10,9,7,0.88)'
      }),
      ...accent,
      danger: colors.semantic.danger,
      dangerSoft: colors.overlays.dangerSoft,
      success: colors.semantic.successDark,
      info: colors.semantic.info,
      warning: colors.semantic.warning,
      scrim: colors.overlays.scrim
    }
  };
}

const defaultTheme = createAppTheme('dark', 'orange');
const ThemeContext = createContext<AppTheme>(defaultTheme);

export function ThemeProvider({ children }: PropsWithChildren) {
  const mode = useUiStore((state) => state.themeMode);
  const accent = useUiStore((state) => state.accentColor);
  const theme = useMemo(() => createAppTheme(mode, accent), [accent, mode]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export const useAppTheme = () => useContext(ThemeContext);
