import { useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { ChevronLeft, Inbox, Send } from 'lucide-react-native';

import { AppRefreshControl, AppText, Badge, Button, IconButton, Screen, SegmentedControl } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { spacing } from '@/design/tokens';
import { useTeamOffers } from '@/hooks/useTeamOffers';
import type { AppStackParamList } from '@/navigation/routes';
import type { TeamOffer, TeamOfferStatus } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'Offers'>;
type Direction = 'Incoming' | 'Outgoing';

const statusTone = (status: TeamOfferStatus): 'orange' | 'green' | 'red' | 'dark' | 'yellow' => {
  if (status === 'accepted') return 'green';
  if (status === 'sent') return 'orange';
  if (status === 'declined' || status === 'withdrawn') return 'red';
  if (status === 'expired') return 'yellow';
  return 'dark';
};

const formatDate = (value: string) => new Date(value).toLocaleDateString();

function OfferCard({ offer, direction, onPress }: {
  offer: TeamOffer;
  direction: Direction;
  onPress: () => void;
}) {
  const { colors: theme } = useAppTheme();
  const person = direction === 'Incoming' ? offer.sender : offer.recipient;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${offer.status} offer from ${offer.team.name}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
        pressed ? styles.pressed : null
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitle}>
          <AppText variant="h4">{offer.team.name}</AppText>
          <AppText variant="bodyMuted">{direction === 'Incoming' ? 'From' : 'To'} {person.displayName}</AppText>
        </View>
        <Badge tone={statusTone(offer.status)}>{offer.status.toUpperCase()}</Badge>
      </View>
      <AppText>{offer.sport} · {offer.position}</AppText>
      <AppText variant="small">Expires {formatDate(offer.expiresAt)}</AppText>
    </Pressable>
  );
}

export function OffersScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { colors: theme } = useAppTheme();
  const initial: Direction = route.params?.initialDirection === 'outgoing' ? 'Outgoing' : 'Incoming';
  const [direction, setDirection] = useState<Direction>(initial);
  const query = useTeamOffers(direction === 'Incoming' ? 'incoming' : 'outgoing');

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={<AppRefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
    >
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={() => navigation.goBack()} />
        <AppText variant="h3">Team Offers</AppText>
        <View style={styles.headerSpacer} />
      </View>
      <SegmentedControl value={direction} options={['Incoming', 'Outgoing']} onChange={setDirection} />
      {query.isLoading ? <ActivityIndicator color={theme.accent} /> : null}
      {query.isError ? (
        <View style={[styles.empty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <AppText variant="h4">Could not load offers</AppText>
          <AppText variant="bodyMuted">{query.error instanceof Error ? query.error.message : 'Please try again.'}</AppText>
          <Button size="sm" onPress={() => void query.refetch()}>Retry</Button>
        </View>
      ) : null}
      {!query.isLoading && !query.isError && !query.data?.length ? (
        <View style={[styles.empty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {direction === 'Incoming'
            ? <Inbox size={36} color={theme.textSubtle} />
            : <Send size={36} color={theme.textSubtle} />}
          <AppText variant="h4">No {direction.toLowerCase()} offers</AppText>
          <AppText variant="bodyMuted" style={styles.centerText}>
            {direction === 'Incoming'
              ? 'Offers sent to you will appear here.'
              : 'Offers you send from Find Players or a profile will appear here.'}
          </AppText>
        </View>
      ) : null}
      {(query.data ?? []).map((offer) => (
        <OfferCard
          key={offer.id}
          offer={offer}
          direction={direction}
          onPress={() => navigation.navigate('OfferDetail', { offerId: offer.id })}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerSpacer: { width: 44 },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md, gap: spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardTitle: { flex: 1, gap: spacing.xxs },
  pressed: { opacity: 0.82 },
  empty: { padding: spacing.xl, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', gap: spacing.sm },
  centerText: { textAlign: 'center' }
});
