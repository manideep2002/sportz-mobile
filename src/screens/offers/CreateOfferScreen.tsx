import { useEffect, useMemo, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert, ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { ChevronLeft, LockKeyhole } from 'lucide-react-native';

import { AppText, Button, Chip, IconButton, Input, Screen } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { spacing } from '@/design/tokens';
import { useProfile } from '@/hooks/useProfile';
import { useCreateTeamOffer, useManagedTeams } from '@/hooks/useTeamOffers';
import type { AppStackParamList } from '@/navigation/routes';
import type { CompensationPeriod } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'CreateOffer'>;

const periods: CompensationPeriod[] = ['one_time', 'match', 'week', 'month', 'season', 'year'];
const periodLabel = (period: CompensationPeriod) => period.replace('_', ' ');
const dateInput = (date: Date) => date.toISOString().slice(0, 10);

export function CreateOfferScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { colors: theme } = useAppTheme();
  const { data: recipient, isLoading: recipientLoading } = useProfile(route.params.recipientId);
  const { data: teams = [], isLoading: teamsLoading } = useManagedTeams();
  const createOffer = useCreateTeamOffer();
  const [teamId, setTeamId] = useState('');
  const [sport, setSport] = useState('');
  const [position, setPosition] = useState('');
  const [terms, setTerms] = useState('');
  const [compensation, setCompensation] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [period, setPeriod] = useState<CompensationPeriod>('season');
  const [startDate, setStartDate] = useState(dateInput(new Date()));
  const [endDate, setEndDate] = useState('');
  const defaultExpiry = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return dateInput(date);
  }, []);
  const [expiryDate, setExpiryDate] = useState(defaultExpiry);

  useEffect(() => {
    if (teamId || !teams[0]) return;
    setTeamId(teams[0].id);
    setSport(teams[0].sport);
  }, [teamId, teams]);

  useEffect(() => {
    if (!position && recipient?.position) setPosition(recipient.position);
  }, [position, recipient?.position]);

  const selectTeam = (id: string) => {
    const selected = teams.find((team) => team.id === id);
    setTeamId(id);
    if (selected) setSport(selected.sport);
  };

  const submit = async (sendNow: boolean) => {
    const compensationAmount = compensation.trim() ? Number(compensation) : null;
    if (compensation.trim() && !Number.isFinite(compensationAmount)) {
      Alert.alert('Invalid compensation', 'Enter a valid number or leave compensation blank.');
      return;
    }
    const expiry = new Date(`${expiryDate}T23:59:59.999Z`);
    if (Number.isNaN(expiry.getTime())) {
      Alert.alert('Invalid expiry', 'Use the YYYY-MM-DD date format.');
      return;
    }
    try {
      const offer = await createOffer.mutateAsync({
        recipientId: route.params.recipientId,
        teamId,
        sport,
        position,
        terms,
        compensationAmount,
        compensationCurrency: compensationAmount == null ? null : currency,
        compensationPeriod: compensationAmount == null ? null : period,
        startDate: startDate || null,
        endDate: endDate || null,
        expiresAt: expiry.toISOString(),
        sendNow
      });
      navigation.replace('OfferDetail', { offerId: offer.id });
    } catch (error) {
      Alert.alert(
        sendNow ? 'Could not send offer' : 'Could not save draft',
        error instanceof Error ? error.message : 'Please try again.'
      );
    }
  };

  const loading = recipientLoading || teamsLoading;

  return (
    <Screen keyboard contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={() => navigation.goBack()} />
        <AppText variant="h3">Create Offer</AppText>
        <Button size="sm" variant="dark" onPress={() => navigation.navigate('Offers')}>Offers</Button>
      </View>

      {loading ? <ActivityIndicator color={theme.accent} /> : null}
      {recipient ? (
        <View style={[styles.recipient, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <AppText variant="small" color={theme.textMuted}>OFFER TO</AppText>
          <AppText variant="h3">{recipient.displayName}</AppText>
          <AppText variant="bodyMuted">{recipient.primarySport} · {recipient.position || 'Athlete'}</AppText>
        </View>
      ) : null}

      {!loading && teams.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <AppText variant="h4">A managed team is required</AppText>
          <AppText variant="bodyMuted">
            Create a Page for your team or ask a Page owner to make you an admin. Page owners and admins can send offers.
          </AppText>
          <Button onPress={() => navigation.navigate('CreateCommunity')}>Create Team Page</Button>
        </View>
      ) : null}

      {teams.length > 0 ? (
        <>
          <AppText variant="small" color={theme.textSubtle}>TEAM</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {teams.map((team) => (
              <Chip key={team.id} selected={team.id === teamId} onPress={() => selectTeam(team.id)}>
                {team.name}
              </Chip>
            ))}
          </ScrollView>
          <Input label="Sport" value={sport} onChangeText={setSport} />
          <Input label="Position / roster role" value={position} onChangeText={setPosition} />
          <Input
            label="Private offer terms"
            value={terms}
            onChangeText={setTerms}
            multiline
            numberOfLines={5}
            maxLength={5000}
            textAlignVertical="top"
          />
          <View style={styles.row}>
            <Input
              label="Compensation (optional)"
              value={compensation}
              onChangeText={setCompensation}
              keyboardType="decimal-pad"
              style={styles.flexInput}
            />
            <Input
              label="Currency"
              value={currency}
              onChangeText={setCurrency}
              autoCapitalize="characters"
              maxLength={3}
              style={styles.currencyInput}
            />
          </View>
          {compensation.trim() ? (
            <>
              <AppText variant="small" color={theme.textSubtle}>COMPENSATION PERIOD</AppText>
              <View style={styles.chips}>
                {periods.map((item) => (
                  <Chip key={item} selected={period === item} onPress={() => setPeriod(item)}>
                    {periodLabel(item)}
                  </Chip>
                ))}
              </View>
            </>
          ) : null}
          <View style={styles.row}>
            <Input label="Start (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} style={styles.flexInput} />
            <Input label="End (optional)" value={endDate} onChangeText={setEndDate} style={styles.flexInput} />
          </View>
          <Input label="Offer expires (YYYY-MM-DD)" value={expiryDate} onChangeText={setExpiryDate} />
          <View style={[styles.privacy, { backgroundColor: theme.accentSoft, borderColor: theme.accentBorder }]}>
            <LockKeyhole size={18} color={theme.accent} />
            <AppText variant="bodyMuted" style={styles.privacyText}>
              Terms and compensation are visible only to the recipient, sender, authorized team managers, and moderators.
            </AppText>
          </View>
          <View style={styles.actions}>
            <Button
              style={styles.action}
              variant="ghost"
              loading={createOffer.isPending}
              onPress={() => void submit(false)}
            >
              Save Draft
            </Button>
            <Button
              style={styles.action}
              loading={createOffer.isPending}
              onPress={() => void submit(true)}
            >
              Send Offer
            </Button>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recipient: { padding: spacing.md, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, gap: spacing.xs },
  empty: { padding: spacing.lg, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  flexInput: { flex: 1 },
  currencyInput: { width: 92 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  privacy: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  privacyText: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 }
});

