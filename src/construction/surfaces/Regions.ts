import earcut from 'earcut';
import { invariant } from '../../errors.ts';
import { area, bounds, intersection, difference, union, totalArea } from '../../geometry/polygons.ts';
import type { Ring, Vec2 } from '../../geometry/schema.ts';
export { area, bounds, intersection, difference, union, totalArea };

export function contains(ring: Ring, point: Vec2): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!, b = ring[j]!;
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Preserve signed contours and attach each hole to its containing outer contour. */
export function triangles(rings: readonly Ring[]): Vec2[][] {
  const outers = rings.filter(ring => area(ring) > 0).map(ring => ({ ring, holes: [] as Ring[] }));
  for (const hole of rings.filter(ring => area(ring) < 0)) {
    const parent = outers.filter(outer => contains(outer.ring, hole[0]!)).sort((a, b) => area(a.ring) - area(b.ring))[0];
    if (!parent) throw invariant('A surface hole has no outer owner');
    parent.holes.push(hole);
  }
  const result: Vec2[][] = [];
  for (const outer of outers) {
    const points = [...outer.ring], holes: number[] = [];
    for (const hole of outer.holes) { holes.push(points.length); points.push(...hole); }
    const indices = earcut(points.flat(), holes);
    for (let i = 0; i < indices.length; i += 3) {
      const tri = [points[indices[i]!]!, points[indices[i + 1]!]!, points[indices[i + 2]!]!];
      result.push(area(tri) < 0 ? tri.reverse() : tri);
    }
  }
  const expected = totalArea(rings), actual = result.reduce((sum, tri) => sum + area(tri), 0);
  if (Math.abs(actual - expected) > 1e-8 * Math.max(1, expected)) throw invariant('Surface triangulation loses reserved coverage', { expected, actual });
  return result;
}

/** Source half-plane fitting for convex panel and corner pieces. */
export function clip(ring: Ring, a: Vec2, b: Vec2, inset = 0): Ring {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (!length) throw invariant('Surface clipping needs a directed line');
  const signed = (p: Vec2) => ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / length - inset;
  const result: Vec2[] = [];
  ring.forEach((p, i) => {
    const q = ring[(i + 1) % ring.length]!, x = signed(p), y = signed(q);
    if (x >= 0) result.push(p);
    if ((x > 0 && y < 0) || (x < 0 && y > 0)) { const t = x / (x - y); result.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  });
  return result.length >= 3 ? result : [];
}
export function inset(ring: Ring, width: number): Ring {
  let result = ring;
  for (let i = 0; i < ring.length && result.length; i++) result = clip(result, ring[i]!, ring[(i + 1) % ring.length]!, width);
  return result;
}
