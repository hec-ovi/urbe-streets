import type { Box2 } from './schema.ts';

const KEY = 4_194_304;
const WIDE = 256;
const EPSILON = 1e-6;

/** Uniform grid over item boxes: a query returns every item that can touch it, in insertion order. */
export class BoxIndex<T> {
  private readonly cell: number;
  private readonly items: T[] = [];
  private readonly boxes: Box2[] = [];
  private readonly cells = new Map<number, number[]>();
  private readonly wide: number[] = [];

  constructor(items: readonly T[] = [], box?: (item: T) => Box2, cell = 64) {
    this.cell = cell;
    if (box) for (const item of items) this.add(item, box(item));
  }

  get all(): readonly T[] { return this.items; }

  add(item: T, box: Box2): void {
    const index = this.items.length;
    this.items.push(item); this.boxes.push(box);
    const [x0, z0, x1, z1] = this.span(box);
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > WIDE) { this.wide.push(index); return; }
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const key = x * KEY + z, bucket = this.cells.get(key);
      if (bucket) bucket.push(index); else this.cells.set(key, [index]);
    }
  }

  /** Candidates only: touching boxes stay in, so a clipper call sees everything that can change its result. */
  near(query: Box2): readonly T[] {
    const [x0, z0, x1, z1] = this.span(query);
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > WIDE) return this.items;
    const found = new Set(this.wide);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      for (const index of this.cells.get(x * KEY + z) ?? []) {
        const box = this.boxes[index]!;
        if (box.min[0] <= query.max[0] + EPSILON && box.max[0] >= query.min[0] - EPSILON
          && box.min[1] <= query.max[1] + EPSILON && box.max[1] >= query.min[1] - EPSILON) found.add(index);
      }
    }
    return [...found].sort((a, b) => a - b).map(index => this.items[index]!);
  }

  private span(box: Box2): [number, number, number, number] {
    return [Math.floor((box.min[0] - EPSILON) / this.cell), Math.floor((box.min[1] - EPSILON) / this.cell),
      Math.floor((box.max[0] + EPSILON) / this.cell), Math.floor((box.max[1] + EPSILON) / this.cell)];
  }
}
