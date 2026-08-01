import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { allSports } from '@/constants/sports';

const mockListPlayers = jest.fn();

jest.mock('@/components/ui', () => require('@/test/mockUi'));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() })
}));
jest.mock('@/design/ThemeProvider', () => ({
  useAppTheme: () => ({ colors: { accent: '#f60', accentSoft: '#fff', accentBorder: '#ddd', surface: '#fff', border: '#ddd' } })
}));
jest.mock('@/services/messageService', () => ({ messageService: { createDirectConversation: jest.fn() } }));
jest.mock('@/services/profileService', () => ({
  profileService: { listPlayers: (...args: unknown[]) => mockListPlayers(...args) }
}));

// eslint-disable-next-line import/first
import { FindPlayersScreen, playerSportFilters, playerSportQueryValue } from '@/screens/profile/FindPlayersScreen';

describe('Find Players canonical sports', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListPlayers.mockResolvedValue([]);
  });

  it('exposes every canonical sport and preserves its database query value', async () => {
    expect(playerSportFilters).toEqual(['All Sports', ...allSports]);
    expect(allSports).toEqual(expect.arrayContaining([
      'Kabaddi', 'Hockey', 'Athletics', 'Swimming', 'Table Tennis', 'Volleyball', 'Boxing', 'Other'
    ]));
    expect(playerSportQueryValue('All Sports')).toBeUndefined();

    await render(<FindPlayersScreen />);
    await waitFor(() => expect(mockListPlayers).toHaveBeenCalledWith('', undefined, 0, 30));

    for (const sport of allSports) {
      expect(playerSportQueryValue(sport)).toBe(sport);
      await fireEvent.press(screen.getByRole('button', { name: sport }));
      await waitFor(() => expect(mockListPlayers).toHaveBeenCalledWith('', sport, 0, 30));
    }
  });
});
