/**
 * Tests for usePushNotifications — platform-conditional native notification behaviour.
 *
 * @testing-library/react-native's renderHook() is async in this version; all
 * call-sites must await it. Dynamic imports are unsupported by the Babel/Jest
 * transform, so all mocked modules are accessed through their statically-imported
 * aliases instead.
 *
 * isNativePlatform is mocked via a closure referencing `mockNativePlatform`
 * (variable names prefixed "mock" are allowed inside jest.mock factories).
 */

import { act } from '@testing-library/react-native';

// ─── Shared mock state ────────────────────────────────────────────────────────

const mockSetNotificationUnreadCount = jest.fn();
const mockCountUnread = jest.fn().mockResolvedValue(3);
const mockRegisterForPush = jest.fn().mockResolvedValue('ExponentPushToken[test]');

// Notification-listener mocks
const mockRemoveForeground = jest.fn();
const mockRemoveResponse = jest.fn();
const mockAddReceivedListener = jest.fn().mockReturnValue({ remove: mockRemoveForeground });
const mockAddResponseListener = jest.fn().mockReturnValue({ remove: mockRemoveResponse });
const mockGetLastResponse = jest.fn().mockResolvedValue(null);
const mockNavigateFromNotificationData = jest.fn();

// Realtime notification mock
const mockUseRealtimeNotifications = jest.fn();

// Mutable flag controlling isNativePlatform — "mock" prefix allows access inside factory
let mockNativePlatform = false;

// ─── Static mocks ─────────────────────────────────────────────────────────────

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-notifications', () => ({
  addNotificationReceivedListener: (...args: unknown[]) => mockAddReceivedListener(...args),
  addNotificationResponseReceivedListener: (...args: unknown[]) =>
    mockAddResponseListener(...args),
  getLastNotificationResponseAsync: (...args: unknown[]) => mockGetLastResponse(...args),
  setNotificationHandler: jest.fn()
}));

jest.mock('@/lib/notifications', () => ({
  // Closure over mockNativePlatform — updated in beforeEach, read at call time
  isNativePlatform: () => mockNativePlatform,
  registerForPushNotificationsAsync: (...args: unknown[]) => mockRegisterForPush(...args),
  shouldHandleNotification: jest.fn().mockResolvedValue(true)
}));

jest.mock('@/services/notificationService', () => ({
  notificationService: {
    countUnread: (...args: unknown[]) => mockCountUnread(...args)
  }
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (s: { user: { id: string } | null }) => unknown) =>
    selector({ user: { id: 'user-1' } })
}));

jest.mock('@/store/uiStore', () => ({
  useUiStore: (
    selector: (s: { setNotificationUnreadCount: jest.Mock }) => unknown
  ) => selector({ setNotificationUnreadCount: mockSetNotificationUnreadCount })
}));

jest.mock('@/hooks/useNotifications', () => ({
  useRealtimeNotifications: (...args: unknown[]) => mockUseRealtimeNotifications(...args)
}));

