import type { NativeMesh } from '../construction/surfaces/schema.ts';
import type { Vec3 } from '../geometry/schema.ts';

/** Shares only complete, equal vertices in the existing Float32 export domain. */
export class NativeVertices {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly wear: Float32Array;
  readonly heights: Float32Array;
  readonly indices: Uint16Array | Uint32Array;

  constructor(source: NativeMesh, origin: Vec3) {
    const positions: number[] = [], normals: number[] = [], uvs: number[] = [], wear: number[] = [], heights: number[] = [];
    const indices: number[] = [], known = new Map<string, number>();
    for (let i = 0; i < source.wear.length; i++) {
      const p = [0, 1, 2].map(axis => Math.fround(source.positions[i * 3 + axis]! - origin[axis]!));
      const n = [0, 1, 2].map(axis => Math.fround(source.normals[i * 3 + axis]!));
      const uv = [Math.fround(source.uvs[i * 2]!), Math.fround(source.uvs[i * 2 + 1]!)];
      const w = Math.fround(source.wear[i]!), h = Math.fround(source.heights[i]!);
      const key = [...p, ...n, ...uv, w, h].join(',');
      let index = known.get(key);
      if (index === undefined) {
        index = wear.length;
        known.set(key, index);
        positions.push(...p); normals.push(...n); uvs.push(...uv); wear.push(w); heights.push(h);
      }
      indices.push(index);
    }
    this.positions = new Float32Array(positions);
    this.normals = new Float32Array(normals);
    this.uvs = new Float32Array(uvs);
    this.wear = new Float32Array(wear);
    this.heights = new Float32Array(heights);
    // The all-ones index is reserved by glTF.
    this.indices = wear.length <= 65535 ? new Uint16Array(indices) : new Uint32Array(indices);
  }
}
