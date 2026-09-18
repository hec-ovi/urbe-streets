import type { NativeArchitecture, NativeRoad } from '../../architecture/native-schema.ts';
import type { Ring, Vec2, Vec3 } from '../../geometry/schema.ts';
import type { StreetPlacement } from '../../schema/street-kit.ts';
import { bounds, difference, intersection, intersects, totalArea, union } from '../../geometry/polygons.ts';
import { NativeCoverage } from '../../ground/NativeCoverage.ts';
import { WearField } from '../style/WearField.ts';
import { invariant } from '../../errors.ts';
import { UnitPlan } from './UnitPlan.ts';
import { unitDecals } from './UnitDecals.ts';
import { UnitFeatures } from './UnitFeatures.ts';
import { unitScene } from './UnitScene.ts';
import { KitCatalogue } from './KitCatalogue.ts';
import { ProfileCatalogue } from './ProfileCatalogue.ts';
import { placementFootprint } from './PlacementGeometry.ts';
import { stationPlacements } from './StationPlacements.ts';
import { canonical, UnitFrame } from './Frame.ts';

export class StreetUnits {
  readonly catalogue = new KitCatalogue();
  readonly profiles = new ProfileCatalogue();
  readonly pieces = this.catalogue.pieces;
  readonly placements: StreetPlacement[] = [];
  readonly plan: UnitPlan;
  readonly wear: WearField;
  readonly features: UnitFeatures;
  readonly ground: ReturnType<NativeCoverage['finish']>;
  readonly panels = this.catalogue.panels;

