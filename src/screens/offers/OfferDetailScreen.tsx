import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { ChevronLeft, Clock3, LockKeyhole, ShieldAlert } from 'lucide-react-native';

import { AppRefreshControl, AppText, Badge, Button, IconButton, Screen } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { spacing } from '@/design/tokens';
import {
  useRespondTeamOffer,
  useSendTeamOffer,
  useTeamOffer,
  useTeamOfferHistory,
  useWithdrawTeamOffer
} from '@/hooks/useTeamOffers';
import type { AppStackParamList } from '@/navigation/routes';
import { reportService } from '@/services/reportService';
import { useAuthStore } from '@/store/authStore';
import type { TeamOfferStatus } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'OfferDetail'>;

const statusTone = (status: TeamOfferStatus): 'orange' | 'green' | 'red' | 'dark' | 'yellow' => {
  if (status === 'accepted') return 'green';
  if (status === 'sent') return 'orange';
  if (status === 'declined' || status === 'withdrawn') return 'red';
  if (status === 'expired') return 'yellow';
  return 'dark';
};

const date = (value?: string | null) => value ? new Date(value).toLocaleDateString() : 'Not specified';
const eventLabel = (event: string) => event.replaceAll('_', ' ');

export function OfferDetailScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { colors: theme } = useAppTheme();
  const userId = useAuthStore((state) => state.user?.id);
  const query = useTeamOffer(route.params.offerId);
  const historyQuery = useTeamOfferHistory(route.params.offerId);
  const respond = useRespondTeamOffer();
  const send = useSendTeamOffer();
  const withdraw = useWithdrawTeamOffer();
  const offer = query.data;
  const isRecipient = offer?.recipient.id === userId;
  const isSender = offer?.sender.id === userId;
  const busy = respond.isPending || send.isPending || withdraw.isPending;

  const respondToOffer = (accept: boolean) => {
    Alert.alert(
      accept ? 'Accept offer?' : 'Decline offer?',
      accept
        ? 'Acceptance immediately adds you to the team roster.'
        : 'This offer cannot be accepted after it is declined.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: accept ? 'Accept' : 'Decline',
          style: accept ? 'default' : 'destructive',
          onPress: async () => {
            try {
              const updated = await respond.mutateAsync({ offerId: route.params.offerId, accept });
              if (updated.status === 'expired') {
                Alert.alert('Offer expired', 'This offer expired before it could be accepted.');
              }
            } catch (error) {
              Alert.alert('Could not update offer', error instanceof Error ? error.message : 'Please try again.');
            }
          }
        }
      ]
    );
  };

  const withdrawOffer = () => {
    Alert.alert('Withdraw offer?', 'The athlete will no longer be able to accept it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          try {
            await withdraw.mutateAsync(route.params.offerId);
          } catch (error) {
            Alert.alert('Could not withdraw offer', error instanceof Error ? error.message : 'Please try again.');
          }
        }
      }
    ]);
  };

  const reportOffer = async () => {
    try {
      await reportService.reportEntity('team_offer', route.params.offerId, 'Inappropriate offer terms');
      Alert.alert('Report submitted', 'A moderator will review this private offer.');
    } catch (error) {
      Alert.alert('Report failed', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  if (query.isLoading) {
    return (
      <Screen contentContainerStyle={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </Screen>
    );
  }

  if (!offer || query.isError) {
    return (
      <Screen contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={() => navigation.goBack()} />
          <AppText variant="h3">Offer</AppText>
          <View style={styles.spacer} />
        </View>
        <AppText variant="bodyMuted">This offer is unavailable or you do not have access to it.</AppText>
      </Screen>
    );
  }

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={<AppRefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
    >
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={() => navigation.goBack()} />
        <AppText variant="h3">Offer Detail</AppText>
        <Badge tone={statusTone(offer.status)}>{offer.status.toUpperCase()}</Badge>
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <AppText variant="h2">{offer.team.name}</AppText>
        <AppText variant="bodyMuted">{offer.sport} · {offer.position}</AppText>
        <View style={styles.divider} />
        <Detail label="From" value={offer.sender.displayName} />
        <Detail label="To" value={offer.recipient.displayName} />
        <Detail label="Starts" value={date(offer.startDate)} />
        <Detail label="Ends" value={date(offer.endDate)} />
        <Detail label="Expires" value={date(offer.expiresAt)} />
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.sectionTitle}>
          <LockKeyhole size={17} color={theme.accent} />
          <AppText variant="h4">Private Terms</AppText>
        </View>
        <AppText>{offer.terms}</AppText>
        {offer.compensationAmount != null ? (
          <Detail
            label="Compensation"
            value={`${offer.compensationCurrency ?? ''} ${offer.compensationAmount.toLocaleString()}${offer.compensationPeriod ? ` / ${offer.compensationPeriod.replace('_', ' ')}` : ''}`}
          />
        ) : (
          <Detail label="Compensation" value="Not specified" />
        )}
      </View>

      {isRecipient && offer.status === 'sent' ? (
        <View style={styles.actions}>
          <Button style={styles.action} variant="ghost" disabled={busy} onPress={() => respondToOffer(false)}>Decline</Button>
          <Button style={styles.action} disabled={busy} onPress={() => respondToOffer(true)}>Accept</Button>
        </View>
      ) : null}
      {isSender && (offer.status === 'draft' || offer.status === 'sent') ? (
        <View style={styles.actions}>
          <Button style={styles.action} variant="danger" disabled={busy} loading={withdraw.isPending} onPress={withdrawOffer}>
            Withdraw Offer
          </Button>
          {offer.status === 'draft' ? (
            <Button
              style={styles.action}
              disabled={busy}
              loading={send.isPending}
              onPress={async () => {
                try {
                  await send.mutateAsync(offer.id);
                } catch (error) {
                  Alert.alert('Could not send offer', error instanceof Error ? error.message : 'Please try again.');
                }
              }}
            >
              Send Draft
            </Button>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.sectionTitle}>
          <Clock3 size={17} color={theme.textMuted} />
          <AppText variant="h4">History</AppText>
        </View>
        {(historyQuery.data ?? []).map((entry) => (
          <View key={entry.id} style={styles.historyRow}>
            <AppText style={styles.historyEvent}>{eventLabel(entry.event)}</AppText>
            <AppText variant="small">{new Date(entry.createdAt).toLocaleString()}</AppText>
          </View>
        ))}
      </View>

      {isRecipient ? (
        <Button variant="dark" icon={ShieldAlert} onPress={() => void reportOffer()}>Report Offer</Button>
      ) : null}
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <AppText variant="small">{label}</AppText>
      <AppText style={styles.detailValue}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  spacer: { width: 44 },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md, gap: spacing.sm },
  divider: { height: StyleSheet.hairlineWidth, opacity: 0.3 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  detail: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  detailValue: { flex: 1, textAlign: 'right' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  historyEvent: { textTransform: 'capitalize', flex: 1 }
});
