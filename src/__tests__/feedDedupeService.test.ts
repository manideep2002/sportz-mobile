import { feedDedupeService } from '@/services/feedDedupeService';

describe('feedDedupeService', () => {
  beforeEach(() => {
    feedDedupeService.reset();
  });

  it('keeps only unseen items in insertion order', () => {
    const items = [
      { id: 'post-1' },
      { id: 'post-2' },
      { id: 'post-1' },
      { id: 'post-3' }
    ];

    expect(feedDedupeService.keepUnseen(items, (item) => item.id)).toEqual([
      { id: 'post-1' },
      { id: 'post-2' },
      { id: 'post-3' }
    ]);
  });

  it('remembers seen items across calls until reset', () => {
    expect(feedDedupeService.keepUnseen([{ id: 'post-1' }], (item) => item.id)).toEqual([
      { id: 'post-1' }
    ]);
    expect(feedDedupeService.keepUnseen([{ id: 'post-1' }, { id: 'post-2' }], (item) => item.id)).toEqual([
      { id: 'post-2' }
    ]);
  });
});
