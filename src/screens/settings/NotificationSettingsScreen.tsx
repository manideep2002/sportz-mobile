import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, ChevronLeft } from 'lucide-react-native';

import { AppText, IconButton, Screen } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import {
  defaultNotificationPreferences,
  saveNotificationPreferences,
  notificationPreferencesKey,
  pushNotificationsEnabledKey,
  type NotificationPreferenceKey
} from '@/lib/notifications';
import type { AppStackParamList } from '@/navigation/routes';

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
  const [enabled, setEnabled] = useState(true);
  const [preferences, setPreferences] = useState<Record<NotificationPreferenceKey, boolean>>(defaultNotificationPreferences);

  useEffect(() => {
    void (async () => {
      setEnabled((await AsyncStorage.getItem(pushNotificationsEnabledKey)) !== 'false');
      const saved = await AsyncStorage.getItem(notificationPreferencesKey);
      if (saved) {
        setPreferences({
          ...defaultNotificationPreferences,
          ...(JSON.parse(saved) as Partial<Record<NotificationPreferenceKey, boolean>>)
        });
      }
    })();
  }, []);

  const toggleEnabled = async () => {
    const next = !enabled;
    setEnabled(next);
    await saveNotificationPreferences(next, preferences);
  };

  const togglePreference = async (key: NotificationPreferenceKey) => {
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    await saveNotificationPreferences(enabled, next);
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Notifications</AppText>
        <View style={{ width: 40 }} />
      </View>
      <ToggleRow label="Push notifications" detail="Allow SPORTZ to register this device" icon={Bell} value={enabled} onPress={toggleEnabled} />
      {notificationTypes.map((type) => (
        <ToggleRow key={type} label={type[0].toUpperCase() + type.slice(1)} value={preferences[type]} onPress={() => void togglePreference(type)} />
      ))}
    </Screen>
  );
}

function ToggleRow({ label, detail, value, onPress, icon: Icon }: { label: string; detail?: string; value: boolean; onPress: () => void; icon?: typeof Bell }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      {Icon ? <Icon size={18} color={colors.orange[500]} /> : null}
      <View style={{ flex: 1 }}>
        <AppText style={styles.label}>{label}</AppText>
        {detail ? <AppText variant="small">{detail}</AppText> : null}
      </View>
      <View style={[styles.switch, value ? styles.switchActive : null]}>
        <View style={[styles.knob, value ? styles.knobActive : null]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: 14, backgroundColor: colors.dark[800] },
  label: { color: colors.text.primary, fontFamily: typography.bodyBold, fontSize: 14 },
  switch: { width: 44, height: 26, borderRadius: 13, padding: 3, backgroundColor: colors.dark[700] },
  switchActive: { backgroundColor: colors.orange[500] },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.light[0] },
  knobActive: { marginLeft: 'auto' }
});
