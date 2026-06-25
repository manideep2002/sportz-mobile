import { useState } from 'react';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CalendarDays, ChevronDown, ChevronLeft, LocateFixed, Phone, ShieldCheck } from 'lucide-react-native';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, Chip, IconButton, Input, Screen } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/design/tokens';
import type { AuthStackParamList } from '@/navigation/routes';
import { authService } from '@/services/authService';
import { normalizeUsername, validateUsername } from '@/utils/authValidation';
import { useAuthStore } from '@/store/authStore';
import type { Gender, SkillLevel, Sport } from '@/types/domain';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const sports: Sport[] = [
  'Cricket',
  'Football',
  'Kabaddi',
  'Badminton',
  'Hockey',
  'Athletics',
  'Running',
  'Basketball',
  'Volleyball',
  'Tennis',
  'Table Tennis',
  'Swimming',
  'Cycling',
  'Chess',
  'Wrestling',
  'Boxing',
  'Weightlifting',
  'Shooting',
  'Archery',
  'Kho Kho',
  'Carrom',
  'Squash',
  'Golf',
  'Rugby',
  'Handball',
  'Throwball',
  'Netball',
  'Skating',
  'Roller Skating',
  'Gymnastics',
  'Yoga',
  'Mallakhamb',
  'Judo',
  'Karate',
  'Taekwondo',
  'Wushu',
  'Fencing',
  'Rowing',
  'Sailing',
  'Canoeing',
  'Kayaking',
  'Equestrian',
  'Polo',
  'Motorsports',
  'Esports',
  'Pickleball',
  'Ultimate Frisbee',
  'Baseball',
  'Softball',
  'Snooker',
  'Billiards',
  'Powerlifting',
  'Bodybuilding',
  'CrossFit',
  'MMA',
  'Kickboxing',
  'Muay Thai',
  'Sport Climbing',
  'Trekking',
  'Marathon',
  'Triathlon'
];
const experienceLevels: SkillLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'Pro'];
const genders: Gender[] = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const locationSuggestions = [
  'Bengaluru, Karnataka',
  'Mumbai, Maharashtra',
  'Delhi NCR',
  'Hyderabad, Telangana',
  'Chennai, Tamil Nadu',
  'Pune, Maharashtra',
  'Kolkata, West Bengal',
  'Ahmedabad, Gujarat',
  'Jaipur, Rajasthan',
  'Lucknow, Uttar Pradesh',
  'Surat, Gujarat',
  'Kanpur, Uttar Pradesh',
  'Nagpur, Maharashtra',
  'Indore, Madhya Pradesh',
  'Thane, Maharashtra',
  'Bhopal, Madhya Pradesh',
  'Visakhapatnam, Andhra Pradesh',
  'Patna, Bihar',
  'Vadodara, Gujarat',
  'Ghaziabad, Uttar Pradesh',
  'Ludhiana, Punjab',
  'Agra, Uttar Pradesh',
  'Nashik, Maharashtra',
  'Faridabad, Haryana',
  'Meerut, Uttar Pradesh',
  'Rajkot, Gujarat',
  'Varanasi, Uttar Pradesh',
  'Srinagar, Jammu and Kashmir',
  'Aurangabad, Maharashtra',
  'Dhanbad, Jharkhand',
  'Amritsar, Punjab',
  'Navi Mumbai, Maharashtra',
  'Allahabad, Uttar Pradesh',
  'Prayagraj, Uttar Pradesh',
  'Ranchi, Jharkhand',
  'Howrah, West Bengal',
  'Coimbatore, Tamil Nadu',
  'Jabalpur, Madhya Pradesh',
  'Gwalior, Madhya Pradesh',
  'Vijayawada, Andhra Pradesh',
  'Jodhpur, Rajasthan',
  'Madurai, Tamil Nadu',
  'Raipur, Chhattisgarh',
  'Kota, Rajasthan',
  'Guwahati, Assam',
  'Chandigarh',
  'Solapur, Maharashtra',
  'Hubballi, Karnataka',
  'Mysuru, Karnataka',
  'Tiruchirappalli, Tamil Nadu',
  'Bareilly, Uttar Pradesh',
  'Aligarh, Uttar Pradesh',
  'Tiruppur, Tamil Nadu',
  'Gurugram, Haryana',
  'Noida, Uttar Pradesh',
  'Kochi, Kerala',
  'Thiruvananthapuram, Kerala',
  'Kozhikode, Kerala',
  'Mangaluru, Karnataka',
  'Dehradun, Uttarakhand',
  'Shimla, Himachal Pradesh',
  'Panaji, Goa',
];

