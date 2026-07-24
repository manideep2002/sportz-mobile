import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, CalendarCheck, ChevronLeft, Heart, HelpCircle, Lock, LogOut, Moon, ShieldCheck, Trash2, UserRound, type LucideIcon } from 'lucide-react-native';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useAppTranslation } from '@/i18n';

import { AppText, IconButton, Screen } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors, spacing, typography } from '@/design/tokens';
import type { AppStackParamList } from '@/navigation/routes';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

type SettingsItemConfig = {
  label: string;
  detail?: string;
  icon: LucideIcon;
  route?: keyof AppStackParamList;
  adminBookings?: boolean;
};

export function SettingsScreen() {
  const navigation = useNavigation<Navigation>();
  const { t } = useAppTranslation();
  const { colors: theme } = useAppTheme();
  const signOut = useAuthStore((state) => state.signOut);
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const profile = useAuthStore((state) => state.profile);
  const themeMode = useUiStore((state) => state.themeMode);
  const accentColor = useUiStore((state) => state.accentColor);
  const accountItems: SettingsItemConfig[] = [
    { label: t('settings.profile'), detail: t('settings.profileDetail'), icon: UserRound, route: 'EditProfile' },
    { label: t('settings.privacy'), detail: t('settings.privacyDetail'), icon: Lock, route: 'Privacy' },
    { label: t('settings.notifications'), detail: t('settings.notificationsDetail'), icon: Bell, route: 'NotificationSettings' }
  ];
  const preferenceItems: SettingsItemConfig[] = [
    {
      label: t('settings.appearance'),
      detail: t('appearance.summary', {
        theme: t(`appearance.${themeMode}`),
        accent: t(`appearance.${accentColor}`)
      }),
      icon: Moon,
      route: 'Appearance'
    },
    {
      label: t('settings.sports'),
      detail: profile?.sports.length ? profile.sports.join(', ') : t('settings.sportsFallback'),
      icon: Heart,
      route: 'SportsInterests'
    }
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      Alert.alert(t('settings.signOutFailed'), error instanceof Error ? error.message : t('common.retry'));
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(t('settings.deleteConfirmTitle'), t('settings.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAccount();
          } catch (error) {
            Alert.alert(t('settings.deleteFailed'), error instanceof Error ? error.message : t('common.retry'));
          }
        }
      }
    ], { cancelable: true });
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton accessibilityLabel={t('common.back')} icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">{t('settings.title')}</AppText>
        <View style={{ width: 40 }} />
      </View>
      <Section title={t('settings.account')} items={accountItems} navigation={navigation} />
      <SettingsItem
        label={t('settings.bookings')}
        detail={t('settings.bookingsDetail')}
        icon={CalendarCheck}
        onPress={() => navigation.navigate('CourtBookings')}
      />
      {profile?.isAdmin ? (
        <Section
          title={t('settings.admin')}
          items={[
            { label: t('settings.moderation'), detail: t('settings.moderationDetail'), icon: ShieldCheck, route: 'Moderation' },
            {
              label: t('settings.courtBookings'),
              detail: t('settings.courtBookingsDetail'),
              icon: CalendarCheck,
              route: 'CourtBookings',
              adminBookings: true
            }
          ]}
          navigation={navigation}
        />
      ) : null}
      <Section title={t('settings.preferences')} items={preferenceItems} navigation={navigation} />
      <AppText variant="caption" style={styles.sectionTitle}>{t('settings.support')}</AppText>
      <SettingsItem label={t('settings.help')} icon={HelpCircle} onPress={() => navigation.navigate('Help')} />
      <Pressable style={[styles.item, { borderBottomColor: theme.border }]} onPress={handleDeleteAccount}>
        <View style={[styles.itemIcon, styles.dangerIcon]}><Trash2 size={18} color={colors.semantic.danger} /></View>
        <View style={{ flex: 1 }}>
          <AppText style={[styles.itemLabel, { color: colors.semantic.danger }]}>{t('settings.deleteAccount')}</AppText>
        </View>
      </Pressable>
      <Pressable style={[styles.item, { borderBottomColor: theme.border }]} onPress={handleSignOut}>
        <View style={[styles.itemIcon, styles.dangerIcon]}><LogOut size={18} color={colors.semantic.danger} /></View>
        <View style={{ flex: 1 }}>
          <AppText style={[styles.itemLabel, { color: colors.semantic.danger }]}>{t('settings.signOut')}</AppText>
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
            if (item.route === 'CourtBookings' && item.adminBookings) {
              navigation.navigate('CourtBookings', { admin: true });
            } else if (item.route) {
              navigation.navigate(item.route as never);
            }
          }}
        />
      ))}
    </View>
  );
}

function SettingsItem({ label, detail, icon: Icon, onPress }: { label: string; detail?: string; icon: LucideIcon; onPress?: () => void }) {
  const { colors: theme } = useAppTheme();
  return (
    <Pressable style={[styles.item, { borderBottomColor: theme.border }]} onPress={onPress}>
      <View style={[styles.itemIcon, { backgroundColor: theme.accentSoft }]}><Icon size={18} color={theme.accent} /></View>
      <View style={{ flex: 1 }}>
        <AppText style={[styles.itemLabel, { color: theme.text }]}>{label}</AppText>
        {detail ? <AppText variant="small">{detail}</AppText> : null}
      </View>
      <AppText variant="bodyMuted">{'>'}</AppText>
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
  }
});
