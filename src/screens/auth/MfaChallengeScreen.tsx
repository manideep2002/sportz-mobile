import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ShieldCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText, Button, Input, Screen } from '@/components/ui';
import { spacing } from '@/design/tokens';
import type { AuthStackParamList } from '@/navigation/routes';
import { accountSecurityService } from '@/services/accountSecurityService';
import { useAuthStore } from '@/store/authStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'MfaChallenge'>;

export function MfaChallengeScreen(_props: Props) {
  const verifyMfaChallenge = useAuthStore((state) => state.verifyMfaChallenge);
  const signOut = useAuthStore((state) => state.signOut);
  const loading = useAuthStore((state) => state.loading);
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [nonce, setNonce] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);

  useEffect(() => {
    void accountSecurityService
      .listMfaFactors()
      .then((factors) => setFactorId(factors.find((factor) => factor.status === 'verified')?.id ?? ''))
      .catch(() => setFactorId(''));
  }, []);

  const verify = async () => {
    if (!factorId || !/^\d{6}$/.test(code)) {
      Alert.alert('Check the code', 'Enter the current 6-digit code from your authenticator app.');
      return;
    }
    try {
      await verifyMfaChallenge(factorId, code);
    } catch (error) {
      Alert.alert('Could not verify', error instanceof Error ? error.message : 'Try a new code.');
    }
  };

  const requestRecovery = async () => {
    if (!recoveryPassword) return;
    try {
      await accountSecurityService.reauthenticate(recoveryPassword);
      await accountSecurityService.requestMfaRecovery();
      setRecoverySent(true);
      Alert.alert('Recovery code sent', 'Check your verified email for a one-time code.');
    } catch (error) {
      Alert.alert('Recovery unavailable', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const completeRecovery = async () => {
    try {
      await accountSecurityService.completeMfaRecovery(recoveryPassword, nonce);
      Alert.alert('MFA reset', 'Authenticator factors were removed. Sign in again to secure your account.');
      await signOut();
    } catch (error) {
      Alert.alert('Recovery failed', error instanceof Error ? error.message : 'Check the code and try again.');
    }
  };

  return (
    <Screen keyboard contentContainerStyle={styles.content}>
      <View accessible accessibilityRole="header" style={styles.hero}>
        <ShieldCheck size={42} />
        <AppText variant="h2">Two-step verification</AppText>
        <AppText variant="bodyMuted">
          Enter the code from your authenticator app to finish signing in.
        </AppText>
      </View>
      <Input
        label="Authenticator code"
        value={code}
        onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
      />
      <Button full size="lg" loading={loading} onPress={() => void verify()}>
        Verify and continue
      </Button>
      <Button full variant="ghost" onPress={() => setRecoveryOpen((value) => !value)}>
        {recoveryOpen ? 'Hide account recovery' : 'I lost my authenticator'}
      </Button>
      {recoveryOpen ? (
        <View style={styles.recovery}>
          <AppText variant="h4">Email-assisted recovery</AppText>
          <AppText variant="small">
            Verify your password first. We then send a one-time code to your verified email. Recovery removes
            authenticator factors and signs out other devices.
          </AppText>
          <Input
            label="Current password"
            value={recoveryPassword}
            onChangeText={setRecoveryPassword}
            secureTextEntry
          />
          {!recoverySent ? (
            <Button full onPress={() => void requestRecovery()}>Send recovery code</Button>
          ) : (
            <>
              <Input
                label="Email recovery code"
                value={nonce}
                onChangeText={(value) => setNonce(value.replace(/\D/g, '').slice(0, 8))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
              />
              <Button full variant="danger" onPress={() => void completeRecovery()}>
                Remove MFA and sign out other devices
              </Button>
            </>
          )}
        </View>
      ) : null}
      <Button variant="dark" onPress={() => void signOut()}>Cancel and sign out</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    justifyContent: 'center',
    gap: spacing.md
  },
  hero: {
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  recovery: {
    gap: spacing.md,
    paddingVertical: spacing.md
  }
});
