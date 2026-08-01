import AsyncStorage from '@react-native-async-storage/async-storage';

const mockSecureGet = jest.fn();
const mockSecureSet = jest.fn();
const mockSecureDelete = jest.fn();

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 5,
  getItemAsync: (...args: unknown[]) => mockSecureGet(...args),
  setItemAsync: (...args: unknown[]) => mockSecureSet(...args),
  deleteItemAsync: (...args: unknown[]) => mockSecureDelete(...args)
}));

// The adapter must be imported after the native module mock.
// eslint-disable-next-line import/first
import { secureSessionStorage } from '@/lib/secureSessionStorage';

describe('secureSessionStorage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    mockSecureGet.mockResolvedValue(null);
    mockSecureSet.mockResolvedValue(undefined);
    mockSecureDelete.mockResolvedValue(undefined);
  });

  it('restores an existing secure session after an application restart without reading AsyncStorage', async () => {
    mockSecureGet.mockResolvedValueOnce('secure-session');

    await expect(secureSessionStorage.getItem('sb-auth-token')).resolves.toBe('secure-session');
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  });

  it('migrates a legacy AsyncStorage session only after securely writing it', async () => {
    await AsyncStorage.setItem('sb-auth-token', 'legacy-session');

    await expect(secureSessionStorage.getItem('sb-auth-token')).resolves.toBe('legacy-session');
    expect(mockSecureSet).toHaveBeenCalledWith('sb-auth-token', 'legacy-session', expect.any(Object));
    await expect(AsyncStorage.getItem('sb-auth-token')).resolves.toBeNull();
  });

  it('does not delete the legacy session when secure migration fails', async () => {
    await AsyncStorage.setItem('sb-auth-token', 'legacy-session');
    mockSecureSet.mockRejectedValueOnce(new Error('keychain unavailable'));

    await expect(secureSessionStorage.getItem('sb-auth-token')).rejects.toThrow('keychain unavailable');
    await expect(AsyncStorage.getItem('sb-auth-token')).resolves.toBe('legacy-session');
  });

  it('clears both secure and legacy stores when Supabase removes a session', async () => {
    await AsyncStorage.setItem('sb-auth-token', 'legacy-session');
    await secureSessionStorage.removeItem('sb-auth-token');

    expect(mockSecureDelete).toHaveBeenCalledWith('sb-auth-token', expect.any(Object));
    await expect(AsyncStorage.getItem('sb-auth-token')).resolves.toBeNull();
  });
});
