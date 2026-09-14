import type { NativeStreetFeature } from '../../schema/native-result.ts';
import type { FurnitureOptions } from '../hardware/schema.ts';
import type { GeometryPlacement, SurfaceCut } from '../surfaces/schema.ts';
export interface PlacedFeature {
  descriptor: NativeStreetFeature;
  options: FurnitureOptions;
  placement: GeometryPlacement;
  cut: SurfaceCut | null;
}
