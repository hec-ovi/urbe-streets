import type { NativeArchitecture, NativeFrontage, NativeGround, NativeOwner, NativeRoad } from '../../architecture/native-schema.ts';
import type { Ring, Vec2 } from '../../geometry/schema.ts';
import type { StreetProfile } from '../../schema/street-kit.ts';
import { bounds, difference, intersection, rectangle, totalArea, union } from '../../geometry/polygons.ts';
import type { SceneInput } from './UnitScene.ts';

/** Canonical Atlas module fields contain no city identity, seed or wear. */
export class CatalogueScene {
  readonly architecture: NativeArchitecture;
  private counter = 0;

  constructor() {
    this.architecture = { format: 'district', version: '0.26.0', reservationVersion: '2.1.0', identity: { hash: '', encoding: 'json-stringify-utf8' },
      bounds: { min: [0, 0], max: [1, 1] }, boundary: [], groundArrayCount: 0, owners: [], roads: [], approaches: [], turns: [], medians: [],
      shafts: [], stationBays: [], protections: [], obstaclePoints: [], exclusions: [], highwayHash: '', stationHash: '', remainingGroundIndices: [], degraded: [] };
  }

  segment(profile: StreetProfile, length: number, variant: string): SceneInput {
    const a = this.architecture, half = profile.width / 2, rim = profile.gutterWidth + profile.curbWidth;
    this.road(profile, [[0, 0], [length, 0]]);
    if (profile.width) this.owner('roadway', profile, [{ surface: 'roadway', ring: rectangle(0, -half, length, profile.width) }]);
    for (const sign of [-1, 1]) {
      const face = this.face(sign < 0 ? [length, -half] : [0, half], sign < 0 ? [0, -half] : [length, half], [0, sign], profile);
      const band = (offset: number, width: number) => rectangle(0, sign < 0 ? -half - offset - width : half + offset, length, width);
      const fields: { surface: NativeGround['surface']; ring: Ring }[] = [{ surface: 'sidewalk', ring: band(rim, profile.pavedWidth) }];
      if (rim) fields.push({ surface: 'gutter', ring: band(0, profile.gutterWidth) }, { surface: 'curb', ring: band(profile.gutterWidth, profile.curbWidth) });
      const owner = this.owner('perimeter', profile, fields, [face]);
      if (variant === 'parking' && sign === 1 && profile.width) {
        const footprint = band(0, 2);
        owner.ground = [
          { ...owner.ground[0]!, surface: 'sidewalk', ring: band(rim + 2, profile.pavedWidth - 2), top: 0.2 },
          { ...owner.ground[0]!, surface: 'roadway', ring: footprint, top: 0 },
          { ...owner.ground[0]!, surface: 'gutter', ring: band(2, profile.gutterWidth), top: 0 },
          { ...owner.ground[0]!, surface: 'curb', ring: band(2 + profile.gutterWidth, profile.curbWidth), top: 0.2 },
        ];
        owner.parking.push({ id: 'parking', ownerId: owner.id, frontageId: face.id, start: 0, end: length,
          support: { start: 0, end: length }, slotCount: 1, depth: 2, footprint, slots: [] });
      }
    }
    if (profile.medianWidth) {
      const h = profile.medianWidth / 2, roadOwner = a.owners.find(o => o.kind === 'roadway')!;
      const footprint = rectangle(0, -h, length, h * 2), paving = rectangle(0, -1, length, 2);
      roadOwner.ground = roadOwner.ground.flatMap(g => difference([g.ring], [footprint]).map(ring => ({ ...g, ring })));
      const median = this.owner('median', profile, [{ surface: 'sidewalk', ring: paving },
        ...[-1, 1].flatMap(sign => [{ surface: 'gutter' as const, ring: rectangle(0, sign < 0 ? -h : h - 0.5, length, 0.5) },
          { surface: 'curb' as const, ring: rectangle(0, sign < 0 ? -1.2 : 1, length, 0.2) }])],
        [this.face([0, -h], [length, -h], [0, 1], { ...profile, pavedWidth: 2 }),
          this.face([length, h], [0, h], [0, -1], { ...profile, pavedWidth: 2 })]);
      a.medians!.push({ id: median.id, edgeId: a.roads[0]!.id, footprint, paving, start: 0, end: length, ornaments: [] });
    }
    return this.finish(variant);
  }

