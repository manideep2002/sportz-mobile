import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { usePostActions } from '@/hooks/usePostActions';
import type { Post } from '@/types/domain';

const mockSharePost = jest.fn();
const mockRecordShare = jest.fn();
const mockDeletePost = jest.fn();

jest.mock('@/utils/share', () => ({
  sharePost: (...args: unknown[]) => mockSharePost(...args)
}));

jest.mock('@/hooks/useFeed', () => ({
  useRecordPostShare: () => ({ mutateAsync: (...args: unknown[]) => mockRecordShare(...args) }),
  useDeletePost: () => ({ mutateAsync: (...args: unknown[]) => mockDeletePost(...args) })
}));

const post = {
  id: 'post-1',
  author: { displayName: 'Asha' }
} as Post;

describe('central post action handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecordShare.mockResolvedValue(undefined);
    mockDeletePost.mockResolvedValue(undefined);
  });

  it('does not count a dismissed native share', async () => {
    mockSharePost.mockResolvedValue('dismissed');
    const { result } = await renderHook(() => usePostActions());

    await act(() => result.current.share(post));

    expect(mockSharePost).toHaveBeenCalledTimes(1);
    expect(mockRecordShare).not.toHaveBeenCalled();
  });

  it('counts a completed share once and rejects duplicate taps while pending', async () => {
    let resolveShare: ((value: 'shared') => void) | undefined;
    mockSharePost.mockReturnValue(new Promise((resolve) => {
      resolveShare = resolve;
    }));
    const { result } = await renderHook(() => usePostActions());

    let first: Promise<void>;
    await act(() => {
      first = result.current.share(post);
      void result.current.share(post);
    });
    expect(mockSharePost).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveShare?.('shared');
      await first!;
    });
    expect(mockRecordShare).toHaveBeenCalledTimes(1);
  });

  it('offers a recoverable retry after native share rejection', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    mockSharePost.mockRejectedValueOnce(new Error('Native share unavailable')).mockResolvedValueOnce('shared');
    const { result } = await renderHook(() => usePostActions());

    await act(() => result.current.share(post));
    expect(alert).toHaveBeenCalledWith(
      'Could not share post',
      'Native share unavailable',
      expect.any(Array)
    );
    const actions = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => {
      actions.find((action) => action.text === 'Retry')?.onPress?.();
    });
    await waitFor(() => expect(mockRecordShare).toHaveBeenCalledWith('post-1'));
    alert.mockRestore();
  });

  it('navigates only after confirmed delete and guards duplicate delete taps', async () => {
    let resolveDelete: (() => void) | undefined;
    mockDeletePost.mockReturnValue(new Promise<void>((resolve) => {
      resolveDelete = resolve;
    }));
    const onSuccess = jest.fn();
    const { result } = await renderHook(() => usePostActions());

    let first: Promise<void>;
    await act(() => {
      first = result.current.deletePost('post-1', onSuccess);
      void result.current.deletePost('post-1', onSuccess);
    });
    expect(mockDeletePost).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();

    await act(async () => {
      resolveDelete?.();
      await first!;
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
