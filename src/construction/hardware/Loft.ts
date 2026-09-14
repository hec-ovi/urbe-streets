import {
  BufferGeometry,
  Float32BufferAttribute,
  ShapeUtils,
  Vector2,
} from 'three';

/**
 * Closed solid through profile rings at increasing X. Each ring lists [x, y, z] points
 * counterclockwise in (z, y). Every profile edge is its own strip, smooth along X and hard
 * at profile corners; both end rings are capped. UVs are metres.
 */
export function loft(rings: [number, number, number][][]): BufferGeometry {
  const count = rings[0]!.length,
    last = rings.length - 1;
  const positions: number[] = [],
    uv: number[] = [],
    index: number[] = [];
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count,
      [, yi, zi] = rings[0]![i]!,
      [, yj, zj] = rings[0]![j]!,
      flat = Math.abs(yj - yi) < Math.abs(zj - zi),
      offset = positions.length / 3;
    for (const ring of rings)
      for (const [x, y, z] of [ring[i]!, ring[j]!]) {
        positions.push(x, y, z);
        uv.push(x, flat ? z : y);
      }
    for (let k = 0; k < last; k++) {
      const a = offset + k * 2;
      index.push(a, a + 3, a + 1, a, a + 2, a + 3);
    }
  }
  for (const [k, flip] of [
    [0, false],
    [last, true],
  ] as const) {
    const cap = rings[k]!,
      offset = positions.length / 3;
    for (const [x, y, z] of cap) {
      positions.push(x, y, z);
      uv.push(z, y);
    }
    for (const [a, b, c] of ShapeUtils.triangulateShape(
      cap.map(([, y, z]) => new Vector2(z, y)),
      [],
    ) as [number, number, number][])
      index.push(offset + a, offset + (flip ? c : b), offset + (flip ? b : c));
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}
