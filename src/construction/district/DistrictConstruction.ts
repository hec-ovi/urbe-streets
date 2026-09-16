import type { NativeArchitecture, NativeOwner } from '../../architecture/native-schema.ts';
import { EdgeRing } from '../surfaces/EdgeRing.ts';
import { SurfaceBatch } from '../surfaces/SurfaceBatch.ts';
import { DistrictPaving } from './Paving.ts';
import { DistrictRoads } from './Roads.ts';
import { DistrictDetails } from './Details.ts';
import { CrossingRamps } from './Ramps.ts';
import { palette } from './Palette.ts';

export class DistrictConstruction {
  private readonly architecture: NativeArchitecture;
  private readonly edges: EdgeRing;
  private readonly paving: DistrictPaving;
  private readonly roads: DistrictRoads;
  private readonly details: DistrictDetails;
  private readonly ramps: CrossingRamps;

  constructor(architecture: NativeArchitecture) {
    this.architecture = architecture;
    this.edges = new EdgeRing(architecture);
    this.paving = new DistrictPaving(architecture);
    this.roads = new DistrictRoads(architecture);
    this.details = new DistrictDetails(architecture);
    this.ramps = new CrossingRamps(architecture);
  }

  get features() { return this.details.features.map(feature => feature.descriptor); }

  build(owner: NativeOwner, batch: SurfaceBatch): number {
    const details = this.details.features.filter(feature => feature.owner.id === owner.id), ramps = this.ramps.plan(owner);
    const cuts = [...details.flatMap(feature => feature.cut ? [feature.cut] : []), ...ramps.map(ramp => ramp.cut)];
    this.roads.build(owner, batch);
    this.edges.build(owner, batch, cuts, this.architecture.shafts.map(shaft => shaft.ring));
    const count = this.paving.build(owner, batch, details, ramps.map(ramp => ramp.cut.ring));
    this.ramps.draw(ramps, batch);
    this.details.draw(owner, batch);
    const colors = palette(owner, this.architecture);
    for (const mesh of batch.finish().meshes) {
      if (mesh.surface === 'curb') mesh.surface = colors.curb;
      if (mesh.surface === 'gutter') mesh.surface = colors.gutter;
    }
    return count;
  }

  dispose(): void { this.details.dispose(); }
}
