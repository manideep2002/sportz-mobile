import {
  createRegistrationSchema,
  getRegistrationFieldErrors,
  MINIMUM_REGISTRATION_AGE
} from '@/schemas/registrationSchema';

const today = new Date(2026, 6, 22);
const schema = createRegistrationSchema(today);
const validInput = {
  firstName: '  Priya  ',
  lastName: '  Sharma ',
  username: ' @Priya_10 ',
  email: ' PRIYA@EXAMPLE.COM ',
  mobileNumber: '09876 543 210',
  dateOfBirth: '2000-01-15',
  city: '  Mumbai,   Maharashtra ',
  gender: 'Female',
  primarySport: 'Cricket',
  primarySportExperienceLevel: 'Intermediate',
  secondarySports: ['Running'],
  password: 'StrongPass9!',
  confirmPassword: 'StrongPass9!'
};

const errorFor = (input: unknown, field: string) => {
  const result = schema.safeParse(input);
  expect(result.success).toBe(false);
  if (result.success) return undefined;
  return getRegistrationFieldErrors(result.error)[field as keyof ReturnType<typeof getRegistrationFieldErrors>];
};

describe('registrationSchema', () => {
  it('normalizes all supported registration text and phone formats', () => {
    const parsed = schema.parse(validInput);

    expect(parsed).toMatchObject({
      firstName: 'Priya',
      lastName: 'Sharma',
      username: 'Priya_10',
      email: 'priya@example.com',
      mobileNumber: '+919876543210',
      city: 'Mumbai, Maharashtra'
    });
  });

  it.each([
    ['firstName', '', 'First name is required.'],
    ['firstName', '123', 'First name can contain letters'],
    ['lastName', '', 'Last name is required.'],
    ['lastName', 'Sharma_1', 'Last name can contain letters'],
    ['username', 'ab', 'Username must be 3-30'],
    ['email', 'not-an-email', 'Enter a valid email address.'],
    ['mobileNumber', '12345', 'Enter a valid 10-digit Indian mobile number'],
    ['city', '', 'City is required.'],
    ['city', 'A', 'City must be at least 2 characters.'],
    ['password', 'weak', 'Password must be at least 10 characters.'],
    ['confirmPassword', '', 'Confirm your password.']
  ])('rejects an invalid %s', (field, value, expectedMessage) => {
    expect(errorFor({ ...validInput, [field]: value }, field)).toContain(expectedMessage);
  });

  it('enforces maximum lengths', () => {
    expect(errorFor({ ...validInput, firstName: 'A'.repeat(51) }, 'firstName')).toContain('50 characters or fewer');
    expect(errorFor({ ...validInput, lastName: 'B'.repeat(51) }, 'lastName')).toContain('50 characters or fewer');
    expect(errorFor({ ...validInput, email: `${'a'.repeat(245)}@example.com` }, 'email')).toContain('254 characters or fewer');
    expect(errorFor({ ...validInput, city: 'C'.repeat(101) }, 'city')).toContain('100 characters or fewer');
    expect(errorFor({ ...validInput, password: `A1!${'a'.repeat(126)}` }, 'password')).toContain('128 characters or fewer');
  });

  it('rejects malformed, future, and underage dates of birth', () => {
    expect(errorFor({ ...validInput, dateOfBirth: '2020-02-31' }, 'dateOfBirth')).toBe('Enter a valid date of birth.');
    expect(errorFor({ ...validInput, dateOfBirth: '2027-01-01' }, 'dateOfBirth')).toBe('Date of birth cannot be in the future.');
    expect(errorFor({ ...validInput, dateOfBirth: '2013-07-23' }, 'dateOfBirth')).toBe(
      `You must be at least ${MINIMUM_REGISTRATION_AGE} years old to create an account.`
    );
  });

  it('accepts a user on their thirteenth birthday', () => {
    expect(schema.safeParse({ ...validInput, dateOfBirth: '2013-07-22' }).success).toBe(true);
  });

  it('validates gender, primary sport, experience, and secondary sports', () => {
    expect(errorFor({ ...validInput, gender: 'Unknown' }, 'gender')).toBe('Select a valid gender option.');
    expect(errorFor({ ...validInput, primarySport: 'Chess' }, 'primarySport')).toBe('Select a valid primary sport.');
    expect(errorFor({ ...validInput, primarySportExperienceLevel: 'Elite' }, 'primarySportExperienceLevel')).toBe(
      'Select a valid experience level.'
    );
    expect(errorFor({ ...validInput, secondarySports: ['Chess'] }, 'secondarySports')).toBe(
      'Select only valid secondary sports.'
    );
    expect(errorFor({ ...validInput, secondarySports: ['Cricket'] }, 'secondarySports')).toBe(
      'Primary sport cannot also be a secondary sport.'
    );
  });

  it('requires every password rule and matching confirmation', () => {
    expect(errorFor({ ...validInput, password: 'lowercase9!' }, 'password')).toBe('Password must include an uppercase letter.');
    expect(errorFor({ ...validInput, password: 'UPPERCASE9!' }, 'password')).toBe('Password must include a lowercase letter.');
    expect(errorFor({ ...validInput, password: 'NoNumber!!' }, 'password')).toBe('Password must include a number.');
    expect(errorFor({ ...validInput, password: 'NoSymbol99' }, 'password')).toBe('Password must include a symbol.');
    expect(errorFor({ ...validInput, password: 'Has Space9!' }, 'password')).toBe('Password cannot contain spaces.');
    expect(errorFor({ ...validInput, confirmPassword: 'Different9!' }, 'confirmPassword')).toBe('Passwords do not match.');
  });
});
