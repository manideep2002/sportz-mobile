import { useEffect, useState } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronLeft, Eye, EyeOff, Lock, Mail } from 'lucide-react-native';
import { Alert, Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, IconButton, Input, Screen } from '@/components/ui';
import { colors, spacing } from '@/design/tokens';
import { env } from '@/lib/env';
import type { AuthStackParamList } from '@/navigation/routes';
import { useAuthStore } from '@/store/authStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const signIn = useAuthStore((state) => state.signIn);
  const signInWithIdToken = useAuthStore((state) => state.signInWithIdToken);
  const loading = useAuthStore((state) => state.loading);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: env.googleIosClientId,
    androidClientId: env.googleAndroidClientId,
    webClientId: env.googleWebClientId
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params.id_token;
      if (idToken) {
        void signInWithIdToken('google', idToken).catch((error) => Alert.alert('Google login failed', error.message));
      }
    }
  }, [response, signInWithIdToken]);

  const handleEmailLogin = async () => {
    const nextErrors: typeof errors = {};
    if (!email.trim()) nextErrors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) nextErrors.email = 'Enter a valid email address.';
    if (!password) nextErrors.password = 'Password is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      await signIn(email.trim(), password);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      const friendly = /email not confirmed/i.test(message)
        ? 'Check your inbox and confirm your email before signing in.'
        : message;
      setErrors({ form: friendly });
    }
  };

  const handleAppleLogin = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL]
      });
      if (!credential.identityToken) throw new Error('Apple did not return an identity token.');
      await signInWithIdToken('apple', credential.identityToken);
    } catch (error) {
      if ((error as { code?: string }).code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple login failed', error instanceof Error ? error.message : 'Please try again.');
      }
    }
  };

  return (
    <Screen keyboard contentContainerStyle={styles.content}>
      <Pressable style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss} />
      <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} style={styles.back} />
      <AppText variant="h2">Welcome back</AppText>
      <AppText variant="bodyMuted" style={styles.subtitle}>
        Sign in to your SPORTZ account
      </AppText>
      <View style={styles.form}>
        <Button variant="dark" full size="lg" loading={!request} disabled={!request} onPress={() => void promptAsync()}>
          Continue with Google
        </Button>
        {Platform.OS === 'ios' ? (
          <Button variant="dark" full size="lg" onPress={handleAppleLogin}>
            Continue with Apple
          </Button>
        ) : null}
        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <AppText variant="small">or email</AppText>
          <View style={styles.divider} />
        </View>
        <Input label="Email" icon={Mail} value={email} onChangeText={(value) => { setEmail(value); setErrors((old) => ({ ...old, email: undefined, form: undefined })); }} keyboardType="email-address" autoCapitalize="none" accessibilityLabel="Email" />
        {errors.email ? <AppText style={styles.error}>{errors.email}</AppText> : null}
        <View>
          <Input
            label="Password"
            icon={Lock}
            value={password}
            onChangeText={(value) => { setPassword(value); setErrors((old) => ({ ...old, password: undefined, form: undefined })); }}
            secureTextEntry={!showPassword}
            accessibilityLabel="Password"
          />
          <IconButton
            icon={showPassword ? EyeOff : Eye}
            size={34}
            iconSize={16}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            style={styles.passwordToggle}
            onPress={() => setShowPassword((value) => !value)}
          />
        </View>
        {errors.password ? <AppText style={styles.error}>{errors.password}</AppText> : null}
        {errors.form ? <AppText style={styles.error}>{errors.form}</AppText> : null}
        <Pressable onPress={() => navigation.navigate('ForgotPassword')}>
          <AppText style={styles.forgot}>Forgot password?</AppText>
        </Pressable>
        <Button full size="lg" loading={loading} onPress={handleEmailLogin}>
          Sign In
        </Button>
        <Pressable style={styles.switch} onPress={() => navigation.navigate('Register')}>
          <AppText variant="bodyMuted">Do not have an account? </AppText>
          <AppText style={styles.link}>Sign Up</AppText>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 28,
    paddingTop: 60
  },
  back: {
    marginBottom: 32
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 36
  },
  form: {
    gap: spacing.md
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  divider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.dark[700]
  },
  forgot: {
    color: colors.orange[400],
    fontSize: 13,
    textAlign: 'right'
  },
  passwordToggle: {
    position: 'absolute',
    right: 8,
    bottom: 7,
    backgroundColor: colors.dark[700]
  },
  error: {
    color: colors.semantic.danger,
    fontSize: 12,
    marginTop: -10
  },
  switch: {
    flexDirection: 'row',
    justifyContent: 'center'
  },
  link: {
    color: colors.orange[400],
    fontWeight: '700'
  }
});
