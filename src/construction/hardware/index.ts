import { Parts } from './Parts.ts';
import { guard } from './Guard.ts';
import { drainage } from './Drainage.ts';
import { inlet } from './Inlet.ts';
import { invalidParams } from '../../errors.ts';
import type { FurnitureOptions, FurnitureModel } from './schema.ts';
export type * from './schema.ts';

export function createHardware(options: FurnitureOptions): FurnitureModel {
  if (!options || !['guard', 'inlet', 'channel', 'access'].includes(options.kind)
    || !Number.isFinite(options.length) || options.length <= 0 || !Number.isFinite(options.depth) || options.depth <= 0
    || !Number.isInteger(options.style) || options.style < 0 || options.style > (options.kind === 'guard' ? 5 : 3)
    || typeof options.damaged !== 'boolean') throw invalidParams('Invalid native hardware options');
  const builder = new Parts();
  if (options.kind === 'guard') guard(builder, options);
  else if (options.kind === 'inlet') inlet(builder, options);
  else drainage(builder, options);
  const parts = builder.finish();
  let disposed = false;
  return { parts, dispose() { if (!disposed) parts.forEach(part => part.geometry.dispose()); disposed = true; } };
}
