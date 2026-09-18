import type { NativeArchitecture } from '../../architecture/native-schema.ts';
import type { NativeStreetFeature } from '../../schema/native-result.ts';
import type { Vec2 } from '../../geometry/schema.ts';
import { DistrictDetails } from '../district/Details.ts';
import type { DistrictFeature } from '../district/schema.ts';
import { FeatureBuilder } from '../features/FeatureBuilder.ts';
import type { PlacedFeature } from '../features/schema.ts';
import type { SurfaceCut, SurfaceOutput } from '../surfaces/schema.ts';
import { SurfaceBatch } from '../surfaces/SurfaceBatch.ts';
import { along } from '../surfaces/Frame.ts';
import { createHardware } from '../hardware/index.ts';
import type { FurnitureOptions } from '../hardware/schema.ts';
import { marqueeGlyphs } from '../district/Glyphs.ts';
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

/** Plans feature instances once in the original Atlas frames, then authors their shared models. */
export class UnitFeatures {
  readonly items: UnitFeature[];
  constructor(a: NativeArchitecture, seed: number, wear: (p: Vec2) => number) {
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
  }
  draw(feature: UnitFeature): SurfaceOutput {
    const batch = new SurfaceBatch({ ownerId: 'prop', groundIds: ['prop'], roadTop: 0, wear: () => 0 });
    const model = createHardware(feature.options);
    try {
      for (const part of model.parts) batch.geometry(part.material, part.geometry, { origin: [0, 0, 0], inward: [0, 1] });
      if (feature.message) {
        const face = { start: [0, 0], inward: [0, 1], roadTop: 0 } as const;
        marqueeGlyphs({ face, station: -feature.options.length / 2, setback: 0, descriptor: feature.descriptor }, batch, feature.message);
      }
      return batch.finish();
    } finally { model.dispose(); }
  }
}
