import type { Ring, Vec2 } from '../../geometry/schema.ts';
export interface BoundarySegment { a: Vec2; b: Vec2; length: number; d: Vec2; n: Vec2 }
const size = 16;
export const segment = (a: Vec2, b: Vec2): BoundarySegment => {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const d: Vec2 = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
  return { a, b, length, d, n: [-d[1], d[0]] };
};

/** Indexes authored boundaries for exact role contacts and transverse gutter coordinates. */
export class BoundaryIndex {
  readonly segments: BoundarySegment[] = [];
  private readonly bins = new Map<string, number[]>();
  constructor(rings: readonly Ring[]) {
    for (const ring of rings) ring.forEach((a, i) => {
      const value = segment(a, ring[(i + 1) % ring.length]!);
      if (value.length === 0) return;
      const index = this.segments.push(value) - 1;
      for (const key of this.cells(a, value.b)) { const list = this.bins.get(key) ?? []; list.push(index); this.bins.set(key, list); }
    });
  }
  near(a: Vec2, b = a): BoundarySegment[] {
    const ids = new Set<number>();
    for (const key of this.cells([Math.min(a[0], b[0]) - 1e-7, Math.min(a[1], b[1]) - 1e-7],
      [Math.max(a[0], b[0]) + 1e-7, Math.max(a[1], b[1]) + 1e-7])) for (const id of this.bins.get(key) ?? []) ids.add(id);
    return [...ids].map(id => this.segments[id]!);
  }
  distance(p: Vec2): number {
    let nearest = Infinity;
    for (const edge of this.near([p[0] - 1, p[1] - 1], [p[0] + 1, p[1] + 1])) {
      const t = Math.max(0, Math.min(edge.length, (p[0] - edge.a[0]) * edge.d[0] + (p[1] - edge.a[1]) * edge.d[1]));
      nearest = Math.min(nearest, Math.hypot(p[0] - edge.a[0] - edge.d[0] * t, p[1] - edge.a[1] - edge.d[1] * t));
    }
    return nearest;
  }
  contacts(ring: Ring): BoundarySegment[] {
    const result: BoundarySegment[] = [];
    ring.forEach((a, i) => {
      const edge = segment(a, ring[(i + 1) % ring.length]!);
      for (const other of this.near(edge.a, edge.b)) {
        const across = (p: Vec2) => (p[0] - a[0]) * edge.n[0] + (p[1] - a[1]) * edge.n[1];
        if (Math.abs(across(other.a)) > 1e-7 || Math.abs(across(other.b)) > 1e-7) continue;
        const along = (p: Vec2) => (p[0] - a[0]) * edge.d[0] + (p[1] - a[1]) * edge.d[1];
        const t0 = along(other.a), t1 = along(other.b), lo = Math.max(0, Math.min(t0, t1)), hi = Math.min(edge.length, Math.max(t0, t1));
        if (hi - lo <= 1e-7) continue;
        const at = (t: number): Vec2 => t === 0 ? edge.a : t === edge.length ? edge.b : [a[0] + edge.d[0] * t, a[1] + edge.d[1] * t];
        result.push(segment(at(lo), at(hi)));
      }
    });
    return result;
  }
  private *cells(a: Vec2, b: Vec2): Generator<string> {
    for (let x = Math.floor(Math.min(a[0], b[0]) / size); x <= Math.floor(Math.max(a[0], b[0]) / size); x++)
      for (let z = Math.floor(Math.min(a[1], b[1]) / size); z <= Math.floor(Math.max(a[1], b[1]) / size); z++) yield `${x}:${z}`;
  }
}
