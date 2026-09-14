import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';

const Z = new Vector3(0, 0, 1),
  Y = new Vector3(0, 1, 0);

/** Octagonal tube along a polyline; its frame is carried point to point so the section never twists or collapses. */
export function tube(points: number[][], radius: number, closed = false): BufferGeometry {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const path = points.map(p => new Vector3(...p));
  const n = new Vector3(), b = new Vector3(), previous = new Vector3(), axis = new Vector3();
  let length = 0;
  for (let i = 0; i < path.length; i++) {
    if (i) length += path[i]!.distanceTo(path[i - 1]!);
    const before = path[i ? i - 1 : closed ? path.length - 1 : 0]!;
    const after = path[i + 1 < path.length ? i + 1 : closed ? 0 : i]!;
    const tangent = after.clone().sub(before).normalize();
    if (!i) {
      n.crossVectors(Z, tangent);
      if (n.lengthSq() < 1e-6) n.crossVectors(Y, tangent);
      n.normalize();
    } else {
      axis.crossVectors(previous, tangent);
      const sin = axis.length();
      if (sin > 1e-9) n.applyAxisAngle(axis.divideScalar(sin), Math.atan2(sin, previous.dot(tangent)));
    }
    previous.copy(tangent);
    b.crossVectors(tangent, n).normalize();
    for (let j = 0; j < 8; j++) {
      const angle = j * Math.PI / 4;
      const p = path[i]!.clone().addScaledVector(n, Math.cos(angle) * radius).addScaledVector(b, Math.sin(angle) * radius);
      positions.push(...p.toArray()); uv.push(length, j / 8 * Math.PI * radius * 2);
      if (i || closed) {
        const prev = (i + path.length - 1) % path.length * 8;
        const a = i * 8 + j, c = i * 8 + (j + 1) % 8, d = prev + (j + 1) % 8, e = prev + j;
        indices.push(a, e, c, c, e, d);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}
