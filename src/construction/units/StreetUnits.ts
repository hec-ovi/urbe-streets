import type { NativeArchitecture, NativeRoad } from '../../architecture/native-schema.ts';
import type { Ring } from '../../geometry/schema.ts';
import type { StreetPlacement } from '../../schema/street-kit.ts';
import { difference, intersection, totalArea, union } from '../../geometry/polygons.ts';
import { WearField } from '../style/WearField.ts';
import { invariant } from '../../errors.ts';
import settings from '../district/settings.json' with { type: 'json' };
import { UnitPlan } from './UnitPlan.ts';
import { unitDecals } from './UnitDecals.ts';
import { UnitFeatures } from './UnitFeatures.ts';
import { KitCatalogue } from './KitCatalogue.ts';
import { ProfileCatalogue } from './ProfileCatalogue.ts';
import { stationPlacements } from './StationPlacements.ts';
import { UnitFrame } from './Frame.ts';
import { UnitCoverage } from './UnitCoverage.ts';
import { placement, turnPlacements } from './UnitOverlays.ts';

export class StreetUnits {
  readonly catalogue = new KitCatalogue();
  readonly profiles = new ProfileCatalogue();
  readonly pieces = this.catalogue.pieces;
  readonly placements: StreetPlacement[] = [];
  readonly plan: UnitPlan;
  readonly wear: WearField;
  readonly features: UnitFeatures;
  readonly featurePlacements: number[] = [];
  readonly ground: ReturnType<UnitCoverage['finish']>;
  readonly overhangs: UnitCoverage['report'];
  readonly panels = this.catalogue.panels;

  constructor(a: NativeArchitecture, seed: number, amount: number) {
    const surfaces: NativeArchitecture = { ...a, roads: a.roads.map(r => r.kind === 'highway' ? { ...r, kind: 'road' as const } : r) };
    this.plan = new UnitPlan(surfaces);
    const plainClosures = this.plan.regions.filter(r => r.kind === 'segment' && r.length < 2).flatMap(r => r.mask);
    this.wear = new WearField({ seed, amount, bounds: a.bounds, streets: Math.max(1, new Set(a.roads.filter(r => r.kind !== 'highway').map(r => r.runId)).size) });
    this.features = new UnitFeatures(a, seed, p => this.wear.sample(p), plainClosures);
    const pieces = new Map(this.pieces.map(p => [p.metadata.id, p]));
    const coverage = new UnitCoverage(a);
    const add = (p: StreetPlacement, receiving?: Ring[]) => {
      const piece = pieces.get(p.piece);
      if (!piece) throw invariant('Placement references an unknown catalogue piece', { piece: p.piece });
      p.wear = this.wear.sample([p.position[0], p.position[2]]);
      coverage.add(piece, p, this.placements.length, receiving);
      this.placements.push(p);
    };
    for (const road of surfaces.roads) this.profiles.select(road);
    const mappedRoads = new Set(this.profiles.mappings.map(m => m.roadId));
    const mappedWidths = union(this.plan.regions.filter(r => r.roads.some(road => mappedRoads.has(road.id))).flatMap(r => r.mask));
    for (const region of this.plan.regions) {
      const expected = difference(intersection(a.owners.filter(o => o.kind !== 'station').flatMap(o => o.ground.map(g => g.ring)), region.mask), a.shafts.map(s => s.ring));
      if (!expected.length) continue;
      let p: StreetPlacement;
      if (region.kind === 'segment') {
        const profile = this.profiles.select(region.roads[0]!);
        const length = Math.max(2, region.length);
        const drain = this.features.items.some(f => f.cut && totalArea(intersection([f.cut.ring], region.mask)) > 1e-9);
        const parking = a.owners.some(o => o.parking.some(b => totalArea(intersection([b.footprint], region.mask)) > 1e-9));
        const variant = length < 8 ? 'closure' : drain ? 'drain' : parking ? 'parking' : 'plain';
        p = placement(KitCatalogue.segment(profile, length, variant), region.frame, ['roadway']);
        if (region.length < 2) p.scale = [region.length / 2, 1, 1];
      } else {
        const axis = region.frame.d;
        const along = (road: NativeRoad) => {
          const first = road.path[0]!, last = road.path.at(-1)!;
          return Math.abs((last[0] - first[0]) * axis[0] + (last[1] - first[1]) * axis[1]) > 1e-7;
        };
        const widest = (roads: NativeRoad[]) => roads.reduce((x, y) => x.width >= y.width ? x : y);
        const parallel = region.roads.filter(along), perpendicular = region.roads.filter(r => !along(r));
        const zoneProfile = (road: NativeRoad) => {
          const selected = this.profiles.select(road);
          return this.profiles.profiles.find(p => p.zone === region.zone && p.id.split('/')[1] === selected.id.split('/')[1])!;
        };
        const primary = zoneProfile(widest(parallel.length ? parallel : region.roads));
        const cross = zoneProfile(widest(perpendicular.length ? perpendicular : region.roads));
        if (region.kind === 'junction-arm') {
          const point = region.frame.world([perpendicular.length ? cross.width / 2 : 0, 0]);
          const incident = parallel.some(r => r.path.some(point => {
            const local = region.frame.local(point); return local[0] > 1e-7;
          }));
          p = placement(KitCatalogue.arm(primary, !incident), new UnitFrame(point, axis), ['roadway']);
        } else {
          const ordered = this.profiles.profiles.indexOf(primary) <= this.profiles.profiles.indexOf(cross);
          p = placement(ordered ? KitCatalogue.center(primary, cross) : KitCatalogue.center(cross, primary),
            ordered ? region.frame : new UnitFrame([region.frame.position[0], region.frame.position[2]], [0, 1]), ['roadway']);
        }
      }
      add(p, expected);
    }
    for (const p of stationPlacements(a, this.profiles.profiles)) add(p);
    for (const f of this.features.items) {
      const p = placement(KitCatalogue.prop(f.options), f.frame, [f.descriptor.ownerId]);
      if (f.message) p.text = [...f.message].map(c => settings.glyphs.indexOf(c));
      this.featurePlacements.push(this.placements.length);
      add(p);
      if (f.cut?.kind === 'inlet') add(placement(`overlay/drain/${f.options.depth}m`, f.frame, [f.descriptor.ownerId]));
    }
    for (const p of turnPlacements(a, plainClosures)) add(p);
    for (const p of unitDecals(a, seed, p => this.wear.sample(p), plainClosures)) add(p);
    this.ground = coverage.finish(mappedWidths);
    this.overhangs = coverage.report;
  }
}