  junction(primary: StreetProfile, cross: StreetProfile, center: boolean, terminal = false): SceneInput {
    const half = (primary.width || primary.pavedWidth * 2) / 2;
    const x0 = (cross.width || (center ? cross.pavedWidth * 2 : 0)) / 2;
    if (center) {
      const pedestrian = primary.streetClass === 'alley' && cross.streetClass === 'alley';
      this.owner(pedestrian ? 'station' : 'roadway', primary, [{ surface: pedestrian ? 'sidewalk' : 'roadway', ring: rectangle(-x0, -half, x0 * 2, half * 2) }]);
      this.road(primary, [[-x0, 0], [x0, 0]]);
      return { ...this.finish('plain'), paint: false };
    }
    const rim = 0.7, paved = 4.2, span = terminal ? 4.9 : 18, reach = x0 + span;
    this.road(primary, [[0, 0], [reach, 0]]);
    if (primary.streetClass === 'alley') {
      for (const sign of [-1, 1]) this.owner('perimeter', primary,
        [{ surface: 'sidewalk', ring: rectangle(x0, sign < 0 ? -half : 0, span, half) }],
        [this.face(sign > 0 ? [x0, 0] : [reach, 0], sign > 0 ? [reach, 0] : [x0, 0], [0, sign], primary)]);
      return this.finish('plain');
    }
    this.owner('roadway', primary, [{ surface: 'roadway', ring: rectangle(x0, -half, span, half * 2) }]);
    this.architecture.approaches.push({ id: 'crossing', nodeId: 'start', edgeId: 'r0', distance: x0 + 6.4,
      station: [x0 + 4.9, x0 + 7.9], field: rectangle(x0 + 4.9, -half + 0.05, 3, half * 2 - 0.1), landings: [] });
    for (const sign of [-1, 1]) {
      const outer = rectangle(x0, sign > 0 ? half : -half - rim - paved, span, rim + paved);
      const inset = (amount: number) => intersection([outer], [rectangle(x0 + amount,
        sign > 0 ? half + amount : -half - rim - paved, span - amount, rim + paved - amount)]);
      const gutter = difference([outer], inset(0.5)), curb = difference(inset(0.5), inset(rim)), sidewalk = inset(rim);
      const face = this.face(sign > 0 ? [x0 + (terminal ? 0 : rim + paved), half] : [reach, -half],
        sign > 0 ? [reach, half] : [x0 + (terminal ? 0 : rim + paved), -half], [0, sign], { ...primary, pavedWidth: paved, gutterWidth: 0.5, curbWidth: 0.2 });
      const owner = this.owner('perimeter', primary, [...gutter.map(ring => ({ surface: 'gutter' as const, ring })),
        ...curb.map(ring => ({ surface: 'curb' as const, ring })), ...sidewalk.map(ring => ({ surface: 'sidewalk' as const, ring }))], [face]);
      owner.corners.push({ id: `${owner.id}:corner`, ownerId: owner.id, frontageIds: [face.id], kind: 'explicit',
        boundary: rectangle(x0 + rim, sign > 0 ? half + rim : -half - rim - paved, paved, paved) });
    }
    if (primary.medianWidth && !terminal) this.medianEnd(primary, x0 + 13, reach);
    // The return bands meet the perpendicular carriageway beyond the selected arm.
    const context = this.owner('roadway', primary, [{ surface: 'roadway', ring: rectangle(x0 - 1, -half - 4.9, 1, half * 2 + 9.8) }]);
    const edgeOwners = [...this.architecture.owners];
    this.architecture.owners = this.architecture.owners.filter(o => o !== context);
    const seam: Ring = [[x0, -half], [x0 + rim + paved, -half - rim - paved], [reach, -half - rim - paved],
      [reach, half + rim + paved], [x0 + rim + paved, half + rim + paved], [x0, half]];
    if (terminal) this.architecture.approaches = [];
    return { ...this.finish('plain'), edgeOwners, seam, paint: !terminal };
  }

