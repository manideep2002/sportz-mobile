import { Image } from 'expo-image';
import { ChevronLeft, KeyRound, Laptop, ShieldCheck, Smartphone } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Factor } from '@supabase/supabase-js';

import { AppText, Button, Card, IconButton, Input, Screen } from '@/components/ui';
import { spacing } from '@/design/tokens';
import type { AppStackParamList } from '@/navigation/routes';
import {
  accountSecurityService,
  type AccountSession,
  type SecurityEvent
} from '@/services/accountSecurityService';
import { useAuthStore } from '@/store/authStore';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Enrollment = Awaited<ReturnType<typeof accountSecurityService.enrollTotp>>;

const eventLabels: Record<string, string> = {
  recent_auth_verified: 'Identity reverified',
  password_changed: 'Password changed',
  email_change_requested: 'Email change requested',
  phone_change_requested: 'Phone change requested',
  session_revoked: 'Session revoked',
  other_sessions_revoked: 'Other sessions revoked',
  mfa_enrolled: 'Authenticator added',
  mfa_removed: 'Authenticator removed',
  mfa_recovery_requested: 'MFA recovery requested',
  mfa_recovered: 'MFA recovered'
};

function deviceLabel(session: AccountSession) {
  if (session.isCurrent) return 'This device';
  const agent = session.userAgent?.toLowerCase() ?? '';
  if (agent.includes('iphone') || agent.includes('android')) return 'Mobile device';
  if (agent.includes('ipad') || agent.includes('tablet')) return 'Tablet';
  return 'Web or desktop session';
}

