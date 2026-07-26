import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Lock } from 'lucide-react-native';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, IconButton, Screen } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { spacing } from '@/design/tokens';
import { useCommunityInvite, useRespondCommunityInvite } from '@/hooks/useCommunities';
import type { AppStackParamList } from '@/navigation/routes';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'CommunityInvitation'>;

export function CommunityInvitationScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { colors: theme } = useAppTheme();
  const { data: invite, isLoading, isError, refetch } = useCommunityInvite(route.params.inviteId);
  const respond = useRespondCommunityInvite();

  const openCommunity = () => {
    if (!invite) return;
    navigation.replace(
      invite.community.type === 'page' ? 'PageDetail' : 'GroupDetail',
      { communityId: invite.community.id }
    );
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton accessibilityLabel="Back" icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Community invitation</AppText>
        <View style={styles.spacer} />
      </View>
      {isLoading ? (
        <ActivityIndicator accessibilityLabel="Loading invitation" color={theme.accent} />
      ) : isError || !invite ? (
        <Card style={styles.card}>
          <Lock size={24} color={theme.textMuted} />
          <AppText variant="h4">Invitation unavailable</AppText>
          <AppText variant="bodyMuted">
            This invitation may be invalid, expired, intended for another account, or no longer accessible.
          </AppText>
          {isError ? <Button size="sm" onPress={() => void refetch()}>Retry</Button> : null}
        </Card>
      ) : (
        <Card style={styles.card}>
          <AppText variant="h2">{invite.community.name}</AppText>
          <AppText variant="bodyMuted">
            {invite.community.sport} · {invite.community.city} · {invite.community.isPrivate ? 'Private' : 'Public'}
          </AppText>
          <AppText>{invite.community.description}</AppText>
          {invite.status === 'pending' ? (
            <View style={styles.actions}>
              <Button
                style={styles.action}
                loading={respond.isPending}
                onPress={() => respond.mutate(
                  { inviteId: invite.id, communityId: invite.community.id, approve: true },
                  {
                    onSuccess: openCommunity,
                    onError: (error) => Alert.alert('Accept failed', error.message)
                  }
                )}
              >
                Accept
              </Button>
              <Button
                style={styles.action}
                variant="dark"
                loading={respond.isPending}
                onPress={() => respond.mutate(
                  { inviteId: invite.id, communityId: invite.community.id, approve: false },
                  {
                    onSuccess: () => navigation.navigate('Community'),
                    onError: (error) => Alert.alert('Decline failed', error.message)
                  }
                )}
              >
                Decline
              </Button>
            </View>
          ) : (
            <>
              <AppText variant="bodyMuted">This invitation has already been {invite.status}.</AppText>
              {invite.status === 'accepted' ? <Button onPress={openCommunity}>Open community</Button> : null}
            </>
          )}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  spacer: {
    width: 44
  },
  card: {
    alignItems: 'center',
    gap: spacing.md
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    gap: spacing.sm
  },
  action: {
    flex: 1
  }
});
