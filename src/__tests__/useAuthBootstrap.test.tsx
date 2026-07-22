import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockBootstrap = jest.fn();
const mockHandleAuthStateChange = jest.fn();
const mockUnsubscribe = jest.fn();
let authCallback: ((event: AuthChangeEvent, session: Session | null) => void) | undefined;

jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: {
    bootstrap: typeof mockBootstrap;
    handleAuthStateChange: typeof mockHandleAuthStateChange;
  }) => unknown) => selector({
    bootstrap: () => mockBootstrap(),
    handleAuthStateChange: (event, session) => mockHandleAuthStateChange(event, session)
  })
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: jest.fn((callback: typeof authCallback) => {
        authCallback = callback;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      })
    }
  }
}));

// eslint-disable-next-line import/first
import { supabase } from '@/lib/supabase';
// eslint-disable-next-line import/first
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap';

describe('useAuthBootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authCallback = undefined;
    mockBootstrap.mockResolvedValue(undefined);
    mockHandleAuthStateChange.mockResolvedValue(undefined);
  });

  it('owns exactly one auth subscription and forwards events to the store', async () => {
    const { unmount } = await renderHook(() => useAuthBootstrap());

    await waitFor(() => {
      expect(supabase.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
      expect(mockBootstrap).toHaveBeenCalledTimes(1);
      expect(authCallback).toBeDefined();
    });

    await act(async () => {
      authCallback?.('SIGNED_OUT', null);
      await Promise.resolve();
    });

    expect(mockHandleAuthStateChange).toHaveBeenCalledWith('SIGNED_OUT', null);
    await unmount();
    await waitFor(() => expect(mockUnsubscribe).toHaveBeenCalledTimes(1));
  });
});
