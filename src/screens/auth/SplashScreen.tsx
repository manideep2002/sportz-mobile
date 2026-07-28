import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { AppText, Button, Screen } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { spacing } from '@/design/tokens';
import type { AuthStackParamList } from '@/navigation/routes';

type Props = NativeStackScreenProps<AuthStackParamList, 'Splash'>;

export function SplashScreen({ navigation }: Props) {
  const { colors: theme, isDark } = useAppTheme();
  const patternStroke = theme.text;
  return (
    <Screen scroll={false} contentContainerStyle={styles.content}>
      <View style={styles.pattern}>
        <Svg viewBox="0 0 393 852" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
          <Circle cx="196" cy="426" r="120" fill="none" stroke={patternStroke} strokeWidth="2" opacity="0.08" />
          <Circle cx="196" cy="426" r="60" fill="none" stroke={patternStroke} strokeWidth="1.5" opacity="0.08" />
          <Line x1="196" y1="0" x2="196" y2="852" stroke={patternStroke} strokeWidth="1" opacity="0.08" />
          <Rect x="60" y="100" width="160" height="220" fill="none" stroke={patternStroke} strokeWidth="1.5" opacity="0.08" />
          <Rect x="173" y="100" width="46" height="46" fill="none" stroke={patternStroke} strokeWidth="1.5" opacity="0.08" />
          <Circle cx="196" cy="200" r="50" fill="none" stroke={patternStroke} strokeWidth="1.5" opacity="0.08" />
          <Circle cx="196" cy="652" r="50" fill="none" stroke={patternStroke} strokeWidth="1.5" opacity="0.08" />
        </Svg>
        <LinearGradient
          colors={isDark
            ? ['rgba(10,9,7,0.25)', 'rgba(10,9,7,0.86)', theme.background]
            : ['rgba(247,243,238,0.12)', 'rgba(247,243,238,0.74)', theme.background]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={styles.hero}>
        <AppText variant="hero">
          SPORTZ<AppText variant="hero" color={theme.accent}>.</AppText>
        </AppText>
        <AppText variant="bodyMuted" style={styles.tagline}>
          Connect. Compete. Grow.{"\n"}The sports world in your pocket.
        </AppText>
      </View>
      <View style={styles.actions}>
        <Button full size="lg" onPress={() => navigation.navigate('Login')}>
          Sign In
        </Button>
        <Button full size="lg" variant="ghost" onPress={() => navigation.navigate('Register')}>
          Create Account
        </Button>
        <View style={styles.terms}>
          <AppText variant="small" style={styles.agreement}>
            By continuing you agree to our
          </AppText>
          <View style={styles.legalLinks}>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Read Terms of Service"
              hitSlop={4}
              style={styles.legalLink}
              onPress={() => navigation.navigate('TermsOfService')}
            >
              <AppText variant="small" style={[styles.linkText, { color: theme.accent }]}>
                Terms of Service
              </AppText>
            </Pressable>
            <AppText variant="small">and</AppText>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Read Privacy Policy"
              hitSlop={4}
              style={styles.legalLink}
              onPress={() => navigation.navigate('PrivacyPolicy')}
            >
              <AppText variant="small" style={[styles.linkText, { color: theme.accent }]}>
                Privacy Policy
              </AppText>
            </Pressable>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 28,
    paddingBottom: 40
  },
  pattern: {
    ...StyleSheet.absoluteFillObject
  },
  hero: {
    marginBottom: 48
  },
  tagline: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 24
  },
  actions: {
    gap: spacing.md
  },
  terms: {
    alignItems: 'center',
    paddingTop: 8
  },
  agreement: {
    textAlign: 'center'
  },
  legalLinks: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs
  },
  legalLink: {
    justifyContent: 'center',
    minHeight: 44
  },
  linkText: {
    textDecorationLine: 'underline'
  }
});
