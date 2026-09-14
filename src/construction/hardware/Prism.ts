import {
  BufferGeometry,
  Float32BufferAttribute,
  ShapeUtils,
  Vector2,
} from 'three';

// A closed profile extrusion. Profile coordinates are horizontal distance and height.
export function prism(
  profile: [number, number][],
  length: number,
  axis: 'x' | 'z',
  center = 0,
): BufferGeometry {
  const points = profile.map(([a, b]) => new Vector2(a, b));
  if (ShapeUtils.isClockWise(points)) points.reverse();
  const positions: number[] = [];
  const vertex = (index: number, end: number) => {
    const { x: a, y: b } = points[index]!,
      t = center + (end * length) / 2;
    positions.push(...(axis === 'x' ? [t, b, a] : [a, b, t]));
  };
  const triangle = (indices: [number, number][]) => {
    for (const [index, end] of axis === 'x' ? indices : [...indices].reverse())
      vertex(index, end);
  };
  for (const [a, b, c] of ShapeUtils.triangulateShape(points, []) as [number, number, number][]) {
    triangle([
      [a, -1],
      [b, -1],
      [c, -1],
    ]);
    triangle([
      [a, 1],
      [c, 1],
      [b, 1],
    ]);
  }
  for (let a = 0; a < points.length; a++) {
    const b = (a + 1) % points.length;
    triangle([
      [a, -1],
      [a, 1],
      [b, 1],
    ]);
    triangle([
      [a, -1],
      [b, 1],
      [b, -1],
    ]);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(
    Array.from({ length: positions.length / 3 }, (_, index) => index),
  );
  geometry.computeVertexNormals();
  const normal = geometry.getAttribute('normal'),
    uv: number[] = [];
  for (let i = 0; i < positions.length / 3; i++) {
    const [x, y, z] = positions.slice(i * 3, i * 3 + 3) as [number, number, number];
    uv.push(
      ...(Math.abs(normal.getY(i)) > 0.5
        ? [x, z]
        : Math.abs(normal.getX(i)) > 0.5
          ? [z, y]
          : [x, y]),
    );
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return geometry;
}
