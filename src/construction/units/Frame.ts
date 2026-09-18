import type { Ring, Vec2, Vec3 } from '../../geometry/schema.ts';
import { area } from '../../geometry/polygons.ts';

export const clean = (n: number): number => Math.round(n * 1e8) / 1e8;

/** Piece X follows the road; positive Y rotations follow the glTF convention. */
export class UnitFrame {
  readonly position: Vec3;
  readonly rotationY: number;
  readonly d: Vec2;
  constructor(origin: Vec2, d: Vec2 = [1, 0], top = 0) {
    this.position = [clean(origin[0]), top, clean(origin[1])];
    this.d = d;
    this.rotationY = -Math.atan2(d[1], d[0]) || 0;
  }
  local = (p: Vec2): Vec2 => {
    const x = p[0] - this.position[0], z = p[1] - this.position[2];
    return [clean(x * this.d[0] + z * this.d[1]), clean(-x * this.d[1] + z * this.d[0])];
  };
  world = (p: Vec2): Vec2 => [clean(this.position[0] + this.d[0] * p[0] - this.d[1] * p[1]), clean(this.position[2] + this.d[1] * p[0] + this.d[0] * p[1])];
  vector = (p: Vec2): Vec2 => [clean(p[0] * this.d[0] + p[1] * this.d[1]), clean(-p[0] * this.d[1] + p[1] * this.d[0])];
}

/** Boolean contours have a stable start, ordering and no redundant straight vertices. */
export function canonical(rings: Ring[]): Ring[] {
  return rings.map(ring => {
    const points = ring.map(p => [clean(p[0]), clean(p[1])] as Vec2);
    const reduced = points.filter((b, i) => {
      const a = points[(i + points.length - 1) % points.length]!, c = points[(i + 1) % points.length]!;
      return Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) > 1e-10;
    });
    if (reduced.length < 3 || Math.abs(area(reduced)) < 1e-10) return [];
    let first = 0;
    reduced.forEach((p, i) => { if (p[0] < reduced[first]![0] || p[0] === reduced[first]![0] && p[1] < reduced[first]![1]) first = i; });
    return [...reduced.slice(first), ...reduced.slice(0, first)];
  }).filter(r => r.length).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
}
