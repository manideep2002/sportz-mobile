import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronLeft, Mail } from 'lucide-react-native';
import { Alert, StyleSheet } from 'react-native';

import { AppText, Button, IconButton, Input, Screen } from '@/components/ui';
import { spacing } from '@/design/tokens';
import type { AuthStackParamList } from '@/navigation/routes';
import { useAuthStore } from '@/store/authStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const resetPassword = useAuthStore((state) => state.resetPassword);
  const loading = useAuthStore((state) => state.loading);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (error) {
      Alert.alert('Reset failed', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <Screen keyboard contentContainerStyle={styles.content}>
      <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} style={styles.back} />
      <AppText variant="h2">Reset password</AppText>
      <AppText variant="bodyMuted" style={styles.subtitle}>
        {sent ? 'Password reset instructions have been sent.' : 'Enter your email and SPORTZ will send a secure reset link.'}
      </AppText>
      {sent ? (
        <Button full size="lg" onPress={() => navigation.goBack()}>
          Back to Sign In
        </Button>
      ) : (
        <>
          <Input label="Email" icon={Mail} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <Button full size="lg" loading={loading} onPress={handleReset}>
            Send Reset Link
          </Button>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 28,
    paddingTop: 60,
    gap: spacing.lg
  },
  back: {
    marginBottom: 14
  },
  subtitle: {
    marginTop: -10
  }
});
