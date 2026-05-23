export const colors = {
  orange: {
    500: '#FF5A1F',
    400: '#FF7A45',
    300: '#FFB38A',
    100: '#FFF0E8',
    600: '#FF3D00'
  },
  dark: {
    950: '#0A0907',
    900: '#141210',
    850: '#1A1612',
    800: '#1E1A17',
    700: '#2A2420',
    600: '#363028'
  },
  light: {
    0: '#FFFFFF',
    50: '#F7F3EE',
    100: '#EDE8E1'
  },
  text: {
    primary: '#F0EBE4',
    secondary: '#9A9189',
    tertiary: '#5C5650',
    inverse: '#0A0907'
  },
  semantic: {
    success: '#22C55E',
    successDark: '#16A34A',
    info: '#3B82F6',
    danger: '#EF4444',
    warning: '#F59E0B'
  },
  overlays: {
    nav: 'rgba(14,12,9,0.96)',
    orangeSoft: 'rgba(255,90,31,0.15)',
    orangeBorder: 'rgba(255,90,31,0.35)',
    successSoft: 'rgba(34,197,94,0.15)',
    dangerSoft: 'rgba(239,68,68,0.12)',
    infoSoft: 'rgba(59,130,246,0.12)',
    scrim: 'rgba(0,0,0,0.7)'
  }
} as const;

export const spacing = {
  xxs: 3,
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
  screen: 18
} as const;

export const radii = {
  xs: 8,
  sm: 10,
  md: 12,
  lg: 14,
  xl: 18,
  xxl: 26,
  pill: 999
} as const;

export const typography = {
  headingFamily: 'BarlowCondensed_800ExtraBold',
  headingBlack: 'BarlowCondensed_900Black',
  headingBold: 'BarlowCondensed_700Bold',
  bodyFamily: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
  sizes: {
    hero: 68,
    h1: 34,
    h2: 26,
    h3: 19,
    h4: 15,
    body: 14,
    bodyLarge: 15,
    small: 11,
    caption: 10
  }
} as const;

export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  },
  orangeGlow: {
    shadowColor: colors.orange[500],
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6
  }
} as const;

export const layout = {
  tabBarHeight: 84,
  headerHeight: 56,
  maxContentWidth: 430
} as const;

export type ThemeMode = 'light' | 'dark';
