/**
 * Tests for usePushNotifications — platform-conditional native notification behaviour.
 *
 * Platform is controlled via jest.mock('react-native', ...) overrides so we can
 * exercise both the web and native code-paths in the same test suite.
 */

import { renderHook, act } from '@testing-library/react-native';

// ─── Shared mock state ────────────────────────────────────────────────────────

const mockSetNotificationUnreadCount = jest.fn();
const mockCountUnread = jest.fn().mockResolvedValue(3);
const mockRegisterForPush = jest.fn().mockResolvedValue('ExponentPushToken[test]');

// Notification-listener mocks
const mockAddReceivedListener = jest.fn().mockReturnValue({ remove: jest.fn() });
const mockAddResponseListener = jest.fn().mockReturnValue({ remove: jest.fn() });
const mockGetLastResponse = jest.fn().mockResolvedValue(null);

// Realtime notification mock
const mockUseRealtimeNotifications = jest.fn();

// ─── Static mocks (applied unconditionally) ──────────────────────────────────

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
  // We re-export a writable isNativePlatform so individual tests can override it.
  isNativePlatform: jest.fn(),
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
  navigateFromNotificationData: jest.fn()
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

// eslint-disable-next-line import/first
import { usePushNotifications } from '@/hooks/usePushNotifications';
// eslint-disable-next-line import/first
import { isNativePlatform } from '@/lib/notifications';

const mockIsNativePlatform = isNativePlatform as jest.MockedFunction<typeof isNativePlatform>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderHookAndFlush() {
  const result = renderHook(() => usePushNotifications());
  // Flush all pending microtasks / async state updates.
  return result;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('usePushNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLastResponse.mockResolvedValue(null);
  });

  // ── Web platform ────────────────────────────────────────────────────────────

  describe('on web (isNativePlatform = false)', () => {
    beforeEach(() => {
      mockIsNativePlatform.mockReturnValue(false);
    });

    it('does NOT register native received listener', async () => {
      renderHookAndFlush();
      await act(async () => {});
      expect(mockAddReceivedListener).not.toHaveBeenCalled();
    });

    it('does NOT register native response listener', async () => {
      renderHookAndFlush();
      await act(async () => {});
      expect(mockAddResponseListener).not.toHaveBeenCalled();
    });

    it('does NOT call getLastNotificationResponseAsync', async () => {
      renderHookAndFlush();
      await act(async () => {});
      expect(mockGetLastResponse).not.toHaveBeenCalled();
    });

    it('does NOT call registerForPushNotificationsAsync', async () => {
      renderHookAndFlush();
      await act(async () => {});
      expect(mockRegisterForPush).not.toHaveBeenCalled();
    });

    it('still fetches unread count via Supabase', async () => {
      renderHookAndFlush();
      await act(async () => {});
      expect(mockCountUnread).toHaveBeenCalledTimes(1);
      expect(mockSetNotificationUnreadCount).toHaveBeenCalledWith(3);
    });

    it('still subscribes to realtime notifications', async () => {
      renderHookAndFlush();
      await act(async () => {});
      expect(mockUseRealtimeNotifications).toHaveBeenCalled();
    });
  });

  // ── Native platform ─────────────────────────────────────────────────────────

  describe('on native (isNativePlatform = true)', () => {
    beforeEach(() => {
      mockIsNativePlatform.mockReturnValue(true);
    });

    it('registers both native listeners', async () => {
      renderHookAndFlush();
      await act(async () => {});
      expect(mockAddReceivedListener).toHaveBeenCalledTimes(1);
      expect(mockAddResponseListener).toHaveBeenCalledTimes(1);
    });

    it('calls getLastNotificationResponseAsync on mount', async () => {
      renderHookAndFlush();
      await act(async () => {});
      expect(mockGetLastResponse).toHaveBeenCalledTimes(1);
    });

    it('calls registerForPushNotificationsAsync when user is present', async () => {
      renderHookAndFlush();
      await act(async () => {});
      expect(mockRegisterForPush).toHaveBeenCalledTimes(1);
    });

    it('routes to correct screen when a last-notification response exists', async () => {
      const { navigateFromNotificationData } = await import('@/navigation/notificationRouting');
      const { shouldHandleNotification } = await import('@/lib/notifications');
      (shouldHandleNotification as jest.Mock).mockResolvedValueOnce(true);

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

      renderHookAndFlush();
      await act(async () => {});

      expect(navigateFromNotificationData).toHaveBeenCalledWith(
        expect.anything(),
        fakeResponse.notification.request.content.data
      );
    });

    it('handles a rejected getLastNotificationResponseAsync without unhandled rejection', async () => {
      mockGetLastResponse.mockRejectedValueOnce(new Error('UnavailabilityError'));

      // Should not throw
      expect(() => {
        renderHookAndFlush();
      }).not.toThrow();

      await act(async () => {});
      // No unhandled rejection — test passes if we reach this point.
    });

    it('calls remove() on both listeners during cleanup', () => {
      const removeForeground = jest.fn();
      const removeResponse = jest.fn();
      mockAddReceivedListener.mockReturnValueOnce({ remove: removeForeground });
      mockAddResponseListener.mockReturnValueOnce({ remove: removeResponse });

      const { unmount } = renderHookAndFlush();
      unmount();

      expect(removeForeground).toHaveBeenCalledTimes(1);
      expect(removeResponse).toHaveBeenCalledTimes(1);
    });
  });
});
