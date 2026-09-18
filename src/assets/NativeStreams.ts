import type { NativeMesh } from '../construction/surfaces/schema.ts';
import type { NativePieceData } from './native-schema.ts';
import { invariant } from '../errors.ts';
import { NativeVertices } from './NativeVertices.ts';
import { quantizeNormalized } from './NativeQuantization.ts';

/** A kit piece shares attribute storage across its material primitives. */
export class NativeStreams extends NativeVertices {
  readonly counts: number[];
  readonly wearTolerance: number;
  readonly heightTolerance: number;
  constructor(piece: NativePieceData) {
    const combined: NativeMesh = { id: piece.id, surface: '', collision: true, ownerIds: [], groundIds: [], positions: [], normals: [], uvs: [], wear: [], heights: [] };
    const tolerances = { wear: Infinity, heights: Infinity };
    const ids = new Set<string>();
    for (const mesh of piece.meshes) {
      const count = mesh.positions.length / 3;
      if (!mesh.id || ids.has(mesh.id) || !count || !Number.isInteger(count / 3) || mesh.normals.length !== count * 3
        || mesh.uvs.length !== count * 2 || mesh.wear.length !== count || mesh.heights.length !== count)
        throw invariant('Native piece has invalid source attributes or identity', { meshId: mesh.id });
      ids.add(mesh.id);
      for (const field of ['positions', 'normals', 'uvs', 'wear', 'heights'] as const) for (const value of mesh[field]) {
        if (!Number.isFinite(value)) throw invariant('Native piece contains a nonfinite attribute', { meshId: mesh.id, field });
        combined[field].push(value);
      }
      for (const field of ['wear', 'heights'] as const) {
        let min = Infinity, max = -Infinity;
        for (const value of mesh[field]) { min = Math.min(min, Math.fround(value)); max = Math.max(max, Math.fround(value)); }
        tolerances[field] = Math.min(tolerances[field], (max - min) / 255);
      }
    }
    super(combined, piece.origin);
    this.counts = piece.meshes.map(m => m.wear.length);
    this.wearTolerance = tolerances.wear;
    this.heightTolerance = tolerances.heights;
  }
  fields() {
    return { wear: quantizeNormalized(this.wear, this.wearTolerance), heights: quantizeNormalized(this.heights, this.heightTolerance) };
  }
}
