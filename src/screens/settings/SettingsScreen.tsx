import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, ChevronLeft, Globe, Heart, HelpCircle, Lock, LogOut, Moon, UserRound, type LucideIcon } from 'lucide-react-native';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText, IconButton, Screen } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import type { AppStackParamList } from '@/navigation/routes';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

type SettingsItemConfig = {
  label: string;
  detail?: string;
  icon: LucideIcon;
  route?: 'EditProfile';
};

const accountItems: SettingsItemConfig[] = [
  { label: 'Profile Settings', detail: 'Edit name, bio, sport, position', icon: UserRound, route: 'EditProfile' as const },
  { label: 'Privacy & Security', detail: 'Account visibility, block list', icon: Lock },
  { label: 'Notifications', detail: 'Push, email, activity alerts', icon: Bell }
];

const preferenceItems: SettingsItemConfig[] = [
  { label: 'Language & Region', detail: 'English - India', icon: Globe },
  { label: 'Appearance', detail: 'Dark mode - Orange accent', icon: Moon },
  { label: 'Sports Interests', detail: 'Basketball, Football, Tennis', icon: Heart }
];

export function SettingsScreen() {
  const navigation = useNavigation<Navigation>();
  const signOut = useAuthStore((state) => state.signOut);
  const themeMode = useUiStore((state) => state.themeMode);
  const setThemeMode = useUiStore((state) => state.setThemeMode);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      Alert.alert('Sign out failed', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Settings</AppText>
        <View style={{ width: 40 }} />
      </View>
      <Section title="Account" items={accountItems} navigation={navigation} />
      <Section title="Preferences" items={preferenceItems} navigation={navigation} />
      <Pressable style={styles.item} onPress={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}>
        <View style={styles.itemIcon}><Moon size={18} color={colors.text.secondary} /></View>
        <View style={{ flex: 1 }}>
          <AppText style={styles.itemLabel}>Toggle Theme</AppText>
          <AppText variant="small">Current: {themeMode}</AppText>
        </View>
        <View style={[styles.switch, themeMode === 'dark' ? styles.switchActive : null]}>
          <View style={[styles.knob, themeMode === 'dark' ? styles.knobActive : null]} />
        </View>
      </Pressable>
      <AppText variant="caption" style={styles.sectionTitle}>Support</AppText>
      <SettingsItem label="Help & Support" icon={HelpCircle} />
      <Pressable style={styles.item} onPress={handleSignOut}>
        <View style={[styles.itemIcon, styles.dangerIcon]}><LogOut size={18} color={colors.semantic.danger} /></View>
        <View style={{ flex: 1 }}>
          <AppText style={[styles.itemLabel, { color: colors.semantic.danger }]}>Sign Out</AppText>
        </View>
      </Pressable>
    </Screen>
  );
}

function Section({ title, items, navigation }: { title: string; items: SettingsItemConfig[]; navigation: Navigation }) {
  return (
    <View>
      <AppText variant="caption" style={styles.sectionTitle}>{title}</AppText>
      {items.map((item) => (
        <SettingsItem
          key={item.label}
          label={item.label}
          detail={item.detail}
          icon={item.icon}
          onPress={() => {
            if (item.route) navigation.navigate(item.route);
          }}
        />
      ))}
    </View>
  );
}

function SettingsItem({ label, detail, icon: Icon, onPress }: { label: string; detail?: string; icon: LucideIcon; onPress?: () => void }) {
  return (
    <Pressable style={styles.item} onPress={onPress}>
      <View style={styles.itemIcon}><Icon size={18} color={colors.orange[500]} /></View>
      <View style={{ flex: 1 }}>
        <AppText style={styles.itemLabel}>{label}</AppText>
        {detail ? <AppText variant="small">{detail}</AppText> : null}
      </View>
      <AppText variant="bodyMuted">›</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 0
  },
  header: {
    paddingHorizontal: spacing.screen,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionTitle: {
    paddingHorizontal: spacing.screen,
    paddingTop: 14,
    paddingBottom: 8
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.screen,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.dark[700]
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.overlays.orangeSoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dangerIcon: {
    backgroundColor: colors.overlays.dangerSoft
  },
  itemLabel: {
    color: colors.text.primary,
    fontFamily: typography.bodyFamily,
    fontSize: 14
  },
  switch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 3,
    backgroundColor: colors.dark[700]
  },
  switchActive: {
    backgroundColor: colors.orange[500]
  },
  knob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.light[0]
  },
  knobActive: {
    marginLeft: 'auto'
  }
});
