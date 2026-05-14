import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, Chip, IconButton, Input, Screen } from '@/components/ui';
import { colors, spacing } from '@/design/tokens';
import type { AuthStackParamList } from '@/navigation/routes';
import { useAuthStore } from '@/store/authStore';
import type { Sport } from '@/types/domain';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const sports: Sport[] = ['Basketball', 'Football', 'Tennis', 'Cricket', 'Badminton', 'Swimming'];

export function RegisterScreen({ navigation }: Props) {
  const signUp = useAuthStore((state) => state.signUp);
  const loading = useAuthStore((state) => state.loading);
  const [firstName, setFirstName] = useState('Marcus');
  const [lastName, setLastName] = useState('King');
  const [username, setUsername] = useState('@marcusk');
  const [email, setEmail] = useState('demo@sportz.app');
  const [password, setPassword] = useState('password123');
  const [city, setCity] = useState('Bengaluru, Karnataka');
  const [primarySport, setPrimarySport] = useState<Sport>('Basketball');

  const handleCreate = async () => {
    try {
      await signUp({ email, password, firstName, lastName, username, city, primarySport });
    } catch (error) {
      Alert.alert('Could not create profile', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <Screen keyboard contentContainerStyle={styles.content}>
      <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} style={styles.back} />
      <AppText variant="h2">Join SPORTZ</AppText>
      <AppText variant="bodyMuted" style={styles.subtitle}>
        Create your athlete profile
      </AppText>
      <View style={styles.steps}>
        <View style={styles.stepActive} />
        <View style={styles.step} />
        <View style={styles.step} />
      </View>
      <View style={styles.form}>
        <View style={styles.row}>
          <Input label="First Name" value={firstName} onChangeText={setFirstName} style={styles.flexInput} />
          <Input label="Last Name" value={lastName} onChangeText={setLastName} style={styles.flexInput} />
        </View>
        <Input label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" />
        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <View style={styles.group}>
          <AppText style={styles.label}>Primary Sport</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {sports.map((sport) => (
              <Chip key={sport} selected={sport === primarySport} onPress={() => setPrimarySport(sport)}>
                {sport}
              </Chip>
            ))}
          </ScrollView>
        </View>
        <Input label="Location" value={city} onChangeText={setCity} />
        <Button full size="lg" loading={loading} onPress={handleCreate}>
          Create Profile
        </Button>
        <Pressable style={styles.switch} onPress={() => navigation.navigate('Login')}>
          <AppText variant="bodyMuted">Already have an account? </AppText>
          <AppText style={styles.link}>Sign In</AppText>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 28,
    paddingTop: 60
  },
  back: {
    marginBottom: 28
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 28
  },
  steps: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 28
  },
  stepActive: {
    flex: 1,
    height: 3,
    backgroundColor: colors.orange[500],
    borderRadius: 2
  },
  step: {
    flex: 1,
    height: 3,
    backgroundColor: colors.dark[700],
    borderRadius: 2
  },
  form: {
    gap: spacing.md
  },
  row: {
    flexDirection: 'row',
    gap: 12
  },
  flexInput: {
    flex: 1
  },
  group: {
    gap: 6
  },
  label: {
    color: colors.text.tertiary,
    fontWeight: '700',
    fontSize: 12
  },
  switch: {
    flexDirection: 'row',
    justifyContent: 'center'
  },
  link: {
    color: colors.orange[400],
    fontWeight: '700'
  }
});
