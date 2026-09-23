import { Parts } from './Parts.ts';
import { guard } from './Guard.ts';
import { drainage } from './Drainage.ts';
import { inlet } from './Inlet.ts';
import { cable } from './Cable.ts';
import { marqueeCap, marqueeDepth, marqueeSegment } from './Marquee.ts';
import { treeGrate } from './TreeGrate.ts';
import { invalidParams } from '../../errors.ts';
import type { FurnitureOptions, FurnitureModel } from './schema.ts';
export type * from './schema.ts';

export function createHardware(options: FurnitureOptions): FurnitureModel {
  if (!options || !['guard', 'inlet', 'channel', 'access', 'cable', 'marquee', 'marquee-cap', 'tree-grate'].includes(options.kind)
    || !Number.isFinite(options.length) || options.length <= 0 || !Number.isFinite(options.depth) || options.depth <= 0
    || !Number.isInteger(options.style) || options.style < 0 || options.style > (options.kind === 'guard' ? 5 : 3)
    || typeof options.damaged !== 'boolean' || options.kind === 'inlet' && options.depth <= 0.3
    || ['cable', 'marquee', 'tree-grate'].includes(options.kind) && (options.length < 1 || options.depth < 0.4)
    || ['marquee', 'marquee-cap'].includes(options.kind) && options.depth !== marqueeDepth
    || options.kind === 'marquee-cap' && (options.length < 0.25 || options.length > 0.3 || options.style > 1)) throw invalidParams('Invalid native hardware options');
  const builder = new Parts();
  if (options.kind === 'guard') guard(builder, options);
  else if (options.kind === 'inlet') inlet(builder, options);
  else if (options.kind === 'cable') cable(builder, options);
  else if (options.kind === 'marquee') marqueeSegment(builder, options);
  else if (options.kind === 'marquee-cap') marqueeCap(builder, options);
  else if (options.kind === 'tree-grate') treeGrate(builder, options);
  else drainage(builder, options);
  const parts = builder.finish();
  let disposed = false;
  return { parts, dispose() { if (!disposed) parts.forEach(part => part.geometry.dispose()); disposed = true; } };
}
