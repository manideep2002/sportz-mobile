export interface BloomFilterOptions {
  expectedItems: number;
  falsePositiveRate?: number;
}

export interface SerializedBloomFilter {
  bitSize: number;
  hashCount: number;
  bitsetHex: string;
}

const DEFAULT_FALSE_POSITIVE_RATE = 0.001;
const MIN_EXPECTED_ITEMS = 1;
const HEX_BYTE_LENGTH = 2;

const clampFalsePositiveRate = (rate: number) => Math.min(Math.max(rate, 0.000001), 0.5);

const toPositiveInteger = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? Math.ceil(value) : fallback;

const optimalBitSize = (expectedItems: number, falsePositiveRate: number) => {
  const size = Math.ceil((-expectedItems * Math.log(falsePositiveRate)) / Math.LN2 ** 2);
  return Math.max(8, size);
};

const optimalHashCount = (bitSize: number, expectedItems: number) => {
  const count = Math.round((bitSize / expectedItems) * Math.LN2);
  return Math.max(1, count);
};

const fnv1a32 = (value: string, seed: number) => {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const toHex = (bitset: Uint8Array) =>
  Array.from(bitset)
    .map((byte) => byte.toString(16).padStart(HEX_BYTE_LENGTH, '0'))
    .join('');

const fromHex = (hex: string) => {
  const normalized = hex.length % HEX_BYTE_LENGTH === 0 ? hex : `0${hex}`;
  const bytes = new Uint8Array(normalized.length / HEX_BYTE_LENGTH);
  for (let index = 0; index < normalized.length; index += HEX_BYTE_LENGTH) {
    bytes[index / HEX_BYTE_LENGTH] = Number.parseInt(normalized.slice(index, index + HEX_BYTE_LENGTH), 16);
  }
  return bytes;
};

export class BloomFilter {
  private readonly bitset: Uint8Array;

  readonly bitSize: number;

  readonly hashCount: number;

  constructor(bitSize: number, hashCount: number, bitset?: Uint8Array) {
    this.bitSize = toPositiveInteger(bitSize, 8);
    this.hashCount = toPositiveInteger(hashCount, 1);
    this.bitset = bitset ?? new Uint8Array(Math.ceil(this.bitSize / 8));
  }

  static create(options: BloomFilterOptions) {
    const expectedItems = toPositiveInteger(options.expectedItems, MIN_EXPECTED_ITEMS);
    const falsePositiveRate = clampFalsePositiveRate(options.falsePositiveRate ?? DEFAULT_FALSE_POSITIVE_RATE);
    const bitSize = optimalBitSize(expectedItems, falsePositiveRate);
    const hashCount = optimalHashCount(bitSize, expectedItems);
    return new BloomFilter(bitSize, hashCount);
  }

  static fromItems(items: Iterable<string>, options: BloomFilterOptions) {
    const filter = BloomFilter.create(options);
    for (const item of items) {
      filter.add(item);
    }
    return filter;
  }

  static deserialize(serialized: SerializedBloomFilter) {
    return new BloomFilter(serialized.bitSize, serialized.hashCount, fromHex(serialized.bitsetHex));
  }

  add(value: string) {
    for (const position of this.positions(value)) {
      this.setBit(position);
    }
  }

  mightContain(value: string) {
    for (const position of this.positions(value)) {
      if (!this.getBit(position)) return false;
    }
    return true;
  }

  serialize(): SerializedBloomFilter {
    return {
      bitSize: this.bitSize,
      hashCount: this.hashCount,
      bitsetHex: toHex(this.bitset)
    };
  }

  private *positions(value: string) {
    const firstHash = fnv1a32(value, 0x811c9dc5);
    const secondHash = fnv1a32(value, firstHash ^ 0x9e3779b9) || 1;

    for (let index = 0; index < this.hashCount; index += 1) {
      const combined = (firstHash + Math.imul(index, secondHash)) >>> 0;
      yield combined % this.bitSize;
    }
  }

  private setBit(position: number) {
    const byteIndex = position >> 3;
    this.bitset[byteIndex] |= 1 << (position & 7);
  }

  private getBit(position: number) {
    const byteIndex = position >> 3;
    return (this.bitset[byteIndex] & (1 << (position & 7))) !== 0;
  }
}
