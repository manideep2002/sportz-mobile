import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { ChevronLeft, UserPlus } from 'lucide-react-native';

import { AppText, Avatar, Button, IconButton, Screen } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import type { AppStackParamList } from '@/navigation/routes';
import { profileService } from '@/services/profileService';
import { timeAgo } from '@/utils/format';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export function FollowRequestsScreen() {
  const navigation = useNavigation<Navigation>();
  const queryClient = useQueryClient();
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['follow-requests', 'incoming'],
    queryFn: profileService.listIncomingFollowRequests
  });
  const respond = useMutation({
    mutationFn: ({ requestId, approve }: { requestId: string; approve: boolean }) =>
      profileService.respondToFollowRequest(requestId, approve),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['follow-requests', 'incoming'] });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (error) => {
      Alert.alert('Request failed', error instanceof Error ? error.message : 'Please try again.');
    }
  });

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Follow Requests</AppText>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? <ActivityIndicator color={colors.orange[500]} /> : null}

      {!isLoading && requests.length === 0 ? (
        <View style={styles.empty}>
          <UserPlus size={42} color={colors.text.tertiary} />
          <AppText variant="h4">No pending requests</AppText>
          <AppText variant="bodyMuted" style={styles.emptyText}>
            Requests for private profiles will appear here.
          </AppText>
        </View>
      ) : null}

      {requests.map((request) => (
        <View key={request.id} style={styles.row}>
          <Pressable
            style={styles.profile}
            onPress={() => navigation.navigate('UserProfile', { userId: request.requester.id })}
          >
            <Avatar initials={request.requester.initials} uri={request.requester.avatarUrl} size={46} />
            <View style={styles.meta}>
              <AppText style={styles.name}>{request.requester.displayName}</AppText>
              <AppText variant="small">@{request.requester.username} - {timeAgo(request.createdAt)}</AppText>
            </View>
          </Pressable>
          <View style={styles.actions}>
            <Button
              size="sm"
              loading={respond.isPending}
              onPress={() => respond.mutate({ requestId: request.id, approve: true })}
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={respond.isPending}
              onPress={() => respond.mutate({ requestId: request.id, approve: false })}
            >
              Decline
            </Button>
          </View>
        </View>
      ))}
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
    width: 40
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl
  },
  emptyText: {
    textAlign: 'center'
  },
  row: {
    gap: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.dark[800],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    padding: spacing.md
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  meta: {
    flex: 1
  },
  name: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 14
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end'
  }
});
