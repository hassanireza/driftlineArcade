/**
 * LeaderboardStore
 *
 * A small generic OOP wrapper around localStorage that keeps a sorted,
 * length-capped list of score entries. Both Skyfold Aviary and Voidrunner
 * use their own instance with their own storage key and comparator, so
 * progress never collides between games.
 */
export class LeaderboardStore<T extends { score: number }> {
  private readonly storageKey: string;
  private readonly maxEntries: number;
  private readonly compare: (a: T, b: T) => number;
  private readonly normalize: (raw: unknown) => T | null;

  constructor(options: {
    storageKey: string;
    maxEntries?: number;
    compare: (a: T, b: T) => number;
    normalize: (raw: unknown) => T | null;
  }) {
    this.storageKey = options.storageKey;
    this.maxEntries = options.maxEntries ?? 10;
    this.compare = options.compare;
    this.normalize = options.normalize;
  }

  load(): T[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => this.normalize(item))
        .filter((item): item is T => item !== null)
        .sort(this.compare)
        .slice(0, this.maxEntries);
    } catch {
      return [];
    }
  }

  add(entry: T): T[] {
    const scores = this.load();
    scores.push(entry);
    scores.sort(this.compare);
    const trimmed = scores.slice(0, this.maxEntries);
    this.persist(trimmed);
    return trimmed;
  }

  clear(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      /* localStorage unavailable, nothing to clear */
    }
  }

  best(): number {
    const scores = this.load();
    return scores.length ? scores[0].score : 0;
  }

  private persist(scores: T[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(scores));
    } catch {
      /* Storage full or disabled; run continues without persistence */
    }
  }
}
