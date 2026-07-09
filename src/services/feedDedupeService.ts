import { BloomFilter } from '@/utils/bloomFilter';

const SESSION_EXPECTED_POSTS = 5000;
const SESSION_FALSE_POSITIVE_RATE = 0.0005;

let seenPostFilter = BloomFilter.create({
  expectedItems: SESSION_EXPECTED_POSTS,
  falsePositiveRate: SESSION_FALSE_POSITIVE_RATE
});

export const feedDedupeService = {
  reset() {
    seenPostFilter = BloomFilter.create({
      expectedItems: SESSION_EXPECTED_POSTS,
      falsePositiveRate: SESSION_FALSE_POSITIVE_RATE
    });
  },

  keepUnseen<T>(items: T[], getId: (item: T) => string) {
    const unseen: T[] = [];

    for (const item of items) {
      const id = getId(item);
      if (seenPostFilter.mightContain(id)) continue;

      seenPostFilter.add(id);
      unseen.push(item);
    }

    return unseen;
  }
};
