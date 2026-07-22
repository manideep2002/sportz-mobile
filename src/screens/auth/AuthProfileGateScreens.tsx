import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';

import { AppText, Button, Chip, Input, Screen } from '@/components/ui';
import { allSports } from '@/constants/sports';
import { colors, spacing, typography } from '@/design/tokens';
import { useUsernameAvailability } from '@/hooks/useUsernameAvailability';
import { usernameAvailabilityService } from '@/services/usernameAvailabilityService';
import { useAuthStore } from '@/store/authStore';
import type { SkillLevel, Sport } from '@/types/domain';
import { normalizeUsername, validateUsername } from '@/utils/authValidation';

const levels: SkillLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'Pro'];
const generatedUsernamePattern = /^athlete_[a-f0-9]{8}(?:_\d+)?$/i;

export function ProfileCompletionScreen() {
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const completeProfile = useAuthStore((state) => state.completeProfile);
  const signOut = useAuthStore((state) => state.signOut);
  const loading = useAuthStore((state) => state.loading);
  const storeError = useAuthStore((state) => state.error);
  const metadata = user?.user_metadata as Record<string, unknown> | undefined;
  const suggestedName = [metadata?.full_name, metadata?.name]
    .find((value): value is string => typeof value === 'string' && Boolean(value.trim()));

  const [displayName, setDisplayName] = useState(
    profile?.displayName && profile.displayName !== 'SPORTZ Athlete' ? profile.displayName : suggestedName ?? ''
  );
  const [username, setUsername] = useState(
    profile?.username && !generatedUsernamePattern.test(profile.username) ? profile.username : ''
  );
  const [city, setCity] = useState(profile?.city ?? '');
  const [sport, setSport] = useState<Sport>(profile?.primarySport || 'Cricket');
  const [skillLevel, setSkillLevel] = useState<SkillLevel>(profile?.skillLevel ?? 'Intermediate');
  const [formError, setFormError] = useState<string | null>(null);
  const usernameAvailability = useUsernameAvailability(username, profile?.username);
  const canSubmit = Boolean(
    displayName.trim().length >= 2 &&
      city.trim().length >= 2 &&
      sport &&
      usernameAvailability.status === 'available'
  );
  const usernameMessage = useMemo(
    () => usernameAvailability.message || 'Use 3-30 letters, numbers, or underscores.',
    [usernameAvailability.message]
  );

  const submit = async () => {
    setFormError(null);
    const normalizedUsername = normalizeUsername(username);
    try {
      if (displayName.trim().length < 2) throw new Error('Enter your display name.');
      if (city.trim().length < 2) throw new Error('Enter your city.');
      validateUsername(normalizedUsername);
      const availability = await usernameAvailabilityService.verifyUsernameAvailability(
        normalizedUsername,
        profile?.username,
        { forceExact: true }
      );
      if (availability.status !== 'available') throw new Error(availability.message);

      await completeProfile({
        displayName: displayName.trim(),
        username: normalizedUsername,
        city: city.trim(),
        primarySport: sport,
        sports: [sport],
        skillLevel
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not complete your profile.');
    }
  };

  return (
    <Screen keyboard contentContainerStyle={styles.content}>
      <AppText variant="h2">Complete your athlete profile</AppText>
      <AppText variant="bodyMuted">
        Add the essentials before entering SPORTZ. You can change these later in Profile Settings.
      </AppText>

      <Input
        label="Display Name"
        accessibilityLabel="Display Name"
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
        maxLength={80}
      />
      <Input
        label="Username"
        accessibilityLabel="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={31}
      />
      <AppText variant="small" style={styles.helper}>{usernameMessage}</AppText>
      <Input
        label="City"
        accessibilityLabel="City"
        value={city}
        onChangeText={setCity}
        autoCapitalize="words"
        maxLength={100}
      />

      <View style={styles.group}>
        <AppText style={styles.label}>Primary Sport</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {allSports.map((item) => (
            <Chip key={item} selected={sport === item} onPress={() => setSport(item)}>{item}</Chip>
          ))}
        </ScrollView>
      </View>

      <View style={styles.group}>
        <AppText style={styles.label}>Experience Level</AppText>
        <View style={styles.wrap}>
          {levels.map((level) => (
            <Chip key={level} selected={skillLevel === level} onPress={() => setSkillLevel(level)}>{level}</Chip>
          ))}
        </View>
      </View>

      {formError || storeError ? <AppText style={styles.error}>{formError ?? storeError}</AppText> : null}
      <Button full size="lg" disabled={!canSubmit} loading={loading} onPress={submit}>
        Continue to SPORTZ
      </Button>
      <Button full variant="ghost" disabled={loading} onPress={() => void signOut()}>
        Sign Out
      </Button>
    </Screen>
  );
}

export function ProfileLoadErrorScreen() {
  const retryProfile = useAuthStore((state) => state.retryProfile);
  const signOut = useAuthStore((state) => state.signOut);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);

  return (
    <Screen scroll={false} contentContainerStyle={styles.errorState}>
      <AlertTriangle size={44} color={colors.semantic.danger} />
      <AppText variant="h2">Could not load your profile</AppText>
      <AppText variant="bodyMuted" style={styles.centered}>
        {error ?? 'Check your connection and try again.'}
      </AppText>
      <Button full loading={loading} onPress={() => void retryProfile()}>Retry</Button>
      <Button full variant="ghost" disabled={loading} onPress={() => void signOut()}>Sign Out</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingTop: 56
  },
  group: {
    gap: spacing.sm
  },
  label: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 14
  },
  helper: {
    marginTop: -spacing.sm
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  error: {
    color: colors.semantic.danger
  },
  errorState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: 28
  },
  centered: {
    textAlign: 'center'
  }
});
