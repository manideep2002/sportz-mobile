import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ShieldCheck } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

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
  const [factorState, setFactorState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [factorError, setFactorError] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [challengeError, setChallengeError] = useState('');
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [nonce, setNonce] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveryCodeError, setRecoveryCodeError] = useState('');
  const [pendingAction, setPendingAction] = useState<'verify' | 'request' | 'recover' | 'signout' | null>(null);
  const pendingRef = useRef(false);

  const loadFactors = useCallback(async () => {
    setFactorState('loading');
    setFactorError('');
    try {
      const factors = await accountSecurityService.listMfaFactors();
      const verified = factors.find((factor) => factor.status === 'verified');
      setFactorId(verified?.id ?? '');
      setFactorState(verified ? 'ready' : 'empty');
    } catch (error) {
      setFactorId('');
      setFactorState('error');
      setFactorError(error instanceof Error ? error.message : 'Could not load your authenticator.');
    }
  }, []);

  useEffect(() => { void loadFactors(); }, [loadFactors]);

  const runAction = async (action: typeof pendingAction, operation: () => Promise<void>) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPendingAction(action);
    try {
      await operation();
    } finally {
      pendingRef.current = false;
      setPendingAction(null);
    }
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(code)) {
      setCodeError('Enter the current 6-digit code from your authenticator app.');
      return;
    }
    if (!factorId || factorState !== 'ready') return;
    setCodeError('');
    setChallengeError('');
    await runAction('verify', async () => {
      try {
        await verifyMfaChallenge(factorId, code);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Try a new code.';
        setChallengeError(/expired|challenge.*not found|session/i.test(message)
          ? 'This challenge expired. Refresh your authenticator and sign in again if the problem continues.'
          : message);
      }
    });
  };

  const requestRecovery = async () => {
    if (!recoveryPassword.trim()) {
      setRecoveryError('Enter your current password.');
      return;
    }
    setRecoveryError('');
    await runAction('request', async () => {
      try {
        await accountSecurityService.reauthenticate(recoveryPassword);
        await accountSecurityService.requestMfaRecovery();
        setRecoverySent(true);
        Alert.alert('Recovery code sent', 'Check your verified email for a one-time code.');
      } catch (error) {
        setRecoveryError(error instanceof Error ? error.message : 'Recovery is temporarily unavailable.');
      }
    });
  };

  const completeRecovery = async () => {
    if (!nonce.trim()) {
      setRecoveryCodeError('Enter the recovery code from your email.');
      return;
    }
    if (!/^\d{6,8}$/.test(nonce)) {
      setRecoveryCodeError('Enter the 6- to 8-digit recovery code.');
      return;
    }
    setRecoveryCodeError('');
    await runAction('recover', async () => {
      try {
        await accountSecurityService.completeMfaRecovery(recoveryPassword, nonce);
        Alert.alert('MFA reset', 'Authenticator factors were removed. Sign in again to secure your account.');
        await signOut();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Check the code and try again.';
        setRecoveryCodeError(/expired/i.test(message) ? 'That recovery code expired. Request a new code.' : message);
      }
    });
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
      {factorState === 'loading' ? (
        <View style={styles.state}><ActivityIndicator /><AppText>Loading authenticator…</AppText></View>
      ) : null}
      {factorState === 'error' ? (
        <View style={styles.state}>
          <AppText accessibilityRole="alert">{factorError}</AppText>
          <Button accessibilityLabel="Retry authenticator loading" onPress={() => void loadFactors()}>Retry</Button>
        </View>
      ) : null}
      {factorState === 'empty' ? (
        <View style={styles.state}>
          <AppText accessibilityRole="alert">No verified authenticator is available for this account.</AppText>
          <Button accessibilityLabel="Refresh authenticator factors" onPress={() => void loadFactors()}>Refresh</Button>
        </View>
      ) : null}
      <Input
        label="Authenticator code"
        value={code}
        onChangeText={(value) => { setCode(value.replace(/\D/g, '').slice(0, 6)); setCodeError(''); setChallengeError(''); }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
      />
      {codeError ? <AppText accessibilityRole="alert" style={styles.error}>{codeError}</AppText> : null}
      {challengeError ? <AppText accessibilityRole="alert" style={styles.error}>{challengeError}</AppText> : null}
      <Button full size="lg" disabled={factorState !== 'ready' || pendingAction !== null} loading={loading || pendingAction === 'verify'} onPress={() => void verify()}>
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
            onChangeText={(value) => { setRecoveryPassword(value); setRecoveryError(''); }}
            secureTextEntry
          />
          {recoveryError ? <AppText accessibilityRole="alert" style={styles.error}>{recoveryError}</AppText> : null}
          {!recoverySent ? (
            <Button full disabled={pendingAction !== null} loading={pendingAction === 'request'} onPress={() => void requestRecovery()}>Send recovery code</Button>
          ) : (
            <>
              <Input
                label="Email recovery code"
                value={nonce}
                onChangeText={(value) => { setNonce(value.replace(/\D/g, '').slice(0, 8)); setRecoveryCodeError(''); }}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
              />
              {recoveryCodeError ? <AppText accessibilityRole="alert" style={styles.error}>{recoveryCodeError}</AppText> : null}
              <Button full variant="danger" disabled={pendingAction !== null} loading={pendingAction === 'recover'} onPress={() => void completeRecovery()}>
                Remove MFA and sign out other devices
              </Button>
            </>
          )}
        </View>
      ) : null}
      <Button variant="dark" disabled={pendingAction !== null} loading={pendingAction === 'signout'} onPress={() => void runAction('signout', signOut)}>Cancel and sign out</Button>
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
  },
  state: { alignItems: 'center', gap: spacing.sm },
  error: { color: '#EF4444' }
});
