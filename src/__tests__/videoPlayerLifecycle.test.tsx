import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockListeners: Record<string, (event?: any) => void> = {};
const mockPlayer = {
  loop: false,
  muted: false,
  playing: false,
  status: 'loading',
  duration: 12,
  timeUpdateEventInterval: 0,
  play: jest.fn(),
  pause: jest.fn(),
  replay: jest.fn(),
  release: jest.fn(),
  replaceAsync: jest.fn().mockResolvedValue(undefined),
  addListener: jest.fn((event: string, listener: (payload?: any) => void) => {
    mockListeners[event] = listener;
    return { remove: jest.fn() };
  })
};
const mockUseVideoPlayer = jest.fn((_source, setup?: (player: typeof mockPlayer) => void) => {
  setup?.(mockPlayer);
  return mockPlayer;
});

jest.mock('expo-video', () => {
  const { View } = require('react-native');
  return {
    useVideoPlayer: (...args: unknown[]) => mockUseVideoPlayer(...args),
    VideoView: (props: Record<string, unknown>) => <View testID="native-video-view" {...props} />
  };
});

// eslint-disable-next-line import/first
import { VideoPlayer } from '@/components/ui/VideoPlayer';

describe('VideoPlayer lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockListeners).forEach((key) => delete mockListeners[key]);
    mockPlayer.status = 'loading';
    mockPlayer.duration = 12;
    mockPlayer.replaceAsync.mockResolvedValue(undefined);
  });

  it('releases its player on unmount', async () => {
    const view = await render(<VideoPlayer uri="https://example.com/video.mp4" />);
    await view.unmount();

    expect(mockPlayer.release).toHaveBeenCalledTimes(1);
  });

  it('applies the external paused prop', async () => {
    const view = await render(
      <VideoPlayer uri="https://example.com/video.mp4" autoPlay paused={false} />
    );
    await view.rerender(
      <VideoPlayer uri="https://example.com/video.mp4" autoPlay paused />
    );

    expect(mockPlayer.pause).toHaveBeenCalled();
  });

  it('shows an error state and reloads the source when retry is pressed', async () => {
    await render(<VideoPlayer uri="https://example.com/video.mp4" />);

    await act(() => {
      mockListeners.statusChange?.({
        status: 'error',
        error: { message: 'network error' }
      });
    });

    expect(screen.getByText('Could not load video')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry video' }));

    await waitFor(() =>
      expect(mockPlayer.replaceAsync).toHaveBeenCalledWith('https://example.com/video.mp4')
    );
  });

  it('shows a buffering indicator while loading', async () => {
    await render(<VideoPlayer uri="https://example.com/video.mp4" />);

    expect(screen.getByTestId('video-buffering-indicator')).toBeTruthy();
  });
});
