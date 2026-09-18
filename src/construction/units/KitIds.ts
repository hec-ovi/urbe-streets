import type { StreetPlacement } from '../../schema/street-kit.ts';
import type { AuthoredUnit } from './StreetUnits.ts';

/** Content order gives each bundle compact, deterministic family inventories. */
export function nameKit(pieces: AuthoredUnit[], placements: StreetPlacement[]): void {
  pieces.sort((a, b) => a.metadata.id.localeCompare(b.metadata.id, 'en'));
  const counters = new Map<string, number>(), names = new Map<string, string>();
  for (const piece of pieces) {
    const p = piece.metadata;
    const family = p.kind === 'segment' ? `${p.classes[0]}/${p.zone}`
      : p.kind === 'prop' ? `prop/${p.variant}` : p.kind === 'marking' ? `marking/${p.variant}`
        : `junction/${p.classes.join('+')}/${p.zone}/${p.kind === 'junction-arm' ? 'arm' : 'center'}`;
    const count = (counters.get(family) ?? 0) + 1, id = `${family}/${String(count).padStart(3, '0')}`;
    counters.set(family, count); names.set(p.id, id); p.id = id; piece.geometry.id = id;
  }
  for (const placement of placements) placement.piece = names.get(placement.piece)!;
}
