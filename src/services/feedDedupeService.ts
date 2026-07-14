export const feedDedupeService = {
  keepUnique<T>(items: T[], getId: (item: T) => string) {
    const seenIds = new Set<string>();
    const unique: T[] = [];

    for (const item of items) {
      const id = getId(item);
      if (seenIds.has(id)) continue;

      seenIds.add(id);
      unique.push(item);
    }

    return unique;
  }
};
