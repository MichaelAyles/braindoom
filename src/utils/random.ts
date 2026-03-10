// Mulberry32 seeded PRNG
export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Uniform float in [min, max)
  uniform(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  // Random integer in [min, max] inclusive
  int(min: number, max: number): number {
    return Math.floor(this.uniform(min, max + 1));
  }
}