export function AccountSecurityScreen() {
  const navigation = useNavigation<Navigation>();
  const user = useAuthStore((state) => state.user);
  const deleteAccountFromStore = useAuthStore((state) => state.deleteAccount);
  const [recent, setRecent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [pendingPhone, setPendingPhone] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deleteWord, setDeleteWord] = useState('');

  const verifiedFactors = useMemo(
    () => factors.filter((factor) => factor.status === 'verified'),
    [factors]
  );
  const deletionIdentity = user?.email ?? user?.phone ?? '';

  const refresh = async () => {
    const [hasRecent, activeSessions, mfaFactors, securityEvents] = await Promise.all([
      accountSecurityService.hasRecentAuthentication(),
      accountSecurityService.listSessions(),
      accountSecurityService.listMfaFactors(),
      accountSecurityService.listSecurityEvents()
    ]);
    setRecent(hasRecent);
    setSessions(activeSessions);
    setFactors(mfaFactors);
    setEvents(securityEvents);
  };

  useEffect(() => {
    void refresh().catch((error) => {
      Alert.alert('Security data unavailable', error instanceof Error ? error.message : 'Try again.');
    });
  }, []);

  const execute = async (operation: () => Promise<unknown>, success: string, refreshAfter = true) => {
    setBusy(true);
    try {
      await operation();
      Alert.alert('Security updated', success);
      if (refreshAfter) await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      if (/recent authentication/i.test(message)) setRecent(false);
      Alert.alert('Could not update security', message);
    } finally {
      setBusy(false);
    }
  };

  const reauthenticate = () => execute(async () => {
    const result = await accountSecurityService.reauthenticate(currentPassword);
    setRecent(new Date(result.expiresAt).getTime() > Date.now());
    setCurrentPassword('');
  }, 'Sensitive actions are unlocked for 10 minutes on this session.');

  const changePassword = () => {
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Enter the same new password twice.');
      return;
    }
    void execute(async () => {
      await accountSecurityService.updatePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setRecent(false);
    }, 'Your password changed. Other devices were signed out.');
  };

  const beginTotpEnrollment = () => execute(async () => {
    const data = await accountSecurityService.enrollTotp(`SPORTZ ${Platform.OS}`);
    setEnrollment(data);
  }, 'Scan the QR code, then verify a code to finish.');

  const verifyEnrollment = () => {
    if (!enrollment) return;
    void execute(async () => {
      await accountSecurityService.verifyTotp(enrollment.id, totpCode);
      await accountSecurityService.recordMfaEnrollment(enrollment.id);
      setEnrollment(null);
      setTotpCode('');
    }, 'Authenticator verification is now enabled.');
  };

  const revokeSession = (session: AccountSession) => {
    Alert.alert(
      session.isCurrent ? 'Sign out this device?' : 'Sign out this device?',
      'The selected session will no longer be able to refresh its authentication.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out device',
          style: 'destructive',
          onPress: () => void execute(
            () => accountSecurityService.revokeSession(session),
            session.isCurrent ? 'This device was signed out.' : 'The selected device was signed out.',
            !session.isCurrent
          )
        }
      ]
    );
  };

  const deleteAccount = () => {
    if (deleteWord !== 'DELETE' || deleteEmail.trim().toLowerCase() !== deletionIdentity.toLowerCase()) {
      Alert.alert('Confirmation does not match', 'Enter your current verified email or phone and type DELETE exactly.');
      return;
    }
    Alert.alert(
      'Permanently delete account?',
      'Your profile, posts, private messages, bookings, memberships, offers, and uploaded media will be removed where required. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Permanently delete',
          style: 'destructive',
          onPress: () => void execute(async () => {
            await deleteAccountFromStore(deleteEmail);
          }, 'Your account was deleted.', false)
        }
      ]
    );
  };

  return (
    <Screen keyboard maxWidth="content" contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton accessibilityLabel="Back" icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText accessibilityRole="header" variant="h3">Account security</AppText>
        <View style={styles.headerSpacer} />
      </View>

      <Card style={styles.section}>
        <View style={styles.sectionTitle}>
          <KeyRound size={20} />
          <AppText variant="h4">Recent authentication</AppText>
        </View>
        <AppText variant="bodyMuted">
          {recent
            ? 'Identity verified on this session. Sensitive actions are temporarily unlocked.'
            : 'Enter your current password before changing identity, sessions, MFA, or deleting the account.'}
        </AppText>
        {!recent ? (
          <>
            <Input
              label="Current password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              textContentType="password"
            />
            <Button full loading={busy} disabled={!currentPassword} onPress={() => void reauthenticate()}>
              Verify identity
            </Button>
            <AppText variant="small">
              Social-login accounts can use Forgot Password to establish a password through their verified email.
            </AppText>
          </>
        ) : null}
      </Card>

      <Card style={styles.section}>
        <AppText variant="h4">Password</AppText>
        <AppText variant="small">Use at least 12 characters with uppercase, lowercase, and a number.</AppText>
        <Input label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
        <Input label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
        <Button full disabled={!recent || !newPassword || !confirmPassword} loading={busy} onPress={changePassword}>
          Change password
        </Button>
      </Card>

      <Card style={styles.section}>
        <AppText variant="h4">Verified identity</AppText>
        <AppText variant="small">
          Email changes require confirmation. Phone changes require an enabled Supabase SMS provider and OTP verification.
        </AppText>
        <Input label="New email address" value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" autoCapitalize="none" />
        <Button
          full
          variant="dark"
          disabled={!recent || !newEmail}
          onPress={() => void execute(
            () => accountSecurityService.requestEmailChange(newEmail),
            'Check both email addresses to complete the verified change.'
          )}
        >
          Verify new email
        </Button>
        <Input label="New phone (+country code)" value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" />
        <Button
          full
          variant="dark"
          disabled={!recent || !newPhone}
          onPress={() => void execute(async () => {
            await accountSecurityService.requestPhoneChange(newPhone);
            setPendingPhone(newPhone);
          }, 'Enter the OTP sent by Supabase to complete the phone change.')}
        >
          Verify new phone
        </Button>
        {pendingPhone ? (
          <>
            <Input
              label="Phone verification code"
              value={phoneOtp}
              onChangeText={(value) => setPhoneOtp(value.replace(/\D/g, '').slice(0, 8))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
            />
            <Button
              full
              disabled={!phoneOtp}
              onPress={() => void execute(async () => {
                await accountSecurityService.verifyPhoneChange(pendingPhone, phoneOtp);
                setPendingPhone('');
                setPhoneOtp('');
                setNewPhone('');
              }, 'Your verified phone number was changed.')}
            >
              Confirm phone code
            </Button>
          </>
        ) : null}
      </Card>

      <Card style={styles.section}>
        <View style={styles.sectionTitle}>
          <ShieldCheck size={20} />
          <AppText variant="h4">Authenticator MFA</AppText>
        </View>
        {verifiedFactors.length ? verifiedFactors.map((factor) => (
          <View key={factor.id} style={styles.row}>
            <View style={styles.rowText}>
              <AppText>{factor.friendly_name || 'Authenticator app'}</AppText>
              <AppText variant="small">Verified {new Date(factor.created_at).toLocaleDateString()}</AppText>
            </View>
            <Button
              size="sm"
              variant="danger"
              disabled={!recent}
              onPress={() => void execute(
                () => accountSecurityService.unenrollTotp(factor.id),
                'Authenticator factor removed.'
              )}
            >
              Remove
            </Button>
          </View>
        )) : <AppText variant="bodyMuted">No authenticator is enrolled.</AppText>}
        {!enrollment ? (
          <Button full disabled={!recent} onPress={() => void beginTotpEnrollment()}>
            Add authenticator
          </Button>
        ) : (
          <View style={styles.enrollment}>
            <AppText variant="small">Scan this code in your authenticator app. The secret is shown once.</AppText>
            <Image
              accessibilityLabel="Authenticator setup QR code"
              source={{ uri: enrollment.totp.qr_code }}
              style={styles.qr}
              contentFit="contain"
            />
            <AppText selectable style={styles.secret}>{enrollment.totp.secret}</AppText>
            <Input
              label="6-digit authenticator code"
              value={totpCode}
              onChangeText={(value) => setTotpCode(value.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
            />
            <Button full disabled={totpCode.length !== 6} onPress={verifyEnrollment}>Verify authenticator</Button>
          </View>
        )}
        <AppText variant="small">
          Recovery uses your password plus a one-time code sent to the verified email. It removes MFA and signs out other devices.
        </AppText>
      </Card>

      <Card style={styles.section}>
        <View style={styles.sectionTitle}>
          <Laptop size={20} />
          <AppText variant="h4">Active sessions</AppText>
        </View>
        {sessions.map((session) => (
          <View key={session.id} style={styles.row}>
            <View style={styles.deviceIcon}>
              {/mobile|iphone|android/i.test(session.userAgent ?? '') ? <Smartphone size={18} /> : <Laptop size={18} />}
            </View>
            <View style={styles.rowText}>
              <AppText>{deviceLabel(session)}</AppText>
              <AppText variant="small">Active {new Date(session.updatedAt).toLocaleString()}</AppText>
            </View>
            <Button size="sm" variant="danger" disabled={!recent} onPress={() => revokeSession(session)}>
              Sign out
            </Button>
          </View>
        ))}
      </Card>

      <Card style={styles.section}>
        <AppText variant="h4">Recent security activity</AppText>
        {events.length ? events.map((event) => (
          <View key={event.id} style={styles.eventRow}>
            <AppText>{eventLabels[event.eventType] ?? 'Security update'}</AppText>
            <AppText variant="small">{new Date(event.createdAt).toLocaleString()}</AppText>
          </View>
        )) : <AppText variant="bodyMuted">No recent security changes.</AppText>}
      </Card>

      <Card style={styles.section}>
        <AppText variant="h4">Permanently delete account</AppText>
        <AppText variant="small">Reauthenticate above, enter your current verified identity, and type DELETE.</AppText>
        <Input
          label={user?.email ? 'Current email' : 'Current phone'}
          value={deleteEmail}
          onChangeText={setDeleteEmail}
          autoCapitalize="none"
        />
        <Input label="Type DELETE" value={deleteWord} onChangeText={setDeleteWord} autoCapitalize="characters" />
        <Button
          full
          variant="danger"
          disabled={!recent || deleteWord !== 'DELETE' || !deleteEmail}
          onPress={deleteAccount}
        >
          Permanently delete account
        </Button>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerSpacer: {
    width: 44
  },
  section: {
    gap: spacing.md
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs
  },
  rowText: {
    flex: 1,
    minWidth: 0
  },
  deviceIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center'
  },
  enrollment: {
    alignItems: 'center',
    gap: spacing.md
  },
  qr: {
    width: 220,
    height: 220,
    backgroundColor: '#FFFFFF'
  },
  secret: {
    fontFamily: Platform.select({ web: 'monospace', default: 'monospace' })
  },
  eventRow: {
    paddingVertical: spacing.xs
  }
});
