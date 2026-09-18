import { createHash } from 'node:crypto';
import type { NativePieceData } from '../../assets/native-schema.ts';

/** Ordering of equivalent source triangles does not create a second prototype. */
export function pieceIdentity(piece: NativePieceData): string {
  const hash = createHash('sha256');
  for (const mesh of piece.meshes) {
    hash.update(`${mesh.surface}:${mesh.collision}`);
    const triangles: string[] = [];
    for (let i = 0; i < mesh.wear.length; i += 3) {
      const vertices = [0, 1, 2].map(k => {
        const j = i + k;
        return [...mesh.positions.slice(j * 3, j * 3 + 3), ...mesh.normals.slice(j * 3, j * 3 + 3),
          ...mesh.uvs.slice(j * 2, j * 2 + 2), mesh.wear[j]!, mesh.heights[j]!].map(n => Math.fround(n)).join(',');
      });
      triangles.push([0, 1, 2].map(k => [...vertices.slice(k), ...vertices.slice(0, k)].join(';')).sort()[0]!);
    }
    hash.update(triangles.sort().join('|'));
  }
  return hash.digest('hex');
}