jest.mock('@/navigation/navigationRef', () => ({ navigationRef: {} }));
jest.mock('@/navigation/notificationRouting', () => ({
  navigateFromNotificationData: (...args: unknown[]) =>
    mockNavigateFromNotificationData(...args)
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

// eslint-disable-next-line import/first
import { renderHook } from '@testing-library/react-native';
// eslint-disable-next-line import/first
import { usePushNotifications } from '@/hooks/usePushNotifications';
// eslint-disable-next-line import/first
import { shouldHandleNotification } from '@/lib/notifications';

const mockShouldHandle = shouldHandleNotification as jest.MockedFunction<
  typeof shouldHandleNotification
>;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('usePushNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Restore safe defaults after clearAllMocks resets all mock implementations
    mockCountUnread.mockResolvedValue(3);
    mockRegisterForPush.mockResolvedValue('ExponentPushToken[test]');
    mockGetLastResponse.mockResolvedValue(null);
    mockAddReceivedListener.mockReturnValue({ remove: mockRemoveForeground });
    mockAddResponseListener.mockReturnValue({ remove: mockRemoveResponse });
    mockShouldHandle.mockResolvedValue(true);
  });

  // ── Web platform ────────────────────────────────────────────────────────────

  describe('on web (isNativePlatform = false)', () => {
    beforeEach(() => {
      mockNativePlatform = false;
    });

    it('does NOT register native received listener', async () => {
      await act(async () => {
        await renderHook(() => usePushNotifications());
      });
      expect(mockAddReceivedListener).not.toHaveBeenCalled();
    });

    it('does NOT register native response listener', async () => {
      await act(async () => {
        await renderHook(() => usePushNotifications());
      });
      expect(mockAddResponseListener).not.toHaveBeenCalled();
    });

    it('does NOT call getLastNotificationResponseAsync', async () => {
      await act(async () => {
        await renderHook(() => usePushNotifications());
      });
      expect(mockGetLastResponse).not.toHaveBeenCalled();
    });

    it('does NOT call registerForPushNotificationsAsync', async () => {
      await act(async () => {
        await renderHook(() => usePushNotifications());
      });
      expect(mockRegisterForPush).not.toHaveBeenCalled();
    });

    it('still fetches unread count via Supabase', async () => {
      await act(async () => {
        await renderHook(() => usePushNotifications());
      });
      expect(mockCountUnread).toHaveBeenCalledTimes(1);
      expect(mockSetNotificationUnreadCount).toHaveBeenCalledWith(3);
    });

    it('still subscribes to realtime notifications', async () => {
      await act(async () => {
        await renderHook(() => usePushNotifications());
      });
      expect(mockUseRealtimeNotifications).toHaveBeenCalled();
    });
  });

  // ── Native platform ─────────────────────────────────────────────────────────

  describe('on native (isNativePlatform = true)', () => {
    beforeEach(() => {
      mockNativePlatform = true;
    });

    it('registers both native listeners', async () => {
      await act(async () => {
        await renderHook(() => usePushNotifications());
      });
      expect(mockAddReceivedListener).toHaveBeenCalledTimes(1);
      expect(mockAddResponseListener).toHaveBeenCalledTimes(1);
    });

    it('calls getLastNotificationResponseAsync on mount', async () => {
      await act(async () => {
        await renderHook(() => usePushNotifications());
      });
      expect(mockGetLastResponse).toHaveBeenCalledTimes(1);
    });

    it('calls registerForPushNotificationsAsync when user is present', async () => {
      await act(async () => {
        await renderHook(() => usePushNotifications());
      });
      expect(mockRegisterForPush).toHaveBeenCalledTimes(1);
    });

    it('routes to the correct screen when a last-notification response exists', async () => {
      const fakeResponse = {
        notification: {
          request: {
            content: {
              data: { entityType: 'event', entityId: 'evt-99' }
            }
          }
        }
      };
      mockGetLastResponse.mockResolvedValueOnce(fakeResponse);
      mockShouldHandle.mockResolvedValueOnce(true);

      await act(async () => {
        await renderHook(() => usePushNotifications());
      });

      expect(mockNavigateFromNotificationData).toHaveBeenCalledWith(
        expect.anything(),
        fakeResponse.notification.request.content.data
      );
    });

    it('handles a rejected getLastNotificationResponseAsync without unhandled rejection', async () => {
      mockGetLastResponse.mockRejectedValueOnce(new Error('UnavailabilityError'));

      // Should not throw
      await expect(
        act(async () => {
          await renderHook(() => usePushNotifications());
        })
      ).resolves.not.toThrow();
    });

    it('does not navigate when shouldHandleNotification returns false', async () => {
      const fakeResponse = {
        notification: {
          request: {
            content: { data: { entityType: 'like', entityId: 'post-1' } }
          }
        }
      };
      mockGetLastResponse.mockResolvedValueOnce(fakeResponse);
      mockShouldHandle.mockResolvedValueOnce(false);

      await act(async () => {
        await renderHook(() => usePushNotifications());
      });

      expect(mockNavigateFromNotificationData).not.toHaveBeenCalled();
    });

    it('calls remove() on both listeners during cleanup', async () => {
      const removeForeground = jest.fn();
      const removeResponse = jest.fn();
      mockAddReceivedListener.mockReturnValueOnce({ remove: removeForeground });
      mockAddResponseListener.mockReturnValueOnce({ remove: removeResponse });

      let unmountFn: (() => Promise<void>) | undefined;

      await act(async () => {
        const { unmount } = await renderHook(() => usePushNotifications());
        unmountFn = unmount;
      });

      await act(async () => {
        await unmountFn?.();
      });

      expect(removeForeground).toHaveBeenCalledTimes(1);
      expect(removeResponse).toHaveBeenCalledTimes(1);
    });
  });
});
