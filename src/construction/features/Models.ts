import { invariant } from '../../errors.ts';
import type { Ring, Vec2 } from '../../geometry/schema.ts';
import { area, difference, totalArea, union } from '../../geometry/polygons.ts';
import { createHardware } from '../hardware/index.ts';
import type { FurnitureModel, FurnitureOptions } from '../hardware/schema.ts';
export interface Model { model: FurnitureModel; footprint: Ring }

/** Source prototypes are verified once, then reused without changing their geometry. */
export class Models {
  private readonly entries = new Map<string, Model>();
  get(options: FurnitureOptions): Model {
    const key = JSON.stringify(options), cached = this.entries.get(key); if (cached) return cached;
    const model = createHardware(options), min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const part of model.parts) {
      const positions = part.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) for (const [axis, value] of [positions.getX(i), positions.getY(i), positions.getZ(i)].entries()) {
        min[axis] = Math.min(min[axis]!, value); max[axis] = Math.max(max[axis]!, value);
      }
    }
    const footprint: Ring = (options.kind === 'guard' || options.kind === 'access') ? [[min[0]!, min[2]!], [max[0]!, min[2]!], [max[0]!, max[2]!], [min[0]!, max[2]!]]
      : [[-options.length / 2, 0], [options.length / 2, 0], [options.length / 2, options.depth], [-options.length / 2, options.depth]];
    if (options.kind === 'inlet' || options.kind === 'channel') {
      const projected: Ring[] = [];
      for (const part of model.parts) {
        const positions = part.geometry.getAttribute('position'), count = part.geometry.index?.count ?? positions.count;
        for (let i = 0; i < count; i += 3) {
          const points: Vec2[] = [0, 1, 2].map(offset => { const v = part.geometry.index?.getX(i + offset) ?? i + offset; return [positions.getX(v), positions.getZ(v)]; });
          if (area(points) < -1e-14) projected.push(points.reverse());
        }
      }
      const missing = totalArea(difference([footprint], union(projected)));
      if (missing > 1e-7) { model.dispose(); throw invariant('Source hardware does not close its receiving footprint', { options, missing }); }
    }
    const value = { model, footprint };
    this.entries.set(key, value); return value;
  }
  dispose(): void { this.entries.forEach(entry => entry.model.dispose()); this.entries.clear(); }
}
