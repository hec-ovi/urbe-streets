import { invalidParams } from '../../errors.ts';
import type { Vec2 } from '../../geometry/schema.ts';
import type { WearOptions, WearSnapshot } from './schema.ts';
import { random } from './random.ts';

/** Original district zone construction and smooth maximum field, in the city's authored frame. */
export class WearField {
  private readonly state: WearSnapshot;
  constructor(options: WearOptions) {
    if (!Number.isSafeInteger(options.seed) || !Number.isInteger(options.streets) || options.streets < 1
      || !Number.isFinite(options.amount) || options.amount < 0 || options.amount > 1
      || ![...options.bounds.min, ...options.bounds.max].every(Number.isFinite)
      || options.bounds.min.some((n, axis) => n >= options.bounds.max[axis]!)) throw invalidParams('Invalid native wear field');
    const { seed, bounds } = options, width = bounds.max[0] - bounds.min[0], depth = bounds.max[1] - bounds.min[1];
    this.state = { ...structuredClone(options), version: 'source-zones-1.0.0',
      zones: Array.from({ length: Math.max(2, Math.ceil(options.streets / 6)) }, (_, i) => ({
        center: [bounds.min[0] + width * random(seed, `zone:${i}:x`), bounds.min[1] + depth * random(seed, `zone:${i}:z`)],
        radius: 80 + random(seed, `zone:${i}:radius`) * 90, strength: 0.65 + random(seed, `zone:${i}:strength`) * 0.35,
      })) };
  }
  sample(point: Vec2): number {
    if (!point.every(Number.isFinite)) throw invalidParams('Wear samples require finite world coordinates');
    let field = 0.025;
    for (const zone of this.state.zones) {
      const t = Math.max(0, 1 - Math.hypot(point[0] - zone.center[0], point[1] - zone.center[1]) / zone.radius);
      field = Math.max(field, zone.strength * t * t * (3 - 2 * t));
    }
    return Math.min(1, field * this.state.amount);
  }
  snapshot(): WearSnapshot { return structuredClone(this.state); }
}
