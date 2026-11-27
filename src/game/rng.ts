export function hashSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function deriveSeed(seed: string, ...parts: Array<string | number>): string {
  return [seed, ...parts].join(":");
}

export function nextRandomState(state: number): {
  state: number;
  value: number;
} {
  let next = (state + 0x6d2b79f5) >>> 0;
  let value = next;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return {
    state: next,
    value: ((value ^ (value >>> 14)) >>> 0) / 0x100000000
  };
}

export class SeededRandom {
  state: number;

  constructor(seed: string | number) {
    this.state = typeof seed === "number" ? seed >>> 0 : hashSeed(seed);
  }

  next(): number {
    const result = nextRandomState(this.state);
    this.state = result.state;
    return result.value;
  }

  integer(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new Error(`Invalid integer range ${min}..${max}`);
    }
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(values: readonly T[]): T | null {
    if (values.length === 0) return null;
    return values[this.integer(0, values.length - 1)] ?? null;
  }

  sample<T>(values: readonly T[], count: number): T[] {
    const copy = [...values];
    for (let index = copy.length - 1; index > 0; index--) {
      const swap = this.integer(0, index);
      [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy.slice(0, Math.min(count, copy.length));
  }
}
