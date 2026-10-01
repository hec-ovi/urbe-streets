import type { NativeArchitecture, NativeGround, NativeRoad } from '../../architecture/native-schema.ts';
import type { Ring } from '../../geometry/schema.ts';
import type { StreetPlacement } from '../../schema/street-kit.ts';
import { bounds, difference, intersection, totalArea, union } from '../../geometry/polygons.ts';
import { BoxIndex } from '../../geometry/BoxIndex.ts';
import { WearField } from '../style/WearField.ts';
import { invariant } from '../../errors.ts';
import settings from '../district/settings.json' with { type: 'json' };
import { UnitPlan } from './UnitPlan.ts';
import { unitDecals } from './UnitDecals.ts';
import { UnitFeatures } from './UnitFeatures.ts';
import { KitCatalogue } from './KitCatalogue.ts';
import { ProfileCatalogue } from './ProfileCatalogue.ts';
import { stationPlacements } from './StationPlacements.ts';
import { clean, UnitFrame } from './Frame.ts';
import { UnitCoverage } from './UnitCoverage.ts';
import { ParkingUnits } from './ParkingUnits.ts';
import { placement, turnPlacements } from './UnitOverlays.ts';
import { crossingPlacements, sourceInfill, type InfillSurface } from './SourceInfill.ts';
import { direction } from '../surfaces/Frame.ts';
import { KerbFinishes } from './KerbFinishes.ts';
import { SIDE_HALF } from './KitCatalogue.ts';

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
  readonly panels = this.catalogue.panels;

  constructor(a: NativeArchitecture, seed: number, amount: number) {
    this.plan = new UnitPlan(a);
    const plainClosures = this.plan.regions.filter(r => r.kind === 'segment' && r.length < 2).flatMap(r => r.mask);
    const shafts = new BoxIndex(a.shafts.map(s => s.ring), bounds);
    const receivingGround = new BoxIndex(a.owners.filter(o => o.kind !== 'station').flatMap(o => o.ground.map(g => g.ring)), bounds);
    this.wear = new WearField({ seed, amount, bounds: a.bounds, streets: Math.max(1, new Set(a.roads.filter(r => r.kind !== 'highway').map(r => r.runId)).size) });
    const parking = new ParkingUnits(a, this.plan.regions, this.profiles);
    const details = { ...a, owners: a.owners.map(o => ({ ...o, parking: o.parking.filter(b => parking.bays.has(b)) })) };
    this.features = new UnitFeatures(details, seed, p => this.wear.sample(p), plainClosures);
    const pieces = new Map(this.pieces.map(p => [p.metadata.id, p]));
    const coverage = new UnitCoverage(a);
    const kerbs = new KerbFinishes(a);
    const add = (p: StreetPlacement, source?: NativeGround) => {
      const piece = pieces.get(p.piece);
      if (!piece) throw invariant('Placement references an unknown catalogue piece', { piece: p.piece });
      p.wear = this.wear.sample([p.position[0], p.position[2]]);
      coverage.add(piece, p, this.placements.length, source);
      this.placements.push(p);
    };
    const fit = (p: StreetPlacement) => { if (coverage.fits(pieces.get(p.piece)!, p)) add(p); };
    for (const road of a.roads) this.profiles.select(road);
    const mappedRoads = new Set(this.profiles.mappings.map(m => m.roadId));
    const mappedWidths = union(this.plan.regions.filter(r => r.roads.some(road => mappedRoads.has(road.id))).flatMap(r => r.mask));
    for (const region of this.plan.regions) {
      // A region with no saved receiving ground left outside station shafts takes no piece.
      if (!difference(intersection(receivingGround.near(region.box), region.mask), shafts.near(region.box)).length) continue;
      const parked = parking.regions.get(region);
      if (parked) { for (const p of parked) fit(p); continue; }
      let p: StreetPlacement;
      if (region.kind === 'segment') {
        const profile = this.profiles.select(region.roads[0]!);
        const length = Math.max(2, region.length);
        const variant = length < 8 ? 'closure' : 'plain';
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
        const primaryRoad = widest(parallel.length ? parallel : region.roads);
        const primary = zoneProfile(primaryRoad);
        const cross = zoneProfile(widest(perpendicular.length ? perpendicular : region.roads));
        if (region.kind === 'junction-arm') {
          const point = region.frame.world([perpendicular.length ? cross.width / 2 : 0, 0]);
          const incident = parallel.some(r => r.path.some(point => {
            const local = region.frame.local(point); return local[0] > 1e-7;
          }));
          const frame = new UnitFrame(point, axis);
          if (primary.streetClass === 'alley') p = placement(KitCatalogue.arm(primary, !incident), frame, ['roadway']);
          else {
            // Each side of an arm, and the far kerb where the street ends at a T, wears its own block's finish.
            if (!incident) {
              const across = kerbs.at(frame.world([2.8, 0]), region.zone);
              const base = this.profiles.profiles.find(q => q.zone === 'ordinary' && q.id.split('/')[1] === primary.id.split('/')[1])!;
              fit(placement(KitCatalogue.farKerb(base, across.finish), frame, [across.owner?.id ?? 'roadway']));
              continue;
            }
            // An arm running on under a highway deck is the deck's court, not a carriageway.
            if (primaryRoad.kind === 'highway') {
              const base = this.profiles.profiles.find(q => q.zone === 'ordinary' && q.id.split('/')[1] === primary.id.split('/')[1])!;
              for (const [station, length] of [[0, 8], [8, 8], [16, 2]] as const) {
                fit(placement(KitCatalogue.under(base, length), new UnitFrame(frame.world([station, 0]), axis), ['roadway']));
              }
            } else fit(placement(KitCatalogue.armCore(primary), frame, ['roadway']));
            for (const side of ['left', 'right'] as const) {
              const sign = side === 'left' ? 1 : -1, half = primary.width / 2;
              const block = kerbs.at(frame.world([10, sign * (half + 2.8)]), region.zone);
              fit(placement(KitCatalogue.side(block.finish, side), new UnitFrame(frame.world([0, sign * (half - SIDE_HALF)]), axis), [block.owner?.id ?? 'roadway']));
            }
            continue;
          }
        } else {
          if (primary.streetClass === 'alley' && cross.streetClass === 'alley') continue;
          const ordered = this.profiles.profiles.indexOf(primary) <= this.profiles.profiles.indexOf(cross);
          p = placement(ordered ? KitCatalogue.center(primary, cross) : KitCatalogue.center(cross, primary),
            ordered ? region.frame : new UnitFrame([region.frame.position[0], region.frame.position[2]], [0, 1]), ['roadway']);
        }
      }
      fit(p);
    }
    for (const p of parking.placements) fit(p);
    for (const p of stationPlacements(a, this.profiles.profiles)) fit(p);
    for (const p of this.islands(a)) fit(p);
    // Leftover carriageway takes the paving of the road it lies on; anything else is plain concrete.
    const carriageways = new BoxIndex<{ ring: Ring; zone: string }>();
    for (const road of a.roads) for (let i = 1; i < road.path.length; i++) {
      const p = road.path[i - 1]!, q = road.path[i]!, d = direction(p, q), n = [-d[1] * road.width / 2, d[0] * road.width / 2] as const;
      const ring: Ring = [[p[0] - n[0], p[1] - n[1]], [q[0] - n[0], q[1] - n[1]], [q[0] + n[0], q[1] + n[1]], [p[0] + n[0], p[1] + n[1]]];
      carriageways.add({ ring, zone: road.districtStyle ?? 'ordinary' }, bounds(ring));
    }
    const surface = (g: NativeGround, triangle: Ring): InfillSurface => {
      if (g.surface !== 'roadway') return 'concrete';
      let zone = 'ordinary', best = 0;
      for (const c of carriageways.near(bounds(triangle))) {
        const shared = totalArea(intersection([triangle], [c.ring]));
        if (shared > best) { best = shared; zone = c.zone; }
      }
      return zone === 'luxury' ? 'district-hex' : 'asphalt';
    };
    for (const { placement: p, ground } of sourceInfill(a, g => coverage.remaining(g), surface)) add(p, ground);
    for (const f of this.features.items) {
      const p = placement(KitCatalogue.prop(f.options), f.frame, [f.descriptor.ownerId]);
      if (f.message) p.text = [...f.message].map(c => settings.glyphs.indexOf(c));
      this.featurePlacements.push(this.placements.length);
      add(p);
      if (f.cut?.kind === 'inlet') add(placement(`overlay/drain/${f.options.depth}m`, f.frame, [f.descriptor.ownerId]));
    }
    for (const p of turnPlacements(a, plainClosures)) add(p);
    for (const p of crossingPlacements(a)) add(p);
    for (const p of unitDecals(details, seed, p => this.wear.sample(p), plainClosures)) add(p);
    this.ground = coverage.finish(mappedWidths);
  }

  /** Each saved median island as a nose at either end and 8 m and 2 m units between, at its Atlas stations. */
  private *islands(a: NativeArchitecture): Generator<StreetPlacement> {
    const roads = new Map(a.roads.map(r => [r.id, r]));
    for (const median of a.medians ?? []) {
      const road = roads.get(median.edgeId), profile = road && this.profiles.select(road);
      if (!road || !profile?.medianWidth) continue;
      const first = road.path[0]!, d = direction(first, road.path.at(-1)!);
      const frame = (station: number, axis = d) => new UnitFrame([first[0] + d[0] * station, first[1] + d[1] * station], axis);
      yield placement(KitCatalogue.island(profile, 2, true), frame(median.start), [median.id]);
      yield placement(KitCatalogue.island(profile, 2, true), frame(median.end, [-d[0], -d[1]]), [median.id]);
      for (let station = median.start + 2; station < median.end - 2 - 1e-7;) {
        const length = median.end - 2 - station >= 8 - 1e-7 ? 8 : 2;
        yield placement(KitCatalogue.island(profile, length, false), frame(station), [median.id]);
        station = clean(station + length);
      }
    }
  }
}
