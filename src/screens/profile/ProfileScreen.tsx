import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Settings } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Badge, Button, IconButton, Screen, SegmentedControl, StatCard } from '@/components/ui';
import { currentUser } from '@/data/mockData';
import { colors, spacing, typography } from '@/design/tokens';
import type { AppStackParamList } from '@/navigation/routes';
import { useAuthStore } from '@/store/authStore';
import { compactNumber } from '@/utils/format';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Tab = 'Posts' | 'Stats' | 'Highlights';

export function ProfileScreen() {
  const navigation = useNavigation<Navigation>();
  const profile = useAuthStore((state) => state.profile) ?? currentUser;
  const [tab, setTab] = useState<Tab>('Posts');

  return (
    <Screen withTabPadding contentContainerStyle={styles.content}>
      <View style={styles.settings}>
        <IconButton icon={Settings} onPress={() => navigation.navigate('Settings')} />
      </View>
      <LinearGradient colors={['#0A0D1A', '#101629']} style={styles.cover}>
        <View style={styles.coverLines} />
      </LinearGradient>
      <View style={styles.avatarWrap}>
        <Avatar initials={profile.initials} size={84} online />
      </View>
      <View style={styles.profileInfo}>
        <View style={styles.nameRow}>
          <View style={{ flex: 1 }}>
            <AppText variant="h1" style={styles.name}>{profile.displayName}</AppText>
            <AppText variant="bodyMuted">@{profile.username} - {profile.city}, {profile.country}</AppText>
          </View>
          <Button size="sm" onPress={() => navigation.navigate('EditProfile')}>Edit Profile</Button>
        </View>
        <AppText variant="bodyMuted">{profile.bio}</AppText>
        <View style={styles.badges}>
          {profile.sports.map((sport) => (
            <Badge key={sport}>{sport}</Badge>
          ))}
          <Badge tone="orange">PRO</Badge>
        </View>
        <View style={styles.stats}>
          <StatCard value={compactNumber(profile.stats.followers)} label="Followers" tone="orange" />
          <StatCard value={profile.stats.following} label="Following" />
          <StatCard value={profile.stats.posts} label="Posts" />
          <StatCard value={`${profile.stats.winRate}%`} label="Win %" tone="green" />
        </View>
      </View>
      <View style={styles.tabs}>
        <SegmentedControl value={tab} options={['Posts', 'Stats', 'Highlights']} onChange={setTab} />
      </View>
      {tab === 'Posts' ? <ProfileGrid /> : null}
      {tab === 'Stats' ? <StatsPanel /> : null}
      {tab === 'Highlights' ? <HighlightsPanel /> : null}
    </Screen>
  );
}

function ProfileGrid() {
  return (
    <View style={styles.grid}>
      {['B', 'S', 'F', 'T', 'H', 'B'].map((item, index) => (
        <Pressable key={`${item}-${index}`} style={[styles.gridItem, index === 1 ? styles.gridStat : null]}>
          <AppText variant="h2">{item}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

function StatsPanel() {
  const stats = [
    ['Speed', 85],
    ['Power', 90],
    ['Agility', 75],
    ['Endurance', 80]
  ] as const;

  return (
    <View style={styles.panel}>
      <AppText variant="h4">Season Stats - 2026</AppText>
      {stats.map(([label, value]) => (
        <View key={label} style={styles.statLine}>
          <View style={styles.statLineTop}>
            <AppText variant="small">{label}</AppText>
            <AppText style={styles.statValue}>{value}</AppText>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${value}%` }]} />
          </View>
        </View>
      ))}
      <View style={styles.threeStats}>
        <StatCard value="34" label="Best PTS" tone="orange" />
        <StatCard value="8.2" label="Avg REB" />
        <StatCard value="147" label="Games" tone="green" />
      </View>
    </View>
  );
}

function HighlightsPanel() {
  return (
    <View style={styles.panel}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {['Add', 'Season', 'Best Plays', 'Goals', 'Streaks'].map((item, index) => (
          <View key={item} style={styles.highlightPill}>
            <View style={[styles.highlightCircle, index === 0 ? styles.highlightAdd : null]}>
              <AppText variant="h3">{index === 0 ? '+' : item.slice(0, 1)}</AppText>
            </View>
            <AppText variant="small">{item}</AppText>
          </View>
        ))}
      </ScrollView>
      <View style={styles.highlightCards}>
        <LinearGradient colors={['#1A0800', '#2A1200']} style={styles.highlightCard}>
          <AppText variant="h2" color={colors.orange[500]}>MVP</AppText>
          <AppText style={styles.highlightTitle}>Match vs Challengers</AppText>
          <Badge tone="orange">34 PTS</Badge>
        </LinearGradient>
        <LinearGradient colors={['#0A1A1A', '#0F2A2A']} style={styles.highlightCard}>
          <AppText variant="h2" color={colors.semantic.success}>30</AppText>
          <AppText style={styles.highlightTitle}>Day Training Streak</AppText>
          <Badge tone="green">STREAK</Badge>
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 0
  },
  settings: {
    position: 'absolute',
    top: 54,
    right: spacing.screen,
    zIndex: 5
  },
  cover: {
    height: 200
  },
  coverLines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,90,31,0.25)'
  },
  avatarWrap: {
    marginTop: -42,
    marginLeft: spacing.screen,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: colors.dark[950],
    width: 92
  },
  profileInfo: {
    padding: spacing.screen,
    gap: spacing.sm
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm
  },
  name: {
    fontSize: 28,
    lineHeight: 31
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap'
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs
  },
  tabs: {
    paddingHorizontal: spacing.screen,
    marginBottom: 16
  },
  grid: {
    paddingHorizontal: spacing.screen,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2
  },
  gridItem: {
    width: '32.8%',
    aspectRatio: 1,
    backgroundColor: colors.dark[800],
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  gridStat: {
    backgroundColor: '#0A1A08'
  },
  panel: {
    marginHorizontal: spacing.screen,
    backgroundColor: colors.dark[800],
    borderRadius: 18,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700]
  },
  statLine: {
    gap: 4
  },
  statLineTop: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  statValue: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 12
  },
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.dark[700],
    overflow: 'hidden'
  },
  fill: {
    height: 3,
    backgroundColor: colors.orange[500]
  },
  threeStats: {
    flexDirection: 'row',
    gap: spacing.xs
  },
  highlightPill: {
    alignItems: 'center',
    gap: 6,
    marginRight: 12
  },
  highlightCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.dark[700],
    alignItems: 'center',
    justifyContent: 'center'
  },
  highlightAdd: {
    borderStyle: 'dashed',
    borderColor: colors.orange[400]
  },
  highlightCards: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  highlightCard: {
    flex: 1,
    aspectRatio: 0.8,
    borderRadius: 14,
    padding: 12,
    justifyContent: 'flex-end',
    gap: spacing.xs
  },
  highlightTitle: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 13
  }
});
