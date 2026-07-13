import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Plus } from 'lucide-react-native';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { CommunityCard } from '@/components/community/CommunityCard';

import { AppRefreshControl, AppText, Avatar, Button, Card, IconButton, Screen, SegmentedControl, VerifiedName } from '@/components/ui';

import { colors, spacing } from '@/design/tokens';
import { useCommunities, usePendingCommunityInvites, useRespondCommunityInvite } from '@/hooks/useCommunities';
import type { AppStackParamList } from '@/navigation/routes';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Tab = 'Groups' | 'Pages';

export function CommunityScreen() {
  const navigation = useNavigation<Navigation>();
  const [tab, setTab] = useState<Tab>('Groups');
  const { data: communities = [], isLoading, isError, isRefetching, refetch } = useCommunities();
  const { data: pendingInvites = [], isLoading: invitesLoading, refetch: refetchInvites } = usePendingCommunityInvites();
  const respondInvite = useRespondCommunityInvite();
  const filtered = communities.filter((community) => (tab === 'Groups' ? community.type === 'group' : community.type === 'page'));
  const openCommunity = (community: (typeof communities)[number]) => {
    if (community.type === 'group') navigation.navigate('GroupDetail', { communityId: community.id });
    else navigation.navigate('PageDetail', { communityId: community.id });
  };

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={
        <AppRefreshControl
          refreshing={isRefetching}
          onRefresh={() => void Promise.all([refetch(), refetchInvites()])}
        />
      }
    >
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h2">
          Community<AppText variant="h2" color={colors.orange[500]}>.</AppText>
        </AppText>
        <Button size="sm" icon={Plus} onPress={() => navigation.navigate('CreateCommunity')}>New</Button>
      </View>
      <SegmentedControl value={tab} options={['Groups', 'Pages']} onChange={setTab} />
      {tab === 'Groups' ? (
        <View style={styles.invites}>
          <View style={styles.sectionHeader}>
            <AppText variant="h4">Invites</AppText>
            {invitesLoading ? <ActivityIndicator color={colors.orange[500]} /> : null}
          </View>
          {!invitesLoading && pendingInvites.length === 0 ? (
            <AppText variant="bodyMuted">No pending group invites.</AppText>
          ) : null}
          {pendingInvites.map((invite) => (
            <Card key={invite.id} style={styles.inviteCard}>
              <View style={styles.inviteHeader}>
                <View style={styles.inviteLogo}>
                  <AppText style={styles.inviteLogoText}>{invite.community.name.charAt(0).toUpperCase()}</AppText>
                </View>
                <View style={styles.inviteMeta}>
                  <AppText style={styles.inviteTitle}>{invite.community.name}</AppText>
                  <AppText variant="small">
                    {invite.community.sport} - {invite.community.isPrivate ? 'Private' : 'Public'} group
                  </AppText>
                </View>
              </View>
              {invite.inviter ? (
                <View style={styles.inviterRow}>
                  <Avatar initials={invite.inviter.initials} uri={invite.inviter.avatarUrl} size={28} />
                  <VerifiedName profile={invite.inviter} style={styles.inviterName} numberOfLines={1} />
                </View>
              ) : null}
              <View style={styles.inviteActions}>
                <Button
                  size="sm"
                  style={styles.inviteAction}
                  loading={respondInvite.isPending}
                  onPress={() => respondInvite.mutate(
                    { inviteId: invite.id, communityId: invite.community.id, approve: true },
                    {
                      onError: (error) => {
                        Alert.alert('Accept failed', error instanceof Error ? error.message : 'Please try again.');
                      }
                    }
                  )}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="dark"
                  style={styles.inviteAction}
                  loading={respondInvite.isPending}
                  onPress={() => respondInvite.mutate(
                    { inviteId: invite.id, communityId: invite.community.id, approve: false },
                    {
                      onError: (error) => {
                        Alert.alert('Decline failed', error instanceof Error ? error.message : 'Please try again.');
                      }
                    }
                  )}
                >
                  Decline
                </Button>
              </View>
            </Card>
          ))}
        </View>
      ) : null}
      <View style={styles.list}>
        {isLoading ? <ActivityIndicator color={colors.orange[500]} /> : null}
        {isError ? (
          <View style={styles.empty}>
            <AppText variant="bodyMuted">Could not load communities.</AppText>
            <Button size="sm" onPress={() => void refetch()}>Retry</Button>
          </View>
        ) : null}
        {!isLoading && !isError && filtered.length === 0 ? (
          <AppText variant="bodyMuted" style={styles.emptyText}>No {tab.toLowerCase()} yet.</AppText>
        ) : null}
        {filtered.map((community) => (
          <CommunityCard
            key={community.id}
            community={community}
            onPress={() => openCommunity(community)}
            onViewPosts={() => openCommunity(community)}
            onAction={() => {
              if ((community.type === 'group' && community.isMember) || community.isAdmin) {
                navigation.navigate('CreatePost', { communityId: community.id });
              } else {
                openCommunity(community);
              }
            }}
          />
        ))}
      </View>
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
  list: {
    gap: spacing.sm
  },
  invites: {
    gap: spacing.sm
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  inviteCard: {
    gap: spacing.sm
  },
  inviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  inviteLogo: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.dark[700],
    alignItems: 'center',
    justifyContent: 'center'
  },
  inviteLogoText: {
    color: colors.orange[400],
    fontWeight: '800'
  },
  inviteMeta: {
    flex: 1
  },
  inviteTitle: {
    color: colors.text.primary,
    fontWeight: '800'
  },
  inviterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  inviterName: {
    flex: 1,
    color: colors.text.secondary,
    fontWeight: '700'
  },
  inviteActions: {
    flexDirection: 'row',
    gap: spacing.xs
  },
  inviteAction: {
    flex: 1
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: spacing.lg
  }
});
