import { differenceD, intersectD, unionD, FillRule, type PathsD } from 'clipper2-ts';
import type { Ring, Box2 } from './schema.ts';

export function area(p: Ring): number {
  const [ox, oz] = p[0]!;
  return p.reduce((sum, [x, z], i) => {
    const q = p[(i + 1) % p.length]!;
    return sum + (x - ox) * (q[1] - oz) - (q[0] - ox) * (z - oz);
  }, 0) / 2;
}
export function bounds(p: Ring): Box2 {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const [x, z] of p) { minX = Math.min(minX, x); minZ = Math.min(minZ, z); maxX = Math.max(maxX, x); maxZ = Math.max(maxZ, z); }
  return { min: [minX, minZ], max: [maxX, maxZ] };
}
export const intersects = (a: Box2, b: Box2): boolean =>
  a.min[0] < b.max[0] && a.max[0] > b.min[0] && a.min[1] < b.max[1] && a.max[1] > b.min[1];
export const rectangle = (x: number, z: number, w: number, h: number): Ring => [[x, z], [x + w, z], [x + w, z + h], [x, z + h]];
const paths = (rings: readonly Ring[]): PathsD => rings.map(r => r.map(([x, y]) => ({ x, y })));
const rings = (p: PathsD): Ring[] => p.map(r => r.map(({ x, y }) => [x, y] as const));
// Precision applies only to boolean calculations, never to retained source vertices.
export const intersection = (a: readonly Ring[], b: readonly Ring[]): Ring[] => rings(intersectD(paths(a), paths(b), FillRule.NonZero, 8));
export const difference = (a: readonly Ring[], b: readonly Ring[]): Ring[] => rings(differenceD(paths(a), paths(b), FillRule.NonZero, 8));
export const union = (a: readonly Ring[]): Ring[] => rings(unionD(paths(a), [], FillRule.NonZero, 8));
export const totalArea = (a: readonly Ring[]): number => a.reduce((sum, r) => sum + area(r), 0);
