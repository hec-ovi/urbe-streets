import type { NativeArchitecture } from '../../architecture/native-schema.ts';
import type { StreetPlacement, StreetProfile } from '../../schema/street-kit.ts';
import type { Ring, Vec2 } from '../../geometry/schema.ts';
import { bounds, difference, intersection, rectangle, totalArea, union } from '../../geometry/polygons.ts';
import { UnitFrame, clean } from './Frame.ts';
import { KitCatalogue } from './KitCatalogue.ts';
import { placement } from './UnitOverlays.ts';

/** Apron rectangles fit complete pedestrian pieces around the reserved shafts. */
export function stationPlacements(a: NativeArchitecture, profiles: StreetProfile[]): StreetPlacement[] {
  const result: StreetPlacement[] = [];
  for (const owner of a.owners.filter(o => o.kind === 'station')) {
    const zone = owner.finish?.startsWith('luxury') ? 'luxury' : owner.finish?.startsWith('industrial') ? 'industrial' : 'ordinary';
    const profile = profiles.find(p => p.streetClass === 'alley' && p.zone === zone)!, width = profile.pavedWidth * 2;
    const rings = difference(union(owner.ground.map(g => g.ring)), a.shafts.map(s => s.ring));
    for (const ring of rectangles(rings)) {
      const box = bounds(ring), longX = box.max[0] - box.min[0] >= box.max[1] - box.min[1];
      const d: Vec2 = longX ? [1, 0] : [0, 1], along = longX ? 0 : 1, across = longX ? 1 : 0;
      for (let lateral = box.min[across]; lateral < box.max[across] - 1e-7; lateral += width) {
        const breadth = Math.min(width, box.max[across] - lateral);
        let station = box.min[along];
        while (station < box.max[along] - 1e-7) {
          const remaining = clean(box.max[along] - station), length = remaining >= 8 ? 8 : remaining >= 4 ? 4 : remaining >= 2 ? 2 : remaining;
          const canonicalLength = Math.max(2, length);
          const point: Vec2 = longX ? [station, lateral + breadth / 2] : [lateral + breadth / 2, station];
          const p = placement(KitCatalogue.segment(profile, canonicalLength, canonicalLength < 8 ? 'closure' : 'plain'), new UnitFrame(point, d), [owner.id]);
          if (length < 2 || breadth < width) p.scale = [length / canonicalLength, 1, breadth / width];
          result.push(p); station = clean(station + length);
        }
      }
    }
  }
  return result;
}

function rectangles(rings: Ring[]): Ring[] {
  const box = bounds(rings.flat()), xs = [...new Set(rings.flat().map(p => p[0]))].sort((a, b) => a - b);
  const result: Ring[] = [];
  for (let i = 1; i < xs.length; i++) {
    const x = xs[i - 1]!, width = xs[i]! - x;
    for (const ring of intersection(rings, [rectangle(x, box.min[1], width, box.max[1] - box.min[1])])) {
      const b = bounds(ring), candidate = rectangle(x, b.min[1], width, b.max[1] - b.min[1]);
      if (totalArea(difference([candidate], rings)) > 1e-7) continue;
      result.push(candidate);
    }
  }
  return result;
}
