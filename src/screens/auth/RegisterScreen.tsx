import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CalendarDays, ChevronLeft, Phone, ShieldCheck } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, Chip, IconButton, Input, Screen } from '@/components/ui';
import { colors, spacing } from '@/design/tokens';
import type { AuthStackParamList } from '@/navigation/routes';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import type { Gender, SkillLevel, Sport } from '@/types/domain';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const sports: Sport[] = ['Basketball', 'Football', 'Tennis', 'Cricket', 'Badminton', 'Swimming'];
const experienceLevels: SkillLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'Pro'];
const genders: Gender[] = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];
const dobPattern = /^\d{4}-\d{2}-\d{2}$/;

export function RegisterScreen({ navigation }: Props) {
  const signUp = useAuthStore((state) => state.signUp);
  const loading = useAuthStore((state) => state.loading);
  const [otpSending, setOtpSending] = useState(false);
  const [firstName, setFirstName] = useState('Marcus');
  const [lastName, setLastName] = useState('King');
  const [username, setUsername] = useState('@marcusk');
  const [email, setEmail] = useState('demo@sportz.app');
  const [password, setPassword] = useState('password123');
  const [mobileNumber, setMobileNumber] = useState('+91 98765 43210');
  const [mobileOtp, setMobileOtp] = useState('');
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState('1996-05-14');
  const [gender, setGender] = useState<Gender>('Male');
  const [city, setCity] = useState('Bengaluru, Karnataka');
  const [primarySport, setPrimarySport] = useState<Sport>('Basketball');
  const [primarySportExperienceLevel, setPrimarySportExperienceLevel] = useState<SkillLevel>('Intermediate');
  const [secondarySports, setSecondarySports] = useState<Sport[]>(['Football']);

  const handlePrimarySportSelect = (sport: Sport) => {
    setPrimarySport(sport);
    setSecondarySports((selected) => selected.filter((secondarySport) => secondarySport !== sport));
  };

  const toggleSecondarySport = (sport: Sport) => {
    setSecondarySports((selected) =>
      selected.includes(sport)
        ? selected.filter((secondarySport) => secondarySport !== sport)
        : [...selected, sport]
    );
  };

  const handleGenerateOtp = async () => {
    setOtpSending(true);
    setOtpMessage(null);
    try {
      const { demoCode } = await authService.generateMobileOtp(mobileNumber);
      if (demoCode) {
        setMobileOtp(demoCode);
        setOtpMessage(`Demo OTP generated: ${demoCode}`);
      } else {
        setOtpMessage('OTP sent to your mobile number.');
      }
    } catch (error) {
      Alert.alert('Could not generate OTP', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleCreate = async () => {
    if (password.length < 8) {
      Alert.alert('Password too short', 'Create a password with at least 8 characters.');
      return;
    }

    if (!dobPattern.test(dateOfBirth.trim())) {
      Alert.alert('Invalid DOB', 'Enter DOB in YYYY-MM-DD format.');
      return;
    }

    try {
      await signUp({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
        city: city.trim(),
        mobileNumber: mobileNumber.trim(),
        mobileOtp: mobileOtp.trim(),
        dateOfBirth: dateOfBirth.trim(),
        gender,
        primarySport,
        primarySportExperienceLevel,
        secondarySports
      });
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
      <View style={styles.form}>
        <View style={styles.row}>
          <Input label="First Name" value={firstName} onChangeText={setFirstName} style={styles.flexInput} />
          <Input label="Last Name" value={lastName} onChangeText={setLastName} style={styles.flexInput} />
        </View>
        <Input label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" />
        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <AppText variant="small" style={styles.helperText}>
          Use at least 8 characters with a number or symbol.
        </AppText>
        <View style={styles.group}>
          <AppText style={styles.label}>Mobile Verification</AppText>
          <View style={styles.otpRow}>
            <View style={styles.otpInput}>
              <Input
                icon={Phone}
                value={mobileNumber}
                onChangeText={setMobileNumber}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
            </View>
            <Button variant="dark" size="sm" icon={ShieldCheck} loading={otpSending} onPress={handleGenerateOtp} style={styles.otpButton}>
              Generate OTP
            </Button>
          </View>
          <Input label="OTP" value={mobileOtp} onChangeText={setMobileOtp} keyboardType="number-pad" maxLength={6} />
          {otpMessage ? <AppText variant="small" style={styles.successText}>{otpMessage}</AppText> : null}
        </View>
        <Input
          label="DOB"
          icon={CalendarDays}
          value={dateOfBirth}
          onChangeText={setDateOfBirth}
          placeholder="YYYY-MM-DD"
          keyboardType="numbers-and-punctuation"
        />
        <View style={styles.group}>
          <AppText style={styles.label}>Gender</AppText>
          <View style={styles.wrapRow}>
            {genders.map((option) => (
              <Chip key={option} selected={option === gender} onPress={() => setGender(option)} style={styles.wrapChip}>
                {option}
              </Chip>
            ))}
          </View>
        </View>
        <View style={styles.group}>
          <AppText style={styles.label}>Primary Sport</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {sports.map((sport) => (
              <Chip key={sport} selected={sport === primarySport} onPress={() => handlePrimarySportSelect(sport)}>
                {sport}
              </Chip>
            ))}
          </ScrollView>
        </View>
        <View style={styles.group}>
          <AppText style={styles.label}>Primary Sport Experience Level</AppText>
          <View style={styles.wrapRow}>
            {experienceLevels.map((level) => (
              <Chip
                key={level}
                selected={level === primarySportExperienceLevel}
                onPress={() => setPrimarySportExperienceLevel(level)}
                style={styles.wrapChip}
              >
                {level}
              </Chip>
            ))}
          </View>
        </View>
        <View style={styles.group}>
          <AppText style={styles.label}>Secondary Sports</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {sports
              .filter((sport) => sport !== primarySport)
              .map((sport) => (
                <Chip key={sport} selected={secondarySports.includes(sport)} onPress={() => toggleSecondarySport(sport)}>
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
  helperText: {
    color: colors.text.tertiary,
    marginTop: -10
  },
  group: {
    gap: 6
  },
  otpRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center'
  },
  otpInput: {
    flex: 1
  },
  otpButton: {
    alignSelf: 'flex-end',
    minHeight: 48
  },
  successText: {
    color: colors.semantic.success
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.xs
  },
  wrapChip: {
    marginBottom: spacing.xs
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
