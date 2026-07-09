jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn()
    },
    from: jest.fn()
  }
}));

jest.mock('@/lib/env', () => ({
  env: { isSupabaseConfigured: true }
}));

// eslint-disable-next-line import/first
import { supabase } from '@/lib/supabase';
// eslint-disable-next-line import/first
import { usernameAvailabilityService } from '@/services/usernameAvailabilityService';

const mockInvoke = supabase.functions.invoke as jest.Mock;
const mockFrom = supabase.from as jest.Mock;
const mockMaybeSingle = jest.fn();
const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));

describe('usernameAvailabilityService', () => {
  beforeEach(() => {
    usernameAvailabilityService.clearMemoryCache();
    mockInvoke.mockReset();
    mockFrom.mockReset();
    mockMaybeSingle.mockReset();
    mockEq.mockClear();
    mockSelect.mockClear();
    mockFrom.mockReturnValue({ select: mockSelect });
  });

  it('checks username availability through the Edge Function', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        status: 'available',
        source: 'bloom',
        username: 'open_handle',
        message: 'Username is available.'
      },
      error: null
    });

    await expect(usernameAvailabilityService.verifyUsernameAvailability('@open_handle')).resolves.toEqual({
      status: 'available',
      source: 'bloom',
      username: 'open_handle',
      message: 'Username is available.'
    });

    expect(mockInvoke).toHaveBeenCalledWith('username-availability', {
      body: {
        username: 'open_handle',
        currentUsername: null,
        forceExact: false,
        remember: false
      }
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('serves repeated fast checks from a short local result cache', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        status: 'available',
        source: 'bloom',
        username: 'quick_name',
        message: 'Username is available.'
      },
      error: null
    });

    await usernameAvailabilityService.verifyUsernameAvailability('quick_name');
    mockInvoke.mockClear();

    expect(usernameAvailabilityService.getInstantAvailability('quick_name')).toEqual({
      status: 'available',
      source: 'bloom',
      username: 'quick_name',
      message: 'Username is available.'
    });
    await expect(usernameAvailabilityService.verifyUsernameAvailability('quick_name')).resolves.toMatchObject({
      status: 'available'
    });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('forces an exact Edge Function check for submit-time verification', async () => {
    mockInvoke
      .mockResolvedValueOnce({
        data: {
          status: 'available',
          source: 'bloom',
          username: 'final_name',
          message: 'Username is available.'
        },
        error: null
      })
      .mockResolvedValueOnce({
        data: {
          status: 'taken',
          source: 'database',
          username: 'final_name',
          message: 'That username is already taken.'
        },
        error: null
      });

    await usernameAvailabilityService.verifyUsernameAvailability('final_name');
    await expect(
      usernameAvailabilityService.verifyUsernameAvailability('final_name', undefined, { forceExact: true })
    ).resolves.toEqual({
      status: 'taken',
      source: 'database',
      username: 'final_name',
      message: 'That username is already taken.'
    });

    expect(mockInvoke).toHaveBeenLastCalledWith('username-availability', {
      body: {
        username: 'final_name',
        currentUsername: null,
        forceExact: true,
        remember: false
      }
    });
  });

  it('falls back to a direct database check if the Edge Function is unavailable', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('temporarily down') });
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(usernameAvailabilityService.verifyUsernameAvailability('fallback_name')).resolves.toEqual({
      status: 'available',
      source: 'database',
      username: 'fallback_name',
      message: 'Username is available.'
    });

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockSelect).toHaveBeenCalledWith('id');
    expect(mockEq).toHaveBeenCalledWith('username', 'fallback_name');
  });

  it('warms the Edge Function username filter without touching profiles from the app', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { status: 'checking', source: 'cache', username: '', message: 'Username filter is warm.' },
      error: null
    });

    await usernameAvailabilityService.warmUsernameFilter();

    expect(mockInvoke).toHaveBeenCalledWith('username-availability', {
      body: { warm: true }
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('remembers a newly claimed username through the Edge Function', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        status: 'taken',
        source: 'database',
        username: 'claimed_name',
        message: 'That username is already taken.'
      },
      error: null
    });

    await usernameAvailabilityService.rememberUsername('claimed_name');

    expect(usernameAvailabilityService.getInstantAvailability('claimed_name')).toMatchObject({
      status: 'taken',
      username: 'claimed_name'
    });
    expect(mockInvoke).toHaveBeenCalledWith('username-availability', {
      body: {
        username: 'claimed_name',
        currentUsername: null,
        forceExact: true,
        remember: true
      }
    });
  });
});