  constructor(a: NativeArchitecture, seed: number, amount: number) {
    const surfaces: NativeArchitecture = { ...a, roads: [...a.roads.filter(r => r.kind !== 'highway'),
      ...a.roads.filter(r => r.kind === 'highway').map(r => ({ ...r, kind: 'road' as const }))] };
    this.plan = new UnitPlan(surfaces);
    const plainClosures = this.plan.regions.filter(r => r.kind === 'segment' && r.length < 2).flatMap(r => r.mask);
    this.wear = new WearField({ seed, amount, bounds: a.bounds, streets: Math.max(1, new Set(a.roads.filter(r => r.kind !== 'highway').map(r => r.runId)).size) });
    this.features = new UnitFeatures(a, seed, p => this.wear.sample(p), plainClosures);
    const pieces = new Map(this.pieces.map(p => [p.metadata.id, p]));
    const claims = new Map(a.owners.map(o => [o.id, [] as Ring[]]));
    const corridors = { ...surfaces, owners: a.owners.filter(o => o.kind !== 'station') };
    for (const road of surfaces.roads) this.profiles.select(road);
    const mappedRoads = new Set(this.profiles.mappings.map(m => m.roadId));
    const mappedWidths = union(this.plan.regions.filter(r => r.roads.some(road => mappedRoads.has(road.id))).flatMap(r => r.mask));
    for (const region of this.plan.regions) {
      const scene = unitScene(corridors, region, this.features.items);
      if (!scene.architecture.owners.length) continue;
      let id: string, configuration: string | undefined, scale: Vec3 | undefined, offset: Vec2 | undefined;
      if (region.kind === 'segment') {
        const profile = this.profiles.select(region.roads[0]!);
        const length = region.length < 2 ? 2 : region.length;
        const variant = length < 8 ? 'closure' : scene.variant.includes('drain') ? 'drain' : scene.variant.includes('parking') ? 'parking' : 'plain';
        id = KitCatalogue.segment(profile, length, variant);
        if (region.length < 2) scale = [region.length / 2, 1, 1];
      } else {
        const axis = region.frame.d;
        const along = (road: NativeRoad) => {
          const p = road.path[0]!, q = road.path.at(-1)!;
          return Math.abs((q[0] - p[0]) * axis[0] + (q[1] - p[1]) * axis[1]) > 1e-7;
        };
        const widest = (roads: NativeRoad[]) => roads.reduce((x, y) => x.width >= y.width ? x : y);
        const parallel = region.roads.filter(along), perpendicular = region.roads.filter(r => !along(r));
        const primary = this.profiles.select(widest(parallel.length ? parallel : region.roads));
        const cross = this.profiles.select(widest(perpendicular.length ? perpendicular : region.roads));
        // A junction zone selects its finish while dimensions select the stored configuration.
        configuration = `${primary.id.split('/')[1]}+${cross.id.split('/')[1]}`;
        id = `junction/${[primary.streetClass, cross.streetClass].sort().join('+')}/${region.zone}/${region.kind === 'junction-arm' ? 'arm' : 'center'}`;
        if (region.kind === 'junction-arm' && !perpendicular.length) offset = [-cross.width / 2, 0];
      }
      const piece = pieces.get(id);
      if (!piece) throw invariant('Placement references an unknown catalogue piece', { id });
      const expected = canonical(difference(intersection(corridors.owners.flatMap(o => o.ground.map(g => g.ring)), region.mask), a.shafts.map(s => s.ring)));
      const placement = this.place(id, region.frame, ['roadway']);
      placement.clip = canonical(expected.map(r => r.map(region.frame.local)));
      if (configuration) placement.configuration = configuration;
      if (offset) placement.offset = offset;
      if (scale) placement.scale = scale;
      if (region.length >= 2 || region.kind !== 'segment') {
        const fields = scene.architecture.owners.flatMap(o => o.ground.filter(g => g.surface === 'roadway'));
        const roads = scene.architecture.roads.flatMap((road, i) => {
          if (a.roads.find(r => r.id === region.roads[i]!.id)!.kind === 'highway') return [];
          const profile = this.profiles.select(region.roads[i]!);
          return [{ ...road, width: profile.width, medianWidth: profile.medianWidth }];
        });
        if (fields.length && roads.length) placement.markings = { seed, domain: canonical(fields.map(g => g.ring)), roadTop: fields[0]!.top,
          roads, approaches: scene.architecture.approaches, turns: scene.architecture.turns };
      }
      placement.finishes = scene.architecture.owners.filter(o => o.kind !== 'roadway').map(o => ({ finish: o.finish ?? 'ordinary',
        clip: canonical(o.ground.map(g => g.ring)) }));
      const openings = this.features.items.flatMap(f => f.cut ? intersection([f.cut.ring], expected) : []);
      if (openings.length) placement.openings = canonical(openings.map(r => r.map(region.frame.local)));
      const panels = this.features.items.flatMap(f => f.panel ? intersection([f.panel], expected) : []);
      if (panels.length) placement.panels = [{ surface: 'tread', height: 0.2, clip: canonical(panels.map(r => r.map(region.frame.local))) }];
      const cover = placementFootprint(piece.metadata, placement), box = bounds(cover.flat());
      const missing = totalArea(difference(expected, cover));
      if (missing > 1e-7 && !region.roads.some(road => mappedRoads.has(road.id))) throw invariant('Catalogue piece does not cover its receiving placement', { piece: id, configuration, position: placement.position,
        rotation: placement.rotationY, missing, expected: bounds(expected.flat()), actual: box });
      const owners = corridors.owners.filter(o => o.ground.some(g => intersects(bounds(g.ring), box))).flatMap(o => {
        const part = intersection(cover, o.ground.map(g => g.ring));
        if (totalArea(part) <= 1e-9) return [];
        claims.get(o.id)!.push(...part); return [o.id];
      });
      placement.ownerIds = owners;
      placement.ownerId = owners.includes('roadway') ? 'roadway' : owners[0]!;
    }
    for (const placement of stationPlacements(a, this.profiles.profiles)) {
      this.placements.push(placement);
      claims.get(placement.ownerId)!.push(...placementFootprint(pieces.get(placement.piece)!.metadata, placement));
    }
    for (const f of this.features.items) {
      const id = KitCatalogue.prop(f.options);
      if (!pieces.has(id)) throw invariant('Feature references an unknown catalogue prop', { id });
      const placement = this.place(id, f.frame, [f.descriptor.ownerId], f.descriptor.id);
      placement.wear = this.wear.sample([f.frame.position[0], f.frame.position[2]]);
      if (f.message) placement.message = f.message;
    }
    const scans = unitDecals(a, seed, p => this.wear.sample(p), plainClosures);
    for (const scan of scans) {
      const candidate = this.placements.filter(p => p.markings).reduce((best, p) => {
        const distance = (v: StreetPlacement) => Math.hypot(v.position[0] - scan.position[0], v.position[2] - scan.position[2]);
        return distance(p) < distance(best) ? p : best;
      });
      (candidate.scans ??= []).push(scan);
    }
    const coverage = new NativeCoverage(a);
    for (const owner of a.owners) {
      const rings = claims.get(owner.id)!;
      const overlap = totalArea(rings) - totalArea(union(rings));
      if (overlap > 1e-6) throw invariant('Street placements overlap receiving ground', { ownerId: owner.id, overlap });
      coverage.add(owner, [{ ownerId: owner.id, rings }], mappedWidths);
    }
    this.ground = coverage.finish();
  }

  private place(piece: string, frame: UnitFrame, ownerIds: string[], featureId?: string): StreetPlacement {
    const p: StreetPlacement = { piece, position: frame.position, rotationY: frame.rotationY,
      cell: [Math.floor(frame.position[0] / 128), Math.floor(frame.position[2] / 128)], ownerId: ownerIds[0]!, ownerIds,
      ...(featureId ? { featureId } : {}) };
    this.placements.push(p);
    return p;
  }
}
