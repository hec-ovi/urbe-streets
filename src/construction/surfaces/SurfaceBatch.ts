import type { BufferGeometry } from 'three';
import { invariant } from '../../errors.ts';
import type { Ring, Vec2, Vec3 } from '../../geometry/schema.ts';
import { triangles } from './Regions.ts';
import type { GeometryPlacement, HeightMap, NativeMesh, SurfaceContext, SurfaceOutput, UvMap } from './schema.ts';

/** Source surface batching with explicit collision and source ownership, before Float32 export. */
export class SurfaceBatch {
  private readonly meshes = new Map<string, NativeMesh>();
  private readonly coverage: SurfaceOutput['coverage'] = [];
  private readonly context: SurfaceContext;
  constructor(context: SurfaceContext) {
    this.context = context;
    if (!context.ownerId || !context.groundIds.length || context.groundIds.some(id => !id)
      || !Number.isFinite(context.roadTop) || typeof context.wear !== 'function') throw invariant('Native surfaces require an explicit source context');
  }

  polygon(surface: string, rings: readonly Ring[], height: HeightMap, uv: UvMap, collision = true, covers = false): void {
    if (covers && !collision) throw invariant('Noncolliding paint cannot claim receiving ground');
    const data = this.data(surface, collision);
    for (const tri of triangles(rings)) {
      const points = [tri[0]!, tri[2]!, tri[1]!];
      const vertices = points.map(p => [p[0], typeof height === 'number' ? height : height(p), p[1]] as Vec3);
      this.triangle(data, vertices, points.map(uv));
    }
    if (covers && rings.length) this.coverage.push({ ownerId: this.context.ownerId, rings: rings.map(ring => ring.map(p => [p[0], p[1]] as Vec2)) });
  }

  face(surface: string, vertices: Vec3[], uv: Vec2[], collision = true): void {
    const data = this.data(surface, collision);
    for (let i = 1; i < vertices.length - 1; i++) this.triangle(data, [vertices[0]!, vertices[i]!, vertices[i + 1]!], [uv[0]!, uv[i]!, uv[i + 1]!]);
  }

  geometry(surface: string, geometry: BufferGeometry, placement: GeometryPlacement, collision = true): void {
    const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv');
    if (!positions || !normals || !uv || positions.count !== normals.count || positions.count !== uv.count) throw invariant('Native hardware has incomplete attributes');
    const data = this.data(surface, collision), { origin, inward } = placement, d: Vec2 = [inward[1], -inward[0]];
    const count = geometry.index?.count ?? positions.count;
    if (count % 3) throw invariant('Native hardware is not triangulated');
    for (let i = 0; i < count; i++) {
      const v = geometry.index?.getX(i) ?? i;
      const x = positions.getX(v), y = positions.getY(v), z = positions.getZ(v);
      const p: Vec3 = [origin[0] + d[0] * x + inward[0] * z, origin[1] + y, origin[2] + d[1] * x + inward[1] * z];
      const nx = normals.getX(v), ny = normals.getY(v), nz = normals.getZ(v);
      data.positions.push(...p); data.normals.push(d[0] * nx + inward[0] * nz, ny, d[1] * nx + inward[1] * nz);
      data.uvs.push(uv.getX(v), uv.getY(v)); data.wear.push(this.context.wear([p[0], p[2]])); data.heights.push(y);
    }
  }

  finish(): SurfaceOutput { return { meshes: [...this.meshes.values()].filter(mesh => mesh.positions.length), coverage: this.coverage }; }

  private data(surface: string, collision: boolean): NativeMesh {
    const key = `${surface}:${collision}`;
    let data = this.meshes.get(key);
    if (!data) {
      data = { id: `${this.context.ownerId}:${key}`, surface, collision, ownerIds: [this.context.ownerId], groundIds: [...this.context.groundIds],
        positions: [], normals: [], uvs: [], wear: [], heights: [] }; this.meshes.set(key, data);
    }
    return data;
  }

  private triangle(data: NativeMesh, points: Vec3[], uvs: Vec2[]): void {
    const [a, b, c] = points as [Vec3, Vec3, Vec3];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const normal = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
    const length = Math.hypot(...normal);
    if (!Number.isFinite(length) || length === 0) throw invariant('Native surface has a degenerate triangle', { id: data.id });
    for (const [i, p] of points.entries()) {
      if (!uvs[i]?.every(Number.isFinite)) throw invariant('Native surface has invalid UVs', { id: data.id });
      data.positions.push(...p); data.normals.push(...normal.map(n => n / length)); data.uvs.push(...uvs[i]!);
      data.wear.push(this.context.wear([p[0], p[2]])); data.heights.push(p[1] - this.context.roadTop);
    }
  }
}
