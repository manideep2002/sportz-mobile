import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  openPendingNotificationDestination,
  pendingNotificationDestination
} from '@/navigation/notificationRouting';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const navigate = jest.fn();
let ready = true;
const ref = { isReady: () => ready, navigate } as never;

describe('pending notification destination', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    navigate.mockClear();
    ready = true;
  });

  it('retains a cold-start destination while signed out or blocked by MFA/profile completion', async () => {
    await pendingNotificationDestination.save({ eventId: 'event-1' });

    await expect(openPendingNotificationDestination(ref, false)).resolves.toBe(false);
    await expect(pendingNotificationDestination.peek()).resolves.toMatchObject({ eventId: 'event-1' });
  });

  it('retains a destination until navigation becomes ready and clears it after handling once', async () => {
    await pendingNotificationDestination.save({ kind: 'security', entityType: 'security_event' });
    ready = false;
    await expect(openPendingNotificationDestination(ref, true)).resolves.toBe(false);
    expect(navigate).not.toHaveBeenCalled();

    ready = true;
    await expect(openPendingNotificationDestination(ref, true)).resolves.toBe(true);
    expect(navigate).toHaveBeenCalledWith('App', { screen: 'AccountSecurity' });
    await expect(pendingNotificationDestination.peek()).resolves.toBeNull();
    await openPendingNotificationDestination(ref, true);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('normalizes malformed/missing entity payloads to the safe notifications fallback', async () => {
    await pendingNotificationDestination.save({ entityId: ['not-an-id'] });
    await openPendingNotificationDestination(ref, true);
    expect(navigate).toHaveBeenCalledWith('App', { screen: 'Notifications' });
  });
});
