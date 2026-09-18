import { invariant } from '../errors.ts';
import type { NativeArchitecture } from '../architecture/native-schema.ts';
import type { Vec2 } from '../geometry/schema.ts';
import type { NativeStreetManifest } from '../schema/native-result.ts';
import { WearField } from './style/WearField.ts';
import { FeatureBuilder } from './features/FeatureBuilder.ts';
import type { PlacedFeature } from './features/schema.ts';
import { SurfaceBatch } from './surfaces/SurfaceBatch.ts';
import { EdgeRing } from './surfaces/EdgeRing.ts';
import { Paving } from './surfaces/Paving.ts';
import { parking } from './surfaces/Parking.ts';
import { asphalt } from './surfaces/Asphalt.ts';
import { Markings } from './markings/Markings.ts';
import { DistrictConstruction } from './district/DistrictConstruction.ts';
import type { CoverageClaim, NativeMeshData } from './surfaces/schema.ts';

export interface OwnerSurfaces { meshes: NativeMeshData[]; coverage: CoverageClaim[]; panels: number }

/** One receiving owner's whole construction. Nothing here reads another owner's result, so owners build in any order. */
export class OwnerConstruction {
  readonly features: NativeStreetManifest['features'];
  private readonly architecture: NativeArchitecture;
  private readonly field: WearField;
  private readonly wear: (point: Vec2) => number;
  private readonly markings: Markings;
  private readonly district?: DistrictConstruction;
  private readonly hardware?: FeatureBuilder;
  private readonly edges?: EdgeRing;
  private readonly paving?: Paving;
  private readonly placed = new Map<string, PlacedFeature[]>();

  constructor(architecture: NativeArchitecture, seed: number, amount: number) {
    this.architecture = architecture;
    this.field = new WearField({ seed, bounds: architecture.bounds,
      streets: new Set(architecture.roads.filter(road => road.kind !== 'highway').map(road => road.runId)).size, amount });
    this.wear = point => this.field.sample(point);
    this.markings = new Markings(architecture, seed, this.wear);
    if (architecture.format === 'district') { this.district = new DistrictConstruction(architecture); this.features = this.district.features; }
    else {
      this.hardware = new FeatureBuilder(architecture, seed, this.wear);
      this.edges = new EdgeRing(architecture);
      this.paving = new Paving(architecture, seed, this.wear);
      const plan = this.hardware.plan();
      for (const feature of plan) this.placed.set(feature.descriptor.ownerId, [...this.placed.get(feature.descriptor.ownerId) ?? [], feature]);
      this.features = plan.map(feature => feature.descriptor);
    }
  }

  snapshot(): NativeStreetManifest['wear'] { return this.field.snapshot(); }

  build(index: number): OwnerSurfaces {
    const owner = this.architecture.owners[index];
    if (!owner) throw invariant('Native construction has no owner at that index', { index });
    const selected = this.placed.get(owner.id) ?? [], cuts = selected.flatMap(feature => feature.cut ? [feature.cut] : []);
    const shafts = this.architecture.shafts.map(shaft => shaft.ring);
    const roadTop = owner.frontages[0]?.roadTop ?? owner.ground.find(ground => ground.surface === 'roadway')?.top;
    if (roadTop === undefined && owner.kind !== 'station') throw invariant('Native owner has no declared road datum', { ownerId: owner.id });
    const stationTop = owner.kind === 'station' ? owner.ground[0]!.top - 0.2 : undefined;
    const batch = new SurfaceBatch({ ownerId: owner.id, groundIds: owner.ground.map(ground => ground.id), roadTop: roadTop ?? stationTop!, wear: this.wear });
    let panels = 0;
    if (this.district) panels += this.district.build(owner, batch);
    else { asphalt(owner, batch, shafts); panels += parking(owner, batch); this.edges!.build(owner, batch, cuts, shafts); panels += this.paving!.build(owner, batch, cuts, shafts); }
    this.markings.build(owner, batch);
    const surface = batch.finish(), hardware = this.hardware?.draw(owner, selected) ?? { meshes: [], coverage: [] };
    return { meshes: [...surface.meshes, ...hardware.meshes], coverage: [...surface.coverage, ...hardware.coverage], panels };
  }

  dispose(): void { this.district?.dispose(); this.hardware?.dispose(); }
}
