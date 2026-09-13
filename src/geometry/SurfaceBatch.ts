import earcut from 'earcut';
import { invariant } from '../errors.ts';
import { area } from './polygons.ts';
import type { MeshData, Ring, Vec2, Vec3 } from './schema.ts';

/** District SurfaceBatch and furniture Prism extrusion, without renderer state. */
export class SurfaceBatch {
  private positions: number[] = [];
  private normals: number[] = [];
  private uvs: number[] = [];

  private triangle(vertices: Vec3[], uv: Vec2[]): void {
    const [a, b, c] = vertices as [Vec3, Vec3, Vec3];
    const u = b.map((v, i) => v - a[i]!) as number[];
    const v = c.map((n, i) => n - a[i]!) as number[];
    const n = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
    const length = Math.hypot(...n);
    if (!(length > 0)) throw invariant('Degenerate generated triangle');
    vertices.forEach((p, i) => { this.positions.push(...p); this.normals.push(...n.map(x => x / length)); this.uvs.push(...uv[i]!); });
  }

  prism(ring: Ring, bottom: number, top: number, map: (p: Vec3, normal: Vec3) => Vec2, id: string): void {
    const indices = earcut(ring.flat());
    let trianglesArea = 0;
    for (let i = 0; i < indices.length; i += 3) {
      const p = [ring[indices[i]!]!, ring[indices[i + 1]!]!, ring[indices[i + 2]!]!] as Vec2[];
      trianglesArea += Math.abs(area(p));
      const upper = [p[0]!, p[2]!, p[1]!].map(([x, z]) => [x, top, z] as Vec3);
      this.triangle(upper, upper.map(v => map(v, [0, 1, 0])));
      if (bottom !== top) {
        const lower = p.map(([x, z]) => [x, bottom, z] as Vec3);
        this.triangle(lower, lower.map(v => map(v, [0, 1, 0])));
      }
    }
    if (Math.abs(trianglesArea - area(ring)) > 1e-8 * Math.max(1, trianglesArea))
      throw invariant('Triangulation did not cover its source', { id });
    if (bottom === top) return;
    ring.forEach(([x, z], i) => {
      const [nx, nz] = ring[(i + 1) % ring.length]!;
      const a: Vec3 = [x, bottom, z], b: Vec3 = [nx, bottom, nz];
      const c: Vec3 = [nx, top, nz], d: Vec3 = [x, top, z];
      for (const face of [[a, d, c], [a, c, b]]) this.triangle(face, face.map(v => map(v, [nz - z, 0, x - nx])));
    });
  }

  finish(): MeshData {
    return { positions: new Float32Array(this.positions), normals: new Float32Array(this.normals), uvs: new Float32Array(this.uvs) };
  }
}
