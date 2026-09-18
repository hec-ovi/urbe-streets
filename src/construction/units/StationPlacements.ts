import type { NativeArchitecture } from '../../architecture/native-schema.ts';
import type { StreetPlacement, StreetProfile } from '../../schema/street-kit.ts';
import type { Ring, Vec2 } from '../../geometry/schema.ts';
import { bounds, difference, intersection, rectangle, totalArea, union } from '../../geometry/polygons.ts';
import { UnitFrame, canonical, clean } from './Frame.ts';
import { KitCatalogue } from './KitCatalogue.ts';

/** Station aprons tile existing pedestrian profiles outside the road corridor. */
export function stationPlacements(a: NativeArchitecture, profiles: StreetProfile[]): StreetPlacement[] {
  const result: StreetPlacement[] = [];
  const profile = profiles.filter(p => p.streetClass === 'alley').reduce((x, y) => x.pavedWidth >= y.pavedWidth ? x : y);
  const width = profile.pavedWidth * 2;
  for (const owner of a.owners.filter(o => o.kind === 'station')) {
    const rings = union(owner.ground.map(g => g.ring));
    for (const ring of rings.filter(r => totalArea([r]) > 0)) {
      const box = bounds(ring), longX = box.max[0] - box.min[0] >= box.max[1] - box.min[1];
      const d: Vec2 = longX ? [1, 0] : [0, 1];
      const along = longX ? 0 : 1, across = longX ? 1 : 0;
      for (let lateral = box.min[across]; lateral < box.max[across] - 1e-7; lateral += width) {
        let station = box.min[along];
        while (station < box.max[along] - 1e-7) {
          const remaining = clean(box.max[along] - station), length = remaining >= 8 ? 8 : remaining >= 4 ? 4 : remaining >= 2 ? 2 : remaining;
          const canonicalLength = Math.max(2, length);
          const point: Vec2 = longX ? [station, lateral + width / 2] : [lateral + width / 2, station];
          const frame = new UnitFrame(point, d);
          const mask: Ring = rectangle(0, -width / 2, length, width).map(frame.world);
          const clip = canonical(difference(intersection([ring], [mask]), a.shafts.map(s => s.ring)).map(r => r.map(frame.local)));
          if (totalArea(clip) > 1e-9) result.push({ piece: KitCatalogue.segment(profile, canonicalLength, canonicalLength < 8 ? 'closure' : 'plain'),
            position: frame.position, rotationY: frame.rotationY, cell: [Math.floor(point[0] / 128), Math.floor(point[1] / 128)], ownerId: owner.id, ownerIds: [owner.id], clip,
            finishes: [{ finish: owner.finish ?? 'ordinary', clip }],
            ...(length < 2 ? { scale: [length / 2, 1, 1] as [number, number, number] } : {}) });
          station = clean(station + length);
        }
      }
    }
  }
  return result;
}
