import { Image } from 'expo-image';
import { ChevronLeft, KeyRound, Laptop, ShieldCheck, Smartphone } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Factor, UserIdentity } from '@supabase/supabase-js';

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
type ResourceState = { loading: boolean; error: string | null; loaded: boolean };
const initialResourceState: ResourceState = { loading: true, error: null, loaded: false };

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
  const [recent, setRecent] = useState<boolean | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const actionLocks = useRef(new Set<string>());
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
  const [identities, setIdentities] = useState<UserIdentity[]>([]);
  const [recentState, setRecentState] = useState<ResourceState>(initialResourceState);
  const [sessionsState, setSessionsState] = useState<ResourceState>(initialResourceState);
  const [factorsState, setFactorsState] = useState<ResourceState>(initialResourceState);
  const [eventsState, setEventsState] = useState<ResourceState>(initialResourceState);
  const [identitiesState, setIdentitiesState] = useState<ResourceState>(initialResourceState);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deleteWord, setDeleteWord] = useState('');

  const verifiedFactors = useMemo(
    () => factors.filter((factor) => factor.status === 'verified'),
    [factors]
  );
  const deletionIdentity = user?.email ?? user?.phone ?? '';

  const loadRecent = useCallback(async () => {
    setRecentState((state) => ({ ...state, loading: true, error: null }));
    try {
      setRecent(await accountSecurityService.hasRecentAuthentication());
      setRecentState({ loading: false, error: null, loaded: true });
    } catch (error) {
      setRecent(null);
      setRecentState({ loading: false, error: error instanceof Error ? error.message : 'Could not verify this session.', loaded: true });
    }
  }, []);

  const loadSessions = useCallback(async () => {
    setSessionsState((state) => ({ ...state, loading: true, error: null }));
    try {
      setSessions(await accountSecurityService.listSessions());
      setSessionsState({ loading: false, error: null, loaded: true });
    } catch (error) {
      setSessionsState({ loading: false, error: error instanceof Error ? error.message : 'Could not load sessions.', loaded: true });
    }
  }, []);

  const loadFactors = useCallback(async () => {
    setFactorsState((state) => ({ ...state, loading: true, error: null }));
    try {
      setFactors(await accountSecurityService.listMfaFactors());
      setFactorsState({ loading: false, error: null, loaded: true });
    } catch (error) {
      setFactorsState({ loading: false, error: error instanceof Error ? error.message : 'Could not load authenticators.', loaded: true });
    }
  }, []);

  const loadEvents = useCallback(async () => {
    setEventsState((state) => ({ ...state, loading: true, error: null }));
    try {
      setEvents(await accountSecurityService.listSecurityEvents());
      setEventsState({ loading: false, error: null, loaded: true });
    } catch (error) {
      setEventsState({ loading: false, error: error instanceof Error ? error.message : 'Could not load security activity.', loaded: true });
    }
  }, []);

  const loadIdentities = useCallback(async () => {
    setIdentitiesState((state) => ({ ...state, loading: true, error: null }));
    try {
      setIdentities(await accountSecurityService.listIdentities());
      setIdentitiesState({ loading: false, error: null, loaded: true });
    } catch (error) {
      setIdentitiesState({ loading: false, error: error instanceof Error ? error.message : 'Could not load linked identities.', loaded: true });
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([loadRecent(), loadSessions(), loadFactors(), loadEvents(), loadIdentities()]);
  }, [loadEvents, loadFactors, loadIdentities, loadRecent, loadSessions]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const execute = async (key: string, operation: () => Promise<unknown>, success: string, refreshAfter = true) => {
    if (actionLocks.current.has(key)) return;
    actionLocks.current.add(key);
    setBusyAction(key);
    try {
      await operation();
      Alert.alert('Security updated', success);
      if (refreshAfter) await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      if (/recent authentication/i.test(message)) {
        setRecent(null);
        void loadRecent();
      }
      Alert.alert('Could not update security', message);
    } finally {
      actionLocks.current.delete(key);
      setBusyAction((current) => current === key ? null : current);
    }
  };

  const reauthenticate = () => execute('reauthenticate', async () => {
    const result = await accountSecurityService.reauthenticate(currentPassword);
    setRecent(new Date(result.expiresAt).getTime() > Date.now());
    setCurrentPassword('');
  }, 'Sensitive actions are unlocked for 10 minutes on this session.');

  const changePassword = () => {
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Enter the same new password twice.');
      return;
    }
    void execute('change-password', async () => {
      await accountSecurityService.updatePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setRecent(false);
    }, 'Your password changed. Other devices were signed out.');
  };

  const beginTotpEnrollment = () => execute('enroll-totp', async () => {
    const data = await accountSecurityService.enrollTotp(`SPORTZ ${Platform.OS}`);
    setEnrollment(data);
  }, 'Scan the QR code, then verify a code to finish.');

  const verifyEnrollment = () => {
    if (!enrollment) return;
    void execute('verify-totp', async () => {
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
          onPress: () => {
            if (!sessions.some((active) => active.id === session.id)) {
              Alert.alert('Session changed', 'That session is no longer active. Refreshing sessions now.');
              void loadSessions();
              return;
            }
            void execute(
            `revoke-session:${session.id}`,
            () => accountSecurityService.revokeSession(session),
            session.isCurrent ? 'This device was signed out.' : 'The selected device was signed out.',
            !session.isCurrent
          );
          }
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
          onPress: () => void execute('delete-account', async () => {
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
        {recentState.loading ? <ActivityIndicator accessibilityLabel="Loading recent authentication" /> : null}
        {recentState.error ? (
          <View style={styles.inlineState}>
            <AppText accessibilityRole="alert" variant="bodyMuted">{recentState.error}</AppText>
            <Button size="sm" accessibilityLabel="Retry recent authentication" onPress={() => void loadRecent()}>Retry</Button>
          </View>
        ) : null}
        {!recentState.loading && !recentState.error ? <AppText variant="bodyMuted">
          {recent === true
            ? 'Identity verified on this session. Sensitive actions are temporarily unlocked.'
            : 'Enter your current password before changing identity, sessions, MFA, or deleting the account.'}
        </AppText> : null}
        {recentState.loaded && !recentState.error && recent === false ? (
          <>
            <Input
              label="Current password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              textContentType="password"
            />
            <Button full loading={busyAction === 'reauthenticate'} disabled={!currentPassword || busyAction !== null} onPress={() => void reauthenticate()}>
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
        <Button full disabled={recent !== true || !newPassword || !confirmPassword || busyAction !== null} loading={busyAction === 'change-password'} onPress={changePassword}>
          Change password
        </Button>
      </Card>

      <Card style={styles.section}>
        <AppText variant="h4">Verified identity</AppText>
        {identitiesState.loading ? <ActivityIndicator accessibilityLabel="Loading linked identities" /> : null}
        {identitiesState.error ? (
          <View style={styles.inlineState}>
            <AppText accessibilityRole="alert" variant="bodyMuted">{identitiesState.error}</AppText>
            <Button size="sm" accessibilityLabel="Retry linked identities" onPress={() => void loadIdentities()}>Retry</Button>
          </View>
        ) : null}
        {!identitiesState.loading && !identitiesState.error ? (
          identities.length ? (
            <AppText variant="small">Linked sign-in methods: {identities.map((identity) => identity.provider).join(', ')}</AppText>
          ) : <AppText variant="bodyMuted">No linked sign-in identities were returned.</AppText>
        ) : null}
        <AppText variant="small">
          Email changes require confirmation. Phone changes require an enabled Supabase SMS provider and OTP verification.
        </AppText>
        <Input label="New email address" value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" autoCapitalize="none" />
        <Button
          full
          variant="dark"
          disabled={recent !== true || !newEmail || busyAction !== null}
          onPress={() => void execute(
            'change-email',
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
          disabled={recent !== true || !newPhone || busyAction !== null}
          onPress={() => void execute('change-phone', async () => {
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
              disabled={!phoneOtp || busyAction !== null}
              onPress={() => void execute('verify-phone', async () => {
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
        {factorsState.loading ? <ActivityIndicator accessibilityLabel="Loading authenticator factors" /> : null}
        {factorsState.error ? (
          <View style={styles.inlineState}>
            <AppText accessibilityRole="alert" variant="bodyMuted">{factorsState.error}</AppText>
            <Button size="sm" accessibilityLabel="Retry authenticator factors" onPress={() => void loadFactors()}>Retry</Button>
          </View>
        ) : null}
        {!factorsState.loading && !factorsState.error && verifiedFactors.length ? verifiedFactors.map((factor) => (
          <View key={factor.id} style={styles.row}>
            <View style={styles.rowText}>
              <AppText>{factor.friendly_name || 'Authenticator app'}</AppText>
              <AppText variant="small">Verified {new Date(factor.created_at).toLocaleDateString()}</AppText>
            </View>
            <Button
              size="sm"
              variant="danger"
              disabled={recent !== true || busyAction !== null}
              loading={busyAction === `remove-factor:${factor.id}`}
              onPress={() => void execute(
                `remove-factor:${factor.id}`,
                () => accountSecurityService.unenrollTotp(factor.id),
                'Authenticator factor removed.'
              )}
            >
              Remove
            </Button>
          </View>
        )) : null}
        {!factorsState.loading && !factorsState.error && !verifiedFactors.length ? <AppText variant="bodyMuted">No authenticator is enrolled.</AppText> : null}
        {!enrollment && !factorsState.error ? (
          <Button full disabled={recent !== true || factorsState.loading || busyAction !== null} loading={busyAction === 'enroll-totp'} onPress={() => void beginTotpEnrollment()}>
            Add authenticator
          </Button>
        ) : null}
        {enrollment ? (
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
            <Button full disabled={totpCode.length !== 6 || busyAction !== null} loading={busyAction === 'verify-totp'} onPress={verifyEnrollment}>Verify authenticator</Button>
          </View>
        ) : null}
        <AppText variant="small">
          Recovery uses your password plus a one-time code sent to the verified email. It removes MFA and signs out other devices.
        </AppText>
      </Card>

      <Card style={styles.section}>
        <View style={styles.sectionTitle}>
          <Laptop size={20} />
          <AppText variant="h4">Active sessions</AppText>
        </View>
        {sessionsState.loading ? <ActivityIndicator accessibilityLabel="Loading active sessions" /> : null}
        {sessionsState.error ? (
          <View style={styles.inlineState}>
            <AppText accessibilityRole="alert" variant="bodyMuted">{sessionsState.error}</AppText>
            <Button size="sm" accessibilityLabel="Retry active sessions" onPress={() => void loadSessions()}>Retry</Button>
          </View>
        ) : null}
        {!sessionsState.loading && !sessionsState.error ? sessions.map((session) => (
          <View key={session.id} style={styles.row}>
            <View style={styles.deviceIcon}>
              {/mobile|iphone|android/i.test(session.userAgent ?? '') ? <Smartphone size={18} /> : <Laptop size={18} />}
            </View>
            <View style={styles.rowText}>
              <AppText>{deviceLabel(session)}</AppText>
              <AppText variant="small">Active {new Date(session.updatedAt).toLocaleString()}</AppText>
            </View>
            <Button size="sm" variant="danger" disabled={recent !== true || busyAction !== null} loading={busyAction === `revoke-session:${session.id}`} onPress={() => revokeSession(session)}>
              Sign out
            </Button>
          </View>
        )) : null}
        {!sessionsState.loading && !sessionsState.error && sessions.length === 0 ? <AppText variant="bodyMuted">No active sessions were returned.</AppText> : null}
      </Card>

      <Card style={styles.section}>
        <AppText variant="h4">Recent security activity</AppText>
        {eventsState.loading ? <ActivityIndicator accessibilityLabel="Loading security activity" /> : null}
        {eventsState.error ? (
          <View style={styles.inlineState}>
            <AppText accessibilityRole="alert" variant="bodyMuted">{eventsState.error}</AppText>
            <Button size="sm" accessibilityLabel="Retry security activity" onPress={() => void loadEvents()}>Retry</Button>
          </View>
        ) : null}
        {!eventsState.loading && !eventsState.error && events.length ? events.map((event) => (
          <View key={event.id} style={styles.eventRow}>
            <AppText>{eventLabels[event.eventType] ?? 'Security update'}</AppText>
            <AppText variant="small">{new Date(event.createdAt).toLocaleString()}</AppText>
          </View>
        )) : null}
        {!eventsState.loading && !eventsState.error && events.length === 0 ? <AppText variant="bodyMuted">No recent security changes.</AppText> : null}
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
          disabled={recent !== true || deleteWord !== 'DELETE' || !deleteEmail || busyAction !== null}
          loading={busyAction === 'delete-account'}
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
  },
  inlineState: { gap: spacing.sm, alignItems: 'flex-start' }
});
