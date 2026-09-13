import { area, bounds, intersection, rectangle } from '../geometry/polygons.ts';
import type { ConstructionSurface } from '../architecture/schema.ts';
import type { Ring } from '../geometry/schema.ts';

export const PIECE_SIZE = 128;
export interface PiecePart { source: ConstructionSurface; polygon: Ring }
/** Clip actual geometry at the cell boundary, retaining the original UV frame. */
export function partitionPieces(surfaces: ConstructionSurface[]): Map<string, PiecePart[]> {
  const pieces = new Map<string, PiecePart[]>();
  for (const source of surfaces) {
    const box = bounds(source.polygon);
    for (let x = Math.floor(box.min[0] / PIECE_SIZE); x < Math.ceil(box.max[0] / PIECE_SIZE); x++)
      for (let z = Math.floor(box.min[1] / PIECE_SIZE); z < Math.ceil(box.max[1] / PIECE_SIZE); z++) {
        const id = `sp:${x}:${z}`, list = pieces.get(id) ?? [];
        const cell = rectangle(x * PIECE_SIZE, z * PIECE_SIZE, PIECE_SIZE, PIECE_SIZE);
        const contained = box.min[0] >= x * PIECE_SIZE && box.max[0] <= (x + 1) * PIECE_SIZE && box.min[1] >= z * PIECE_SIZE && box.max[1] <= (z + 1) * PIECE_SIZE;
        for (const polygon of contained ? [source.polygon] : intersection([source.polygon], [cell])) {
          if (area(polygon) <= 0) continue;
          list.push({ source, polygon });
        }
        if (list.length) pieces.set(id, list);
      }
  }
  return new Map([...pieces].sort(([a], [b]) => a.localeCompare(b, 'en')));
}
