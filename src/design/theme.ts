import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

import { colors } from './tokens';

export const sportzDarkTheme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: colors.orange[500],
    background: colors.dark[950],
    card: colors.dark[900],
    text: colors.text.primary,
    border: colors.dark[700],
    notification: colors.semantic.danger
  }
};

export const sportzLightTheme: Theme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.orange[500],
    background: colors.light[50],
    card: colors.light[0],
    text: colors.text.inverse,
    border: colors.light[100],
    notification: colors.semantic.danger
  }
};
