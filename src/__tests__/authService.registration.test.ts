const mockSupabaseSignUp = jest.fn();
const mockCacheSet = jest.fn();

jest.mock('@/lib/supabaseOnly', () => ({ assertSupabaseConfigured: jest.fn() }));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { signUp: (input: unknown) => mockSupabaseSignUp(input) }
  }
}));
jest.mock('@/services/hotCacheService', () => ({
  hotCacheService: {
    set: (key: string, value: unknown, options: unknown) => mockCacheSet(key, value, options)
  }
}));
jest.mock('@/services/profileService', () => ({ profileService: {} }));

// eslint-disable-next-line import/first
import { authService } from '@/services/authService';

const validInput = {
  firstName: '  Priya ',
  lastName: ' Sharma  ',
  username: ' @Priya_10 ',
  email: ' PRIYA@EXAMPLE.COM ',
  mobileNumber: '09876 543 210',
  dateOfBirth: '2000-01-15',
  city: ' Mumbai,   Maharashtra ',
  gender: 'Female' as const,
  primarySport: 'Cricket' as const,
  primarySportExperienceLevel: 'Intermediate' as const,
  secondarySports: ['Running' as const],
  password: 'StrongPass9!',
  confirmPassword: 'StrongPass9!'
};

describe('authService registration validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseSignUp.mockResolvedValue({ data: { session: null, user: null }, error: null });
    mockCacheSet.mockResolvedValue(undefined);
  });

  it('does not send invalid registration data to Supabase', async () => {
    await expect(authService.signUp({ ...validInput, email: 'invalid' })).rejects.toThrow('valid email');
    expect(mockSupabaseSignUp).not.toHaveBeenCalled();
  });

  it('sends only normalized registration metadata and no OTP verification claim', async () => {
    await authService.signUp(validInput);

    expect(mockSupabaseSignUp).toHaveBeenCalledWith({
      email: 'priya@example.com',
      password: 'StrongPass9!',
      options: {
        data: expect.objectContaining({
          display_name: 'Priya Sharma',
          username: 'Priya_10',
          city: 'Mumbai, Maharashtra',
          mobile_number: '+919876543210',
          date_of_birth: '2000-01-15',
          primary_sport: 'Cricket',
          secondary_sports: ['Running'],
          sports: ['Cricket', 'Running']
        })
      }
    });
    const request = mockSupabaseSignUp.mock.calls[0]?.[0] as { options?: { data?: Record<string, unknown> } };
    expect(request.options?.data).not.toHaveProperty('mobile_otp_verified');
  });
});
