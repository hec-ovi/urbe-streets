import type { NativePieceData } from '../../assets/native-schema.ts';
import type { Ring, Vec2 } from '../../geometry/schema.ts';
import { area, union } from '../../geometry/polygons.ts';
import { canonical } from './Frame.ts';

/** Project authored triangles, retaining holes and omitting vertical faces. */
export function pieceFootprint(piece: NativePieceData, collision = true): Ring[] {
  const rings: Ring[] = [];
  for (const mesh of piece.meshes.filter(m => !collision || m.collision)) for (let i = 0; i < mesh.positions.length; i += 9) {
    const ring = [0, 3, 6].map(k => [mesh.positions[i + k]!, mesh.positions[i + k + 2]!] as Vec2);
    const signed = area(ring);
    if (Math.abs(signed) > 1e-10) rings.push(signed < 0 ? ring.reverse() : ring);
  }
  return canonical(union(rings));
}
