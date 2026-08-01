import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, ChevronLeft } from 'lucide-react-native';

import { AppText, IconButton, Screen } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors, spacing, typography } from '@/design/tokens';
import {
  defaultNotificationPreferences,
  hydrateNotificationSettings,
  saveNotificationPreferences,
  subscribeToNotificationSettings,
  type NotificationPreferenceKey
} from '@/lib/notifications';
import type { AppStackParamList } from '@/navigation/routes';
import { supabase } from '@/lib/supabase';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
const notificationTypes: NotificationPreferenceKey[] = [
  'likes',
  'comments',
  'mentions',
  'follows',
  'messages',
  'events',
  'invites'
];

export function NotificationSettingsScreen() {
  const navigation = useNavigation<Navigation>();
  const { colors: theme } = useAppTheme();
  const [userId, setUserId] = useState<string | undefined>();
  const [enabled, setEnabled] = useState(true);
  const [preferences, setPreferences] = useState<Record<NotificationPreferenceKey, boolean>>(defaultNotificationPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id)).catch(() => setUserId(undefined));
  }, []);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    void hydrateNotificationSettings(userId)
      .then((settings) => { if (active) { setEnabled(settings.enabled); setPreferences(settings.preferences); setError(null); } })
      .catch(() => { if (active) setError('Could not load notification preferences. Try again.'); })
      .finally(() => { if (active) setLoading(false); });
    const unsubscribe = subscribeToNotificationSettings(userId, (settings) => {
      if (!active) return;
      setEnabled(settings.enabled);
      setPreferences(settings.preferences);
    });
    return () => { active = false; unsubscribe(); };
  }, [userId]);

  const persist = async (nextEnabled: boolean, nextPreferences: Record<NotificationPreferenceKey, boolean>) => {
    const previous = { enabled, preferences };
    setEnabled(nextEnabled);
    setPreferences(nextPreferences);
    setSaving(true);
    setError(null);
    try {
      await saveNotificationPreferences(nextEnabled, nextPreferences);
    } catch {
      setEnabled(previous.enabled);
      setPreferences(previous.preferences);
      setError('Could not save notification preferences. Your previous settings were restored. Try again.');
    } finally { setSaving(false); }
  };

  const toggleEnabled = async () => {
    await persist(!enabled, preferences);
  };

  const togglePreference = async (key: NotificationPreferenceKey) => {
    const next = { ...preferences, [key]: !preferences[key] };
    await persist(enabled, next);
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Notifications</AppText>
        <View style={{ width: 40 }} />
      </View>
      <AppText variant="bodyMuted">
        Activity notifications remain available in the in-app Notifications screen. These controls only change push alerts.
      </AppText>
      {loading ? <AppText variant="small" accessibilityRole="progressbar">Loading notification preferences…</AppText> : null}
      {error ? <AppText accessibilityRole="alert" style={{ color: theme.danger }}>{error}</AppText> : null}
      <ToggleRow
        label="Push notifications"
        detail="Allow SPORTZ to send activity alerts to this device"
        icon={Bell}
        value={enabled}
        disabled={saving}
        onPress={toggleEnabled}
      />
      <AppText variant="caption" style={styles.sectionTitle}>Push categories</AppText>
      {notificationTypes.map((type) => (
        <ToggleRow key={type} label={type[0].toUpperCase() + type.slice(1)} value={preferences[type]} disabled={saving} onPress={() => void togglePreference(type)} />
      ))}
    </Screen>
  );
}

function ToggleRow({ label, detail, value, onPress, icon: Icon, disabled }: { label: string; detail?: string; value: boolean; onPress: () => void; icon?: typeof Bell; disabled?: boolean }) {
  const { colors: theme } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={detail}
      accessibilityState={disabled ? { checked: value, disabled: true } : { checked: value }}
      style={[styles.row, { backgroundColor: theme.surface }]}
      onPress={onPress}
      disabled={disabled ? true : undefined}
    >
      {Icon ? <Icon size={18} color={theme.accent} /> : null}
      <View style={{ flex: 1 }}>
        <AppText style={styles.label}>{label}</AppText>
        {detail ? <AppText variant="small">{detail}</AppText> : null}
      </View>
      <View style={[styles.switch, { backgroundColor: value ? theme.accent : theme.surfaceMuted }]}>
        <View style={[styles.knob, value ? styles.knobActive : null]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { marginTop: spacing.xs },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: 14, backgroundColor: colors.dark[800] },
  label: { color: colors.text.primary, fontFamily: typography.bodyBold, fontSize: 14 },
  switch: { width: 44, height: 26, borderRadius: 13, padding: 3, backgroundColor: colors.dark[700] },
  switchActive: { backgroundColor: colors.orange[500] },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.light[0] },
  knobActive: { marginLeft: 'auto' }
});
