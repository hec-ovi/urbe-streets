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
  kind: 'inlet' | 'marquee' | 'cable' | 'guard' | 'tree-grate';
  model: FurnitureModel;
  descriptor: NativeStreetFeature;
  cut?: SurfaceCut;
  panel?: Ring;
}