  private medianEnd(p: StreetProfile, start: number, end: number): void {
    const h = p.medianWidth / 2, footprint = rectangle(start, -h, end - start, h * 2);
    const curb = rectangle(start + 0.5, -h + 0.5, end - start - 0.5, h * 2 - 1);
    const paving = rectangle(start + 0.7, -1, end - start - 0.7, 2);
    const road = this.architecture.owners.find(o => o.kind === 'roadway')!;
    road.ground = road.ground.flatMap(g => difference([g.ring], [footprint]).map(ring => ({ ...g, ring })));
    const median = this.owner('median', p, [
      { surface: 'sidewalk', ring: paving },
      ...difference([footprint], [curb]).map(ring => ({ surface: 'gutter' as const, ring })),
      ...difference([curb], [paving]).map(ring => ({ surface: 'curb' as const, ring })),
    ], [this.face([start, -h], [end, -h], [0, 1], { ...p, pavedWidth: 2 }),
      this.face([end, h], [start, h], [0, -1], { ...p, pavedWidth: 2 })]);
    this.architecture.medians!.push({ id: median.id, edgeId: 'r0', footprint, paving, start, end, ornaments: [] });
  }

  private road(p: StreetProfile, path: Ring): void {
    const id = `r${this.architecture.roads.length}`;
    const road: NativeRoad = { id, from: 'start', to: 'end', kind: p.streetClass, width: p.width, path, lanes: [],
      runId: id, runStart: 0, runForward: true, districtStyle: p.zone as NativeRoad['districtStyle'] & string, medianWidth: p.medianWidth };
    for (let i = 0; i < p.lanes; i++) {
      const sign = i < p.lanes / 2 && p.lanes > 1 ? 1 : -1;
      const offset = p.lanes === 1 ? 0 : sign * (p.medianWidth / 2 + (p.lanes / 2 - 0.5 - i % (p.lanes / 2)) * p.laneWidth);
      road.lanes.push({ id: `${id}:v${i}`, width: p.laneWidth, offset, direction: sign > 0 ? 'backward' : 'forward',
        path: path.map(([x, z]) => [x, z + offset]) });
    }
    this.architecture.roads.push(road);
  }

  private face(start: Vec2, end: Vec2, inward: Vec2, p: StreetProfile): NativeFrontage {
    return { id: `f${this.counter++}`, ownerId: '', edgeIds: ['r0'], start, end, inward, length: Math.hypot(end[0] - start[0], end[1] - start[1]),
      moduleStationOffset: 0, pavedWidth: p.pavedWidth, roadTop: 0, pavedTop: 0.2, curbWidth: p.curbWidth, gutterWidth: p.gutterWidth, cornerIds: [null, null] };
  }

  private owner(kind: NativeOwner['kind'], p: StreetProfile, fields: { surface: NativeGround['surface']; ring: Ring }[], frontages: NativeFrontage[] = []): NativeOwner {
    const id = `o${this.counter++}`;
    const owner: NativeOwner = { id, kind, finish: p.zone === 'luxury' ? 'luxury-blue' : p.zone === 'industrial' ? 'industrial-yellow' : 'ordinary',
      ground: fields.filter(f => totalArea([f.ring]) > 1e-9).map((f, i) => ({ ...f, id: `${id}:g${i}`, sourceIndex: 0, ownerId: id, bottom: -0.2,
        top: f.surface === 'curb' || f.surface === 'sidewalk' ? 0.2 : 0 })), frontages, interiors: [], excludedParcelIds: [], corners: [], parking: [], guards: [] };
    for (const f of frontages) f.ownerId = id;
    this.architecture.owners.push(owner);
    return owner;
  }

  private finish(variant: string): SceneInput {
    const a = this.architecture;
    const domain = union(a.owners.flatMap(o => [...o.ground.map(g => g.ring), ...o.parking.map(p => p.footprint)]));
    a.bounds = bounds(domain.flat());
    a.boundary = rectangle(a.bounds.min[0], a.bounds.min[1], a.bounds.max[0] - a.bounds.min[0], a.bounds.max[1] - a.bounds.min[1]);
    return { architecture: a, edgeOwners: a.owners, variant };
  }
}
