import { useRef, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CheckCircle, ChevronLeft, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react-native';
import {
  Animated,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AppText, Button, IconButton, Screen } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/design/tokens';
import type { AuthStackParamList } from '@/navigation/routes';
import { useAuthStore } from '@/store/authStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

const MIN_PASSWORD_LENGTH = 8;

function validate(password: string, confirm: string) {
  const errors: { password?: string; confirm?: string } = {};
  if (!password) {
    errors.password = 'Password is required.';
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!confirm) {
    errors.confirm = 'Please confirm your password.';
  } else if (password && confirm !== password) {
    errors.confirm = 'Passwords do not match.';
  }
  return errors;
}

export function ResetPasswordScreen({ navigation }: Props) {
  const updatePassword = useAuthStore((state) => state.updatePassword);
  const loading = useAuthStore((state) => state.loading);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});
  const [success, setSuccess] = useState(false);

  // Scale animation for the success checkmark
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;

  const animateSuccess = () => {
    Animated.parallel([
      Animated.spring(checkScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 6,
      }),
      Animated.timing(checkOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleSubmit = async () => {
    const nextErrors = validate(password, confirm);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      await updatePassword(password);
      setSuccess(true);
      animateSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      const friendly = /expired/i.test(message)
        ? 'This link has expired. Please request a new password reset.'
        : message;
      setErrors({ form: friendly });
    }
  };

  // ── Success state ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.successContainer}>
        <Animated.View
          style={[
            styles.successIconWrap,
            { transform: [{ scale: checkScale }], opacity: checkOpacity },
          ]}
        >
          <View style={styles.successRing}>
            <CheckCircle size={52} color={colors.semantic.success} strokeWidth={1.5} />
          </View>
        </Animated.View>

        <AppText variant="h2" style={styles.successTitle}>
          Password Updated
        </AppText>
        <AppText variant="bodyMuted" style={styles.successBody}>
          Your new password has been saved. Sign in to continue.
        </AppText>

        <Button full size="lg" style={styles.successBtn} onPress={() => navigation.navigate('Login')}>
          Back to Sign In
        </Button>
      </Screen>
    );
  }

  // ── Form state ─────────────────────────────────────────────────────────────
  return (
    <Screen keyboard contentContainerStyle={styles.content}>
      <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} style={styles.back} />

      {/* Header */}
      <View style={styles.iconHeader}>
        <View style={styles.headerIconWrap}>
          <ShieldCheck size={30} color={colors.orange[500]} strokeWidth={1.6} />
        </View>
      </View>

      <AppText variant="h2">Set new password</AppText>
      <AppText variant="bodyMuted" style={styles.subtitle}>
        Choose a strong password of at least {MIN_PASSWORD_LENGTH} characters.
      </AppText>

      {/* Error banner */}
      {errors.form ? (
        <View style={styles.errorBanner}>
          <AppText style={styles.errorBannerText}>{errors.form}</AppText>
        </View>
      ) : null}

      {/* Password field */}
      <View>
        <PasswordField
          label="New password"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setErrors((e) => ({ ...e, password: undefined, form: undefined }));
          }}
          show={showPassword}
          onToggleShow={() => setShowPassword((s) => !s)}
          error={errors.password}
        />
      </View>

      {/* Confirm field */}
      <View>
        <PasswordField
          label="Confirm password"
          value={confirm}
          onChangeText={(v) => {
            setConfirm(v);
            setErrors((e) => ({ ...e, confirm: undefined, form: undefined }));
          }}
          show={showConfirm}
          onToggleShow={() => setShowConfirm((s) => !s)}
          error={errors.confirm}
        />
      </View>

      {/* Strength hint */}
      <StrengthHints password={password} />

      <Button full size="lg" loading={loading} onPress={handleSubmit} style={styles.submit}>
        Update Password
      </Button>
    </Screen>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

interface PasswordFieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  error?: string;
}

function PasswordField({ label, value, onChangeText, show, onToggleShow, error }: PasswordFieldProps) {
  return (
    <>
      <View style={[styles.inputWrap, error ? styles.inputWrapError : null]}>
        <Lock size={16} color={colors.text.tertiary} style={styles.inputIcon} />
        <TextInput
          style={styles.textInput}
          placeholder={label}
          placeholderTextColor={colors.text.tertiary}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable onPress={onToggleShow} style={styles.eyeBtn} accessibilityLabel={show ? 'Hide password' : 'Show password'}>
          {show
            ? <EyeOff size={16} color={colors.text.tertiary} />
            : <Eye size={16} color={colors.text.tertiary} />}
        </Pressable>
      </View>
      {error ? <AppText style={styles.fieldError}>{error}</AppText> : null}
    </>
  );
}

const RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Number or symbol', test: (p: string) => /[0-9!@#$%^&*]/.test(p) },
];

function StrengthHints({ password }: { password: string }) {
  if (!password) return null;
  return (
    <View style={styles.hintsWrap}>
      {RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <View key={rule.label} style={styles.hintRow}>
            <View style={[styles.hintDot, ok ? styles.hintDotOk : styles.hintDotNeutral]} />
            <AppText style={[styles.hintText, ok ? styles.hintTextOk : null]}>{rule.label}</AppText>
          </View>
        );
      })}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── form ────────────────────────────────────────────────────────────────
  content: {
    paddingHorizontal: 28,
    paddingTop: 60,
    gap: spacing.lg,
  },
  back: {
    marginBottom: 4,
  },
  iconHeader: {
    alignItems: 'flex-start',
    marginBottom: -4,
  },
  headerIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.overlays.orangeSoft,
    borderWidth: 1,
    borderColor: colors.overlays.orangeBorder,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.orangeGlow,
  },
  subtitle: {
    marginTop: -6,
  },
  errorBanner: {
    backgroundColor: colors.overlays.dangerSoft,
    borderWidth: 1,
    borderColor: colors.semantic.danger,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorBannerText: {
    color: colors.semantic.danger,
    fontSize: 13,
    fontFamily: typography.bodyMedium,
  },
  // ── input ───────────────────────────────────────────────────────────────
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dark[800],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.dark[600],
    paddingHorizontal: spacing.md,
    height: 52,
    gap: spacing.sm,
  },
  inputWrapError: {
    borderColor: colors.semantic.danger,
  },
  inputIcon: {
    flexShrink: 0,
  },
  textInput: {
    flex: 1,
    color: colors.text.primary,
    fontFamily: typography.bodyFamily,
    fontSize: 15,
  },
  eyeBtn: {
    padding: 4,
  },
  fieldError: {
    color: colors.semantic.danger,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 2,
    fontFamily: typography.bodyFamily,
  },
  submit: {
    marginTop: spacing.xs,
  },
  // ── strength hints ───────────────────────────────────────────────────────
  hintsWrap: {
    gap: 6,
    marginTop: -4,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hintDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  hintDotOk: {
    backgroundColor: colors.semantic.success,
  },
  hintDotNeutral: {
    backgroundColor: colors.dark[600],
  },
  hintText: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontFamily: typography.bodyFamily,
  },
  hintTextOk: {
    color: colors.semantic.success,
  },
  // ── success ─────────────────────────────────────────────────────────────
  successContainer: {
    flex: 1,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  successIconWrap: {
    marginBottom: spacing.sm,
  },
  successRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.overlays.successSoft,
    borderWidth: 1.5,
    borderColor: colors.semantic.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    textAlign: 'center',
  },
  successBody: {
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 260,
  },
  successBtn: {
    marginTop: spacing.md,
    width: '100%',
  },
});
