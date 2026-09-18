import type { NativeMesh } from '../surfaces/schema.ts';
import type { Box2 } from '../../geometry/schema.ts';
import { invariant } from '../../errors.ts';

type Vertex = number[];
function halfPlane(polygon: Vertex[], axis: number, limit: number, sign: number): Vertex[] {
  const output: Vertex[] = [];
  for (const [i, p] of polygon.entries()) {
    const q = polygon[(i + 1) % polygon.length]!, a = sign * (p[axis]! - limit), b = sign * (q[axis]! - limit);
    if (a >= 0) output.push(p);
    if (a < 0 && b > 0 || a > 0 && b < 0) {
      const fraction = a / (a - b), v = p.map((value, j) => value + fraction * (q[j]! - value));
      v[axis] = limit; output.push(v);
    }
  }
  return output;
}

/** Unit seams clip source opening end faces without creating extra end walls. */
export function unitBounds(mesh: NativeMesh, box: Box2): NativeMesh {
  const result: NativeMesh = { ...mesh, positions: [], normals: [], uvs: [], wear: [], heights: [] };
  for (let i = 0; i < mesh.wear.length; i += 3) {
    let polygon = [0, 1, 2].map(k => {
      const v = i + k;
      return [...mesh.positions.slice(v * 3, v * 3 + 3), ...mesh.normals.slice(v * 3, v * 3 + 3), ...mesh.uvs.slice(v * 2, v * 2 + 2), mesh.wear[v]!, mesh.heights[v]!];
    });
    for (const [axis, limit, sign] of [[0, box.min[0], 1], [0, box.max[0], -1], [2, box.min[1], 1], [2, box.max[1], -1]]) polygon = halfPlane(polygon, axis!, limit!, sign!);
    for (let k = 1; k < polygon.length - 1; k++) {
      const a = polygon[0]!, b = polygon[k]!, c = polygon[k + 1]!;
      const u = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!], v = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!];
      if (Math.hypot(u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!) < 1e-16) continue;
      for (const vertex of [a, b, c]) {
        const length = Math.hypot(vertex[3]!, vertex[4]!, vertex[5]!);
        if (!length) throw invariant('Unit seam has a zero surface normal', { meshId: mesh.id });
        result.positions.push(...vertex.slice(0, 3)); result.normals.push(vertex[3]! / length, vertex[4]! / length, vertex[5]! / length);
        result.uvs.push(vertex[6]!, vertex[7]!); result.wear.push(vertex[8]!); result.heights.push(vertex[9]!);
      }
    }
  }
  return result;
}
