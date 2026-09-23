import type { NativeFrontage, NativeOwner } from '../../architecture/native-schema.ts';
import type { NativeStreetFeature } from '../../schema/native-result.ts';
import type { FurnitureModel } from '../hardware/schema.ts';
import type { Ring } from '../../geometry/schema.ts';
import type { SurfaceCut } from '../surfaces/schema.ts';

export interface DistrictFeature {
  owner: NativeOwner;
  face: NativeFrontage;
  station: number;
  setback: number;
  kind: 'inlet' | 'marquee' | 'marquee-cap' | 'cable' | 'guard' | 'tree-grate';
  model: FurnitureModel;
  /** The message of the run a marquee segment belongs to. */
  message?: string;
  descriptor: NativeStreetFeature;
  cut?: SurfaceCut;
  panel?: Ring;
}