const passwordRules = [
  { label: 'At least 10 characters', test: (value: string) => value.length >= 10 },
  { label: 'One uppercase and one lowercase letter', test: (value: string) => /[A-Z]/.test(value) && /[a-z]/.test(value) },
  { label: 'One number', test: (value: string) => /\d/.test(value) },
  { label: 'One symbol, such as @ # $ %', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
  { label: 'No spaces', test: (value: string) => !/\s/.test(value) }
];

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const getCalendarDays = (monthDate: Date) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1)
  ];
};

export function RegisterScreen({ navigation }: Props) {
  const signUp = useAuthStore((state) => state.signUp);
  const loading = useAuthStore((state) => state.loading);
  const [otpSending, setOtpSending] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [primarySportPickerVisible, setPrimarySportPickerVisible] = useState(false);
  const [secondarySportPickerVisible, setSecondarySportPickerVisible] = useState(false);
  const [firstName, setFirstName] = useState('Marcus');
  const [lastName, setLastName] = useState('King');
  const [username, setUsername] = useState('@marcusk');
  const [email, setEmail] = useState('demo@sportz.app');
  const [password, setPassword] = useState('Sportz@1234');
  const [confirmPassword, setConfirmPassword] = useState('Sportz@1234');
  const [mobileNumber, setMobileNumber] = useState('+91 98765 43210');
  const [mobileOtp, setMobileOtp] = useState('');
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState('1996-05-14');
  const [calendarMonth, setCalendarMonth] = useState(() => parseDate('1996-05-14'));
  const [gender, setGender] = useState<Gender>('Male');
  const [city, setCity] = useState('Bengaluru, Karnataka');
  const [locationQuery, setLocationQuery] = useState('');
  const [sportQuery, setSportQuery] = useState('');
  const [primarySport, setPrimarySport] = useState<Sport>('Cricket');
  const [primarySportExperienceLevel, setPrimarySportExperienceLevel] = useState<SkillLevel>('Intermediate');
  const [secondarySports, setSecondarySports] = useState<Sport[]>(['Football', 'Badminton']);

  const passwordStatus = passwordRules.map((rule) => ({ ...rule, valid: rule.test(password) }));
  const passwordIsValid = passwordStatus.every((rule) => rule.valid);
  const passwordMatches = password.length > 0 && password === confirmPassword;
  const passwordHint = passwordIsValid
    ? 'Password meets all requirements.'
    : 'Use 10+ chars with upper/lowercase, number, symbol, and no spaces.';
  const normalizedLocationQuery = locationQuery.trim().toLowerCase();
  const matchingLocations = (normalizedLocationQuery
    ? locationSuggestions.filter((location) => location.toLowerCase().includes(normalizedLocationQuery))
    : locationSuggestions
  ).slice(0, 24);
  const trimmedLocationQuery = locationQuery.trim();
  const canUseTypedLocation = Boolean(
    trimmedLocationQuery.length > 1 &&
      !locationSuggestions.some((location) => location.toLowerCase() === trimmedLocationQuery.toLowerCase()) &&
      trimmedLocationQuery.toLowerCase() !== city.toLowerCase()
  );
  const normalizedSportQuery = sportQuery.trim().toLowerCase();
  const matchingSports = (normalizedSportQuery
    ? sports.filter((sport) => sport.toLowerCase().includes(normalizedSportQuery))
    : sports
  ).filter((sport) => (secondarySportPickerVisible ? sport !== primarySport : true));
  const secondarySportsLabel =
    secondarySports.length === 0
      ? 'Select secondary sports'
      : `${secondarySports.slice(0, 2).join(', ')}${secondarySports.length > 2 ? ` +${secondarySports.length - 2}` : ''}`;

  const handlePrimarySportSelect = (sport: Sport) => {
    setPrimarySport(sport);
    setSecondarySports((selected) => selected.filter((secondarySport) => secondarySport !== sport));
    setPrimarySportPickerVisible(false);
    setSportQuery('');
  };

  const toggleSecondarySport = (sport: Sport) => {
    if (sport === primarySport) return;

    setSecondarySports((selected) =>
      selected.includes(sport)
        ? selected.filter((secondarySport) => secondarySport !== sport)
        : [...selected, sport]
    );
  };

  const handleLocationSelect = (location: string) => {
    setCity(location);
    setLocationQuery('');
    setLocationPickerVisible(false);
  };

  const openPrimarySportPicker = () => {
    setSportQuery('');
    setPrimarySportPickerVisible(true);
  };

  const openSecondarySportPicker = () => {
    setSportQuery('');
    setSecondarySportPickerVisible(true);
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

  const handleDetectLocation = async () => {
    setDetectingLocation(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Location permission needed', 'Allow location access to auto-detect your city.');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync(currentLocation.coords);
      const detectedCity = [place.city ?? place.district ?? place.subregion, place.region, place.country]
        .filter(Boolean)
        .join(', ');

      setCity(detectedCity || `${currentLocation.coords.latitude.toFixed(4)}, ${currentLocation.coords.longitude.toFixed(4)}`);
      setLocationQuery('');
      setLocationPickerVisible(false);
    } catch (error) {
      Alert.alert('Could not detect location', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setDetectingLocation(false);
    }
  };

  const handleCreate = async () => {
    if (!passwordIsValid) {
      Alert.alert('Strengthen password', 'Use 10+ characters with uppercase, lowercase, a number, a symbol, and no spaces.');
      return;
    }

    if (!passwordMatches) {
      Alert.alert('Passwords do not match', 'Confirm password must match the password you created.');
      return;
    }

    const normalizedUsername = normalizeUsername(username);
    try {
      validateUsername(normalizedUsername);
    } catch (error) {
      Alert.alert('Invalid username', error instanceof Error ? error.message : 'Please choose a valid username.');
      return;
    }

    try {
      await signUp({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: normalizedUsername,
        city: city.trim(),
        mobileNumber: mobileNumber.trim(),
        mobileOtp: mobileOtp.trim(),
        dateOfBirth,
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
    <>
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
          <Input label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
          <AppText
            variant="small"
            style={[
              styles.passwordHint,
              passwordIsValid && passwordMatches ? styles.passwordHintValid : null,
              confirmPassword && !passwordMatches ? styles.passwordHintError : null
            ]}
          >
            {passwordHint}
            {confirmPassword && !passwordMatches ? ' Passwords must match.' : ''}
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
          <View style={styles.group}>
            <AppText style={styles.label}>DOB</AppText>
            <Pressable style={styles.selectInput} onPress={() => setCalendarVisible(true)}>
              <CalendarDays size={17} color={colors.text.tertiary} strokeWidth={2} />
              <AppText style={styles.selectText}>{dateOfBirth}</AppText>
            </Pressable>
          </View>
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
            <Pressable style={styles.selectInput} onPress={openPrimarySportPicker}>
              <AppText style={styles.selectText}>{primarySport}</AppText>
              <ChevronDown size={17} color={colors.text.tertiary} strokeWidth={2} />
            </Pressable>
          </View>
          <View style={styles.group}>
            <AppText style={styles.label}>{primarySport} Experience Level</AppText>
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
            <Pressable style={styles.selectInput} onPress={openSecondarySportPicker}>
              <AppText style={styles.selectText}>{secondarySportsLabel}</AppText>
              <ChevronDown size={17} color={colors.text.tertiary} strokeWidth={2} />
            </Pressable>
          </View>
          <View style={styles.group}>
            <AppText style={styles.label}>Location</AppText>
            <Pressable style={styles.selectInput} onPress={() => setLocationPickerVisible(true)}>
              <AppText style={styles.selectText}>{city}</AppText>
              <ChevronDown size={17} color={colors.text.tertiary} strokeWidth={2} />
            </Pressable>
            <Button variant="dark" size="sm" icon={LocateFixed} loading={detectingLocation} onPress={handleDetectLocation}>
              Auto Detect Location
            </Button>
          </View>
          <Button full size="lg" loading={loading} disabled={!passwordIsValid || !passwordMatches} onPress={handleCreate}>
            Create Profile
          </Button>
          <Pressable style={styles.switch} onPress={() => navigation.navigate('Login')}>
            <AppText variant="bodyMuted">Already have an account? </AppText>
            <AppText style={styles.link}>Sign In</AppText>
          </Pressable>
        </View>
      </Screen>
      <CalendarModal
        visible={calendarVisible}
        selectedDate={dateOfBirth}
        monthDate={calendarMonth}
        onMonthChange={setCalendarMonth}
        onSelect={(date) => {
          setDateOfBirth(formatDate(date));
          setCalendarMonth(date);
          setCalendarVisible(false);
        }}
        onClose={() => setCalendarVisible(false)}
      />
      <LocationPickerModal
        visible={locationPickerVisible}
        selectedLocation={city}
        query={locationQuery}
        locations={matchingLocations}
        typedLocation={trimmedLocationQuery}
        canUseTypedLocation={canUseTypedLocation}
        detectingLocation={detectingLocation}
        onQueryChange={setLocationQuery}
        onSelect={handleLocationSelect}
        onDetect={handleDetectLocation}
        onClose={() => setLocationPickerVisible(false)}
      />
      <SportPickerModal
        visible={primarySportPickerVisible}
        title="Select primary sport"
        mode="primary"
        query={sportQuery}
        sports={matchingSports}
        selectedPrimarySport={primarySport}
        selectedSecondarySports={secondarySports}
        onQueryChange={setSportQuery}
        onPrimarySelect={handlePrimarySportSelect}
        onSecondaryToggle={toggleSecondarySport}
        onClose={() => setPrimarySportPickerVisible(false)}
      />
      <SportPickerModal
        visible={secondarySportPickerVisible}
        title="Select secondary sports"
        mode="secondary"
        query={sportQuery}
        sports={matchingSports}
        selectedPrimarySport={primarySport}
        selectedSecondarySports={secondarySports}
        onQueryChange={setSportQuery}
        onPrimarySelect={handlePrimarySportSelect}
        onSecondaryToggle={toggleSecondarySport}
        onClose={() => setSecondarySportPickerVisible(false)}
      />
    </>
  );
}

interface LocationPickerModalProps {
  visible: boolean;
  selectedLocation: string;
  query: string;
  locations: string[];
  typedLocation: string;
  canUseTypedLocation: boolean;
  detectingLocation: boolean;
  onQueryChange: (value: string) => void;
  onSelect: (location: string) => void;
  onDetect: () => void;
  onClose: () => void;
}

function LocationPickerModal({
  visible,
  selectedLocation,
  query,
  locations,
  typedLocation,
  canUseTypedLocation,
  detectingLocation,
  onQueryChange,
  onSelect,
  onDetect,
  onClose
}: LocationPickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.pickerCard}>
          <View style={styles.pickerHeader}>
            <View>
              <AppText style={styles.pickerTitle}>Select location</AppText>
              <AppText variant="small">Current: {selectedLocation}</AppText>
            </View>
            <IconButton icon={ChevronLeft} size={34} iconSize={16} onPress={onClose} />
          </View>
          <Input value={query} onChangeText={onQueryChange} placeholder="Search city, state, or country" autoCapitalize="words" />
          <Button variant="dark" size="sm" icon={LocateFixed} loading={detectingLocation} onPress={onDetect}>
            Auto Detect Location
          </Button>
          {canUseTypedLocation ? (
            <Pressable style={styles.pickerOptionFeatured} onPress={() => onSelect(typedLocation)}>
              <AppText style={styles.pickerOptionTitle}>Use &ldquo;{typedLocation}&rdquo;</AppText>
              <AppText variant="small">Add this as your location</AppText>
            </Pressable>
          ) : null}
          <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
            {locations.map((location) => (
              <Pressable
                key={location}
                style={[styles.pickerOption, location === selectedLocation ? styles.pickerOptionSelected : null]}
                onPress={() => onSelect(location)}
              >
                <AppText style={styles.pickerOptionTitle}>{location}</AppText>
              </Pressable>
            ))}
            {query.trim() && locations.length === 0 ? (
              <AppText variant="small" style={styles.helperText}>
                No saved location matches. Use your typed location above.
              </AppText>
            ) : null}
          </ScrollView>
          <Button variant="ghost" full onPress={onClose}>
            Close
          </Button>
        </View>
      </View>
    </Modal>
  );
}

interface SportPickerModalProps {
  visible: boolean;
  title: string;
  mode: 'primary' | 'secondary';
  query: string;
  sports: Sport[];
  selectedPrimarySport: Sport;
  selectedSecondarySports: Sport[];
  onQueryChange: (value: string) => void;
  onPrimarySelect: (sport: Sport) => void;
  onSecondaryToggle: (sport: Sport) => void;
  onClose: () => void;
}

function SportPickerModal({
  visible,
  title,
  mode,
  query,
  sports,
  selectedPrimarySport,
  selectedSecondarySports,
  onQueryChange,
  onPrimarySelect,
  onSecondaryToggle,
  onClose
}: SportPickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.pickerCard}>
          <View style={styles.pickerHeader}>
            <View>
              <AppText style={styles.pickerTitle}>{title}</AppText>
              <AppText variant="small">{mode === 'primary' ? selectedPrimarySport : `${selectedSecondarySports.length} selected`}</AppText>
            </View>
            <IconButton icon={ChevronLeft} size={34} iconSize={16} onPress={onClose} />
          </View>
          <Input value={query} onChangeText={onQueryChange} placeholder="Search sports" autoCapitalize="words" />
          <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
            {sports.map((sport) => {
              const selected = mode === 'primary' ? sport === selectedPrimarySport : selectedSecondarySports.includes(sport);

              return (
                <Pressable
                  key={sport}
                  style={[styles.pickerOption, selected ? styles.pickerOptionSelected : null]}
                  onPress={() => (mode === 'primary' ? onPrimarySelect(sport) : onSecondaryToggle(sport))}
                >
                  <AppText style={styles.pickerOptionTitle}>
                    {selected ? '[x] ' : '[ ] '}
                    {sport}
                  </AppText>
                </Pressable>
              );
            })}
            {query.trim() && sports.length === 0 ? (
              <AppText variant="small" style={styles.helperText}>
                No listed sport matches your search.
              </AppText>
            ) : null}
          </ScrollView>
          <Button variant="ghost" full onPress={onClose}>
            Done
          </Button>
        </View>
      </View>
    </Modal>
  );
}

interface CalendarModalProps {
  visible: boolean;
  selectedDate: string;
  monthDate: Date;
  onMonthChange: (date: Date) => void;
  onSelect: (date: Date) => void;
  onClose: () => void;
}

function CalendarModal({ visible, selectedDate, monthDate, onMonthChange, onSelect, onClose }: CalendarModalProps) {
  const selected = parseDate(selectedDate);
  const days = getCalendarDays(monthDate);
  const monthLabel = `${monthNames[monthDate.getMonth()]} ${monthDate.getFullYear()}`;

  const moveMonth = (direction: -1 | 1) => {
    onMonthChange(new Date(monthDate.getFullYear(), monthDate.getMonth() + direction, 1));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Button variant="dark" size="sm" onPress={() => moveMonth(-1)}>
              Prev
            </Button>
            <AppText style={styles.calendarTitle}>{monthLabel}</AppText>
            <Button variant="dark" size="sm" onPress={() => moveMonth(1)}>
              Next
            </Button>
          </View>
          <View style={styles.calendarGrid}>
            {weekdayLabels.map((label, index) => (
              <AppText key={`${label}-${index}`} style={styles.weekday}>
                {label}
              </AppText>
            ))}
            {days.map((day, index) => {
              const date = day ? new Date(monthDate.getFullYear(), monthDate.getMonth(), day) : null;
              const isSelected = Boolean(date && formatDate(date) === formatDate(selected));

              return (
                <Pressable
                  key={`${index}-${day ?? 'blank'}`}
                  disabled={!date}
                  onPress={() => date && onSelect(date)}
                  style={[styles.dayCell, isSelected ? styles.daySelected : null]}
                >
                  <AppText style={[styles.dayText, isSelected ? styles.daySelectedText : null]}>{day ?? ''}</AppText>
                </Pressable>
              );
            })}
          </View>
          <Button variant="ghost" full onPress={onClose}>
            Close
          </Button>
        </View>
      </View>
    </Modal>
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
  passwordHint: {
    color: colors.text.tertiary,
    marginTop: -10
  },
  passwordHintValid: {
    color: colors.semantic.success
  },
  passwordHintError: {
    color: colors.semantic.danger
  },
  helperText: {
    color: colors.text.tertiary
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
  selectInput: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    backgroundColor: colors.dark[800],
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  selectText: {
    color: colors.text.primary,
    fontFamily: typography.bodyFamily,
    fontSize: 14
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
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlays.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.screen
  },
  calendarCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radii.lg,
    backgroundColor: colors.dark[900],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    padding: spacing.md,
    gap: spacing.md
  },
  pickerCard: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '82%',
    borderRadius: radii.lg,
    backgroundColor: colors.dark[900],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    padding: spacing.md,
    gap: spacing.md
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  pickerTitle: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 16
  },
  pickerList: {
    maxHeight: 280
  },
  pickerOption: {
    minHeight: 46,
    justifyContent: 'center',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.dark[800]
  },
  pickerOptionSelected: {
    backgroundColor: colors.overlays.orangeSoft,
    borderBottomColor: colors.overlays.orangeBorder
  },
  pickerOptionFeatured: {
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.overlays.orangeBorder,
    backgroundColor: colors.overlays.orangeSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2
  },
  pickerOptionTitle: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 14
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  calendarTitle: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 16
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: colors.text.tertiary,
    fontFamily: typography.bodyBold,
    fontSize: 12,
    paddingVertical: 7
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md
  },
  daySelected: {
    backgroundColor: colors.orange[500]
  },
  dayText: {
    color: colors.text.secondary,
    fontFamily: typography.bodyBold,
    fontSize: 13
  },
  daySelectedText: {
    color: colors.light[0]
  }
});
