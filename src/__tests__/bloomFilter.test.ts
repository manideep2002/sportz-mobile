import { BloomFilter } from '@/utils/bloomFilter';

describe('BloomFilter', () => {
  it('finds inserted values without false negatives', () => {
    const filter = BloomFilter.fromItems(['marcusk', 'athlete_01', 'point_guard'], {
      expectedItems: 100,
      falsePositiveRate: 0.0001
    });

    expect(filter.mightContain('marcusk')).toBe(true);
    expect(filter.mightContain('athlete_01')).toBe(true);
    expect(filter.mightContain('point_guard')).toBe(true);
  });

  it('rejects definitely missing values', () => {
    const filter = BloomFilter.fromItems(['marcusk', 'athlete_01', 'point_guard'], {
      expectedItems: 100,
      falsePositiveRate: 0.0001
    });

    expect(filter.mightContain('free_handle_99')).toBe(false);
  });

  it('round-trips through serialization', () => {
    const filter = BloomFilter.fromItems(['post-1', 'post-2', 'post-3'], {
      expectedItems: 100,
      falsePositiveRate: 0.0001
    });
    const restored = BloomFilter.deserialize(filter.serialize());

    expect(restored.mightContain('post-1')).toBe(true);
    expect(restored.mightContain('post-2')).toBe(true);
    expect(restored.mightContain('post-3')).toBe(true);
    expect(restored.mightContain('post-404')).toBe(false);
  });
});
