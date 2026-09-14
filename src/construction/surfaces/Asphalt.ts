import type { NativeOwner } from '../../architecture/native-schema.ts';
import type { Ring } from '../../geometry/schema.ts';
import { bounds, rectangle } from '../../geometry/polygons.ts';
import { difference, intersection, totalArea } from './Regions.ts';
import { SurfaceBatch } from './SurfaceBatch.ts';

/** Shared world-grid sampling resolves the source wear field before asset clipping. */
export function asphalt(owner: NativeOwner, batch: SurfaceBatch, shafts: readonly Ring[]): void {
  for (const field of owner.ground.filter(field => field.surface === 'roadway')) {
    const domain = difference([field.ring], [...shafts, ...owner.parking.map(bay => bay.footprint)]);
    if (!domain.length) continue;
    const box = bounds(domain.flat()), pitch = 16;
    for (let x = Math.floor(box.min[0] / pitch); x < Math.ceil(box.max[0] / pitch); x++)
      for (let z = Math.floor(box.min[1] / pitch); z < Math.ceil(box.max[1] / pitch); z++) {
        const part = intersection(domain, [rectangle(x * pitch, z * pitch, pitch, pitch)]);
        if (totalArea(part) > 1e-12) batch.polygon('asphalt', part, field.top, p => [p[0] / 2, p[1] / 2], true, true);
      }
  }
}
