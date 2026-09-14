import type { NativeFrontage } from '../../architecture/native-schema.ts';
import type { PanelRow } from '../style/schema.ts';
import type { SurfaceCut } from './schema.ts';
export interface PanelCell { start: number; depth: number; length: number; width: number; landing: boolean; finish: PanelRow['finish'] }

/** Original row iteration and complete two-metre inlet landing panels. */
export function* panelLayout(face: NativeFrontage, rows: PanelRow[], cuts: readonly SurfaceCut[]): Generator<PanelCell> {
  const landings = cuts.filter(cut => cut.kind === 'inlet' && cut.frontageId === face.id);
  for (const feature of landings) for (let start = feature.start; start < feature.end; start += 2)
    yield { start, depth: 0.5, length: 2, width: 1, landing: true, finish: 'base' };
  for (const { depth, length, width, finish } of rows)
    for (let start = Math.floor((-face.pavedWidth - 2) / length) * length; start < face.length + face.pavedWidth + 2; start += length) {
      const landing = landings.some(feature => start >= feature.start && start + length <= feature.end && depth + width <= 1.5);
      if (!landing) yield { start, depth, length, width, landing: false, finish };
    }
}
