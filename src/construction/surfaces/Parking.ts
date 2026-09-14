import { invariant } from '../../errors.ts';
import type { NativeOwner } from '../../architecture/native-schema.ts';
import type { Ring, Vec2 } from '../../geometry/schema.ts';
import { along, dot, sub } from './Frame.ts';
import { difference, intersection, totalArea } from './Regions.ts';
import { SurfaceBatch } from './SurfaceBatch.ts';

/** Original 3 by 2.5 metre parking panels with full-panel UVs and diagonal ends. */
export function parking(owner: NativeOwner, batch: SurfaceBatch): number {
  let panels = 0;
  for (const bay of owner.parking) {
    const face = owner.frontages.find(frontage => frontage.id === bay.frontageId);
    if (!face) throw invariant('Parking has no authored frontage', { parkingId: bay.id });
    const d: Vec2 = [face.inward[1], -face.inward[0]], intended: Ring[] = [];
    for (let station = bay.start; station < bay.end; station += 3) {
      const origin = along(face, station), tile = [origin, along(face, station + 3), along(face, station + 3, bay.depth), along(face, station, bay.depth)];
      intended.push(tile);
      const part = intersection([bay.footprint], [tile]);
      if (totalArea(part) <= 1e-12) continue;
      batch.polygon('parking', part, face.roadTop + 0.001,
        p => [dot(sub(p, origin), d) / 3, dot(sub(p, origin), face.inward) / bay.depth], true, true);
      panels++;
    }
    if (totalArea(difference([bay.footprint], intended)) > 1e-8) throw invariant('Native parking panels lose reserved coverage', { parkingId: bay.id });
  }
  return panels;
}
