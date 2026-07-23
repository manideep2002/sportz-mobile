import { z } from 'zod';

import { allSports } from '@/constants/sports';
import { isProfileSport } from '@/schemas/profileSportsSchema';
import type { Gender, SkillLevel, Sport } from '@/types/domain';
import { normalizeUsername } from '@/utils/authValidation';

export const MINIMUM_REGISTRATION_AGE = 13;

export const REGISTRATION_LIMITS = {
  firstName: 50,
  lastName: 50,
  username: 30,
  email: 254,
  mobileNumber: 18,
  city: 100,
  password: 128
} as const;

const genders: readonly Gender[] = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];
const skillLevels: readonly SkillLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'Pro'];
const namePattern = /^[\p{L}\p{M}][\p{L}\p{M}' -]*$/u;
const normalizedIndianPhonePattern = /^\+91[6-9]\d{9}$/;

export const normalizeWhitespace = (value: string) => value.trim().replace(/\s+/g, ' ');
export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const normalizeIndianPhoneNumber = (value: string): string => {
  const compact = value.trim().replace(/[\s\-().]/g, '');
  const digits = compact.replace(/^\+/, '');
  const localNumber = digits.length === 12 && digits.startsWith('91')
    ? digits.slice(2)
    : digits.length === 11 && digits.startsWith('0')
      ? digits.slice(1)
      : digits;

  return /^[6-9]\d{9}$/.test(localNumber) ? `+91${localNumber}` : compact;
};

const parseIsoDate = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
};

export const ageOnDate = (dateOfBirth: Date, today: Date): number => {
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const birthdayHasPassed =
    today.getMonth() > dateOfBirth.getMonth() ||
    (today.getMonth() === dateOfBirth.getMonth() && today.getDate() >= dateOfBirth.getDate());
  if (!birthdayHasPassed) age -= 1;
  return age;
};

const normalizedNameSchema = (label: string, maximum: number) =>
  z.string()
    .transform(normalizeWhitespace)
    .pipe(
      z.string()
        .min(1, `${label} is required.`)
        .min(2, `${label} must be at least 2 characters.`)
        .max(maximum, `${label} must be ${maximum} characters or fewer.`)
        .regex(namePattern, `${label} can contain letters, spaces, apostrophes, and hyphens.`)
    );

const sportSchema = z.custom<Sport>(isProfileSport, {
  message: 'Select a valid primary sport.'
});

const secondarySportSchema = z.custom<Sport>(isProfileSport, {
  message: 'Select only valid secondary sports.'
});

export const createRegistrationSchema = (today?: Date) =>
  z.object({
    firstName: normalizedNameSchema('First name', REGISTRATION_LIMITS.firstName),
    lastName: normalizedNameSchema('Last name', REGISTRATION_LIMITS.lastName),
    username: z.string()
      .transform(normalizeUsername)
      .pipe(
        z.string().regex(
          /^[a-zA-Z0-9_]{3,30}$/,
          'Username must be 3-30 characters and use only letters, numbers, or underscores.'
        )
      ),
    email: z.string()
      .transform(normalizeEmail)
      .pipe(
        z.string()
          .min(1, 'Email is required.')
          .max(REGISTRATION_LIMITS.email, `Email must be ${REGISTRATION_LIMITS.email} characters or fewer.`)
          .email('Enter a valid email address.')
      ),
    mobileNumber: z.string()
      .trim()
      .min(1, 'Mobile number is required.')
      .max(REGISTRATION_LIMITS.mobileNumber, 'Mobile number is too long.')
      .transform(normalizeIndianPhoneNumber)
      .refine(
        (value) => normalizedIndianPhonePattern.test(value),
        'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.'
      ),
    dateOfBirth: z.string().trim().superRefine((value, context) => {
      if (!value) {
        context.addIssue({ code: 'custom', message: 'Date of birth is required.' });
        return;
      }

      const date = parseIsoDate(value);
      if (!date) {
        context.addIssue({ code: 'custom', message: 'Enter a valid date of birth.' });
        return;
      }

      const referenceDate = today ?? new Date();
      const todayOnly = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
      if (date > todayOnly) {
        context.addIssue({ code: 'custom', message: 'Date of birth cannot be in the future.' });
        return;
      }

      if (ageOnDate(date, todayOnly) < MINIMUM_REGISTRATION_AGE) {
        context.addIssue({
          code: 'custom',
          message: `You must be at least ${MINIMUM_REGISTRATION_AGE} years old to create an account.`
        });
      }
    }),
    city: z.string()
      .transform(normalizeWhitespace)
      .pipe(
        z.string()
          .min(1, 'City is required.')
          .min(2, 'City must be at least 2 characters.')
          .max(REGISTRATION_LIMITS.city, `City must be ${REGISTRATION_LIMITS.city} characters or fewer.`)
          .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), 'City contains unsupported characters.')
      ),
    gender: z.custom<Gender>(
      (value) => typeof value === 'string' && genders.includes(value as Gender),
      { message: 'Select a valid gender option.' }
    ),
    primarySport: sportSchema,
    primarySportExperienceLevel: z.custom<SkillLevel>(
      (value) => typeof value === 'string' && skillLevels.includes(value as SkillLevel),
      { message: 'Select a valid experience level.' }
    ),
    secondarySports: z.array(secondarySportSchema).max(allSports.length - 1, 'Too many secondary sports selected.'),
    password: z.string()
      .min(10, 'Password must be at least 10 characters.')
      .max(REGISTRATION_LIMITS.password, `Password must be ${REGISTRATION_LIMITS.password} characters or fewer.`)
      .regex(/[A-Z]/, 'Password must include an uppercase letter.')
      .regex(/[a-z]/, 'Password must include a lowercase letter.')
      .regex(/\d/, 'Password must include a number.')
      .regex(/[^A-Za-z0-9]/, 'Password must include a symbol.')
      .refine((value) => !/\s/.test(value), 'Password cannot contain spaces.'),
    confirmPassword: z.string().min(1, 'Confirm your password.')
  }).superRefine((value, context) => {
    if (value.password !== value.confirmPassword) {
      context.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match.' });
    }
    if (value.secondarySports.includes(value.primarySport)) {
      context.addIssue({
        code: 'custom',
        path: ['secondarySports'],
        message: 'Primary sport cannot also be a secondary sport.'
      });
    }
  });

export const registrationSchema = createRegistrationSchema();
export type RegisterInput = z.input<typeof registrationSchema>;
export type ValidRegistration = z.output<typeof registrationSchema>;
export type RegistrationField = keyof RegisterInput;
export type RegistrationFieldErrors = Partial<Record<RegistrationField, string>>;

export const getRegistrationFieldErrors = (error: z.ZodError): RegistrationFieldErrors => {
  const fieldErrors: RegistrationFieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !(field in fieldErrors)) {
      fieldErrors[field as RegistrationField] = issue.message;
    }
  }
  return fieldErrors;
};
