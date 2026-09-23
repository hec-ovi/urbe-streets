import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2 } from 'three';

export type Point = [number, number, number];
type Uv = [number, number];

const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Point, b: Point): Point => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Point, b: Point): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const unit = (a: Point): Point => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };

/** Metre UVs by face orientation, as the source prisms map them. */
const metres = ([x, y, z]: Point, [nx, ny]: Point): Uv => Math.abs(ny) > 0.5 ? [x, z] : Math.abs(nx) > 0.5 ? [z, y] : [x, y];

/**
 * Authored hardware faces with explicit vertex normals. Every polygon is wound so its
 * geometric normal points to the given outward side; per-vertex normals, where given,
 * shade rounded edges. Output matches the source part format: position, normal, metre UV.
 */
export class Faces {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly uvs: number[] = [];

  /** A convex planar polygon. */
  polygon(points: Point[], outward: Point, normals?: (Point | undefined)[], uv?: Uv[]): this {
    return this.triangles(points, Array.from({ length: points.length - 2 }, (_, i) => [0, i + 1, i + 2]), outward, normals, uv);
  }

  /** A simple planar polygon with optional holes, triangulated on the two axes that span its plane. */
  shape(contour: Point[], holes: Point[][], outward: Point, axes: [number, number], uv?: (p: Point) => Uv): this {
    const flat = (points: Point[]) => points.map(p => new Vector2(p[axes[0]], p[axes[1]]));
    const points = [...contour, ...holes.flat()];
    const tris = ShapeUtils.triangulateShape(flat(contour), holes.map(flat)) as [number, number, number][];
    return this.triangles(points, tris, outward, undefined, uv ? points.map(uv) : undefined);
  }

  geometry(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2));
    geometry.setIndex(Array.from({ length: this.positions.length / 3 }, (_, i) => i));
    return geometry;
  }

  private triangles(points: Point[], tris: [number, number, number][], outward: Point, normals?: (Point | undefined)[], uv?: Uv[]): this {
    for (const tri of tris) {
      const [a, b, c] = tri.map(i => points[i]!) as [Point, Point, Point];
      const face = cross(sub(b, a), sub(c, a));
      const order = dot(face, outward) < 0 ? [tri[0], tri[2], tri[1]] : tri;
      const flat = unit(dot(face, outward) < 0 ? [-face[0], -face[1], -face[2]] : face);
      for (const i of order) {
        const p = points[i]!;
        this.positions.push(...p); this.normals.push(...(normals?.[i] ?? flat)); this.uvs.push(...(uv?.[i] ?? metres(p, flat)));
      }
    }
    return this;
  }
}
