declare const process: {
  env: Record<string, string | undefined>;
};

declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;
declare function expect<T>(actual: T): {
  toBe(expected: T): void;
};
