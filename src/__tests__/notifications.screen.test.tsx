import { fireEvent, render, screen } from '@testing-library/react-native';

const mockNavigation = {
  goBack: jest.fn(),
  navigate: jest.fn()
};
const mockFetchNextPage = jest.fn();
const mockRefetch = jest.fn();
const mockMarkAllRead = jest.fn();
const mockMarkAsRead = jest.fn();
const mockRespondInvite = jest.fn();
let mockFetchingNext = false;
let mockHasNextPage = true;

const notification = {
  id: 'notification-1',
  kind: 'event',
  title: 'Game starts soon',
  body: 'Friday Night Hoops starts in one hour.',
  read: false,
  createdAt: '2026-07-14T10:00:00.000Z',
  entityId: 'event-42',
  entityType: 'event'
};

jest.mock('@/components/ui', () => require('@/test/mockUi'));
jest.mock('@shopify/flash-list', () => require('@/test/mockFlashList'));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation
}));
jest.mock('@/navigation/navigationRef', () => ({ navigationRef: {} }));
jest.mock('@/navigation/notificationRouting', () => ({
  navigateFromNotificationData: jest.fn(() => false),
  notificationToRouteData: jest.fn(() => ({}))
}));
jest.mock('@/hooks/useNotifications', () => ({
  useInfiniteNotifications: () => ({
    data: { pages: [[notification], []] },
    isLoading: false,
    isError: false,
    error: null,
    isRefetching: false,
    isFetchingNextPage: mockFetchingNext,
    hasNextPage: mockHasNextPage,
    fetchNextPage: mockFetchNextPage,
    refetch: mockRefetch
  }),
  useMarkNotificationsRead: () => ({ mutate: mockMarkAllRead, isPending: false }),
  useMarkNotificationRead: () => ({ mutate: mockMarkAsRead })
}));
jest.mock('@/hooks/useCommunities', () => ({
  useRespondCommunityInvite: () => ({ mutate: mockRespondInvite, isPending: false })
}));

// eslint-disable-next-line import/first
import { NotificationsScreen } from '@/screens/notifications/NotificationsScreen';

describe('NotificationsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchingNext = false;
    mockHasNextPage = true;
  });

  it('marks an unread item read and navigates to its user-visible destination', async () => {
    await render(<NotificationsScreen />);

    await fireEvent.press(screen.getByText('Game starts soon'));

    expect(mockMarkAsRead).toHaveBeenCalledWith('notification-1');
    expect(mockNavigation.navigate).toHaveBeenCalledWith('EventDetail', {
      eventId: 'event-42'
    });
  });

  it('fetches the next page once the user reaches the list end', async () => {
    const { rerender } = await render(<NotificationsScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Load more' }));
    expect(mockFetchNextPage).toHaveBeenCalledTimes(1);

    mockFetchingNext = true;
    await rerender(<NotificationsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Load more' }));
    expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
  });
});





