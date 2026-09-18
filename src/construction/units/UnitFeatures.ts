import type { NativeArchitecture } from '../../architecture/native-schema.ts';
import type { NativeStreetFeature } from '../../schema/native-result.ts';
import type { Ring, Vec2 } from '../../geometry/schema.ts';
import { intersection, totalArea } from '../../geometry/polygons.ts';
import { DistrictDetails } from '../district/Details.ts';
import type { DistrictFeature } from '../district/schema.ts';
import { FeatureBuilder } from '../features/FeatureBuilder.ts';
import type { PlacedFeature } from '../features/schema.ts';
import type { SurfaceCut } from '../surfaces/schema.ts';
import { along } from '../surfaces/Frame.ts';
import type { FurnitureOptions } from '../hardware/schema.ts';
import settings from '../district/settings.json' with { type: 'json' };
import { UnitFrame } from './Frame.ts';

export interface UnitFeature {
  descriptor: NativeStreetFeature;
  frame: UnitFrame;
  options: FurnitureOptions;
  cut?: SurfaceCut;
  panel?: DistrictFeature['panel'];
  message?: string;
}

/** Plans source feature instances and retains their anchors and opening masks. */
export class UnitFeatures {
  readonly items: UnitFeature[];
  constructor(a: NativeArchitecture, seed: number, wear: (p: Vec2) => number, excluded: Ring[]) {
    if (a.format === 'district') {
      const details = new DistrictDetails(a);
      this.items = details.features.map(f => {
        const point = along(f.face, f.station + f.descriptor.length / 2, f.setback);
        const index = details.features.filter(other => other.owner.id === f.owner.id).indexOf(f);
        return { descriptor: f.descriptor, frame: new UnitFrame(point, [f.face.inward[1], -f.face.inward[0]], f.face.roadTop),
          options: { kind: f.kind, length: f.descriptor.length, depth: f.descriptor.depth, style: 0, damaged: false },
          ...(f.cut ? { cut: f.cut } : {}), ...(f.panel ? { panel: f.panel } : {}),
          ...(f.kind === 'marquee' ? { message: settings.messages[index % settings.messages.length]! } : {}) };
      });
      details.dispose();
    } else {
      const builder = new FeatureBuilder(a, seed, wear);
      this.items = builder.plan().map((f: PlacedFeature) => ({ descriptor: f.descriptor,
        frame: new UnitFrame([f.placement.origin[0], f.placement.origin[2]], [f.placement.inward[1], -f.placement.inward[0]], f.placement.origin[1]),
        options: f.options, ...(f.cut ? { cut: f.cut } : {}) }));
      builder.dispose();
    }
    this.items = this.items.filter(f => totalArea(intersection([f.descriptor.footprint, ...(f.cut ? [f.cut.ring] : []), ...(f.panel ? [f.panel] : [])], excluded)) <= 1e-9);
  }
}
