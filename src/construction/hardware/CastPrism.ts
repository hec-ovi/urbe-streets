import { ShapeUtils, Vector2, type BufferGeometry } from 'three';
import { loft } from './Loft.ts';

/** Seeded value in -1..1. */
const noise = (seed: number, a: number, b: number) => {
  const s = Math.sin(seed * 12.9898 + a * 78.233 + b * 37.719) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
};

/**
 * Cast concrete extrusion along X. Profile points are [z, y]. Faces wander by a few
 * millimetres, top edges carry seeded chips and both ends have worn top corners.
 * The lowest profile points stay on their base height.
 */
export function castPrism(
  profile: [number, number][],
  length: number,
  center: number,
  seed: number,
  chips: number,
): BufferGeometry {
  const points = profile.map(([z, y]) => new Vector2(z, y));
  if (ShapeUtils.isClockWise(points)) points.reverse();
  const count = points.length,
    top = Math.max(...points.map((p) => p.y)),
    base = Math.min(...points.map((p) => p.y));
  // Outward bisector per profile point (counterclockwise in z, y).
  const normals = points.map((p, i) => {
    const edge = (a: Vector2, b: Vector2) =>
      new Vector2(b.y - a.y, a.x - b.x).normalize();
    return edge(points[(i + count - 1) % count]!, p)
      .add(edge(p, points[(i + 1) % count]!))
      .normalize();
  });
  const edges = points.flatMap((p, i) => (p.y > top - 0.12 ? [i] : []));
  const slices = Math.max(2, Math.ceil(length / 0.2)),
    start = center - length / 2;
  const nicks = Array.from({ length: chips }, (_, c) => ({
    x: start + 0.1 + ((noise(seed, c, 1) + 1) / 2) * (length - 0.2),
    point: edges[Math.floor(((noise(seed, c, 2) + 1) / 2) * edges.length) % edges.length],
    radius: 0.06 + ((noise(seed, c, 3) + 1) / 2) * 0.1,
    depth: 0.01 + ((noise(seed, c, 4) + 1) / 2) * 0.02,
  }));
  const ring = (k: number) => {
    const x = start + (k * length) / slices;
    return points.map((p, i) => {
      let depth = noise(seed, k, i + 10) * 0.003;
      if (edges.includes(i)) {
        if (k === 0 || k === slices) depth -= 0.008 + (noise(seed, k, i + 20) + 1) * 0.008;
        for (const n of nicks) {
          const t = Math.abs(x - n.x) / n.radius;
          if (n.point === i && t < 1) depth -= n.depth * (1 - t * t);
        }
      }
      const z = p.x + normals[i]!.x * depth;
      return [x, p.y === base ? base : p.y + normals[i]!.y * depth, z] as [number, number, number];
    });
  };
  return loft(Array.from({ length: slices + 1 }, (_, k) => ring(k)));
}
