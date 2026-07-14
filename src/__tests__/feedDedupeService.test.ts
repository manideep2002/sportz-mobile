import { feedDedupeService } from '@/services/feedDedupeService';

describe('feedDedupeService', () => {
  it('keeps only unique items in insertion order', () => {
    const items = [
      { id: 'post-1' },
      { id: 'post-2' },
      { id: 'post-1' },
      { id: 'post-3' }
    ];

    expect(feedDedupeService.keepUnique(items, (item) => item.id)).toEqual([
      { id: 'post-1' },
      { id: 'post-2' },
      { id: 'post-3' }
    ]);
  });

  it('returns the same result regardless of earlier feed requests', () => {
    expect(feedDedupeService.keepUnique([{ id: 'post-1' }], (item) => item.id)).toEqual([{ id: 'post-1' }]);
    expect(feedDedupeService.keepUnique([{ id: 'post-1' }, { id: 'post-2' }], (item) => item.id)).toEqual([
      { id: 'post-1' },
      { id: 'post-2' }
    ]);
  });
});
