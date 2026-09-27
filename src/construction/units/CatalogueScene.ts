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
    const half = profile.width / 2, rim = profile.gutterWidth + profile.curbWidth;
    this.road(profile, [[0, 0], [length, 0]]);
    if (profile.width) this.owner('roadway', profile, [{ surface: 'roadway', ring: rectangle(0, -half, length, profile.width) }]);
    for (const sign of [-1, 1]) {
      const face = this.face(sign < 0 ? [length, -half] : [0, half], sign < 0 ? [0, -half] : [length, half], [0, sign], profile);
      const band = (offset: number, width: number) => rectangle(0, sign < 0 ? -half - offset - width : half + offset, length, width);
      const fields: { surface: NativeGround['surface']; ring: Ring }[] = [{ surface: 'sidewalk', ring: band(rim, profile.pavedWidth) }];
      if (rim) fields.push({ surface: 'gutter', ring: band(0, profile.gutterWidth) }, { surface: 'curb', ring: band(profile.gutterWidth, profile.curbWidth) });
      this.owner('perimeter', profile, fields, [face]);
    }
    return this.withContext(profile.medianWidth ? [this.medianBand(profile, 0, length)] : [], { variant });
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
    if (terminal && primary.streetClass !== 'alley') return this.farKerb(primary, half, x0, rim, paved);
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
      const face = this.face(sign > 0 ? [x0 + rim + paved, half] : [reach, -half],
        sign > 0 ? [reach, half] : [x0 + rim + paved, -half], [0, sign], { ...primary, pavedWidth: paved, gutterWidth: 0.5, curbWidth: 0.2 });
      const owner = this.owner('perimeter', primary, [...gutter.map(ring => ({ surface: 'gutter' as const, ring })),
        ...curb.map(ring => ({ surface: 'curb' as const, ring })), ...sidewalk.map(ring => ({ surface: 'sidewalk' as const, ring }))], [face]);
      owner.corners.push({ id: `${owner.id}:corner`, ownerId: owner.id, frontageIds: [face.id], kind: 'explicit',
        boundary: rectangle(x0 + rim, sign > 0 ? half + rim : -half - rim - paved, paved, paved) });
    }
    // The return bands meet the perpendicular carriageway beyond the selected arm.
    const context = [this.owner('roadway', primary, [{ surface: 'roadway', ring: rectangle(x0 - 1, -half - 4.9, 1, half * 2 + 9.8) }])];
    if (primary.medianWidth) context.push(this.medianBand(primary, x0, span));
    const seam: Ring = [[x0, -half], [x0 + rim + paved, -half - rim - paved], [reach, -half - rim - paved],
      [reach, half + rim + paved], [x0 + rim + paved, half + rim + paved], [x0, half]];
    return this.withContext(context, { seam, paint: false });
  }

  /**
   * Where the primary street does not continue, its arm is the crossing street's far kerb:
   * gutter, curb and walk straight across, between the neighbouring arms' diagonal corner seams.
   */
  private farKerb(primary: StreetProfile, half: number, x0: number, rim: number, paved: number): SceneInput {
    const depth = rim + paved, reach = half + depth, kerb = { ...primary, pavedWidth: paved, gutterWidth: 0.5, curbWidth: rim - 0.5 };
    const band = (from: number, width: number) => rectangle(x0 + from, -reach, width, reach * 2);
    this.road(kerb, [[x0 - 1, reach], [x0 - 1, -reach]]);
    this.owner('perimeter', kerb, [{ surface: 'gutter', ring: band(0, 0.5) }, { surface: 'curb', ring: band(0.5, rim - 0.5) },
      { surface: 'sidewalk', ring: band(rim, paved) }], [this.face([x0, reach], [x0, -reach], [1, 0], kerb)]);
    // The crossing carriageway meets the gutter, so its edge gets a curb face.
    const context = this.owner('roadway', kerb, [{ surface: 'roadway', ring: rectangle(x0 - 1, -reach, 1, reach * 2) }]);
    return this.withContext([context], { seam: [[x0, -half], [x0 + depth, -reach], [x0 + depth, reach], [x0, half]], paint: false });
  }

  /**
   * The saved median island between local X 0 and `length`, one unit of a run of them.
   * A nose closes X 0 with the source's gutter and curb returns; the far end stays open.
   */
  island(profile: StreetProfile, length: number, nose: boolean): SceneInput {
    const h = profile.medianWidth / 2, start = nose ? 0.5 : 0, walk = nose ? 0.7 : 0;
    const footprint = rectangle(0, -h, length, h * 2), curb = rectangle(start, -h + 0.5, length - start, h * 2 - 1);
    const paving = rectangle(walk, -1, length - walk, 2), kerb = { ...profile, pavedWidth: 2 };
    this.road(profile, [[0, 0], [length, 0]]);
    const median = this.owner('median', profile, [{ surface: 'sidewalk', ring: paving },
      ...difference([footprint], [curb]).map(ring => ({ surface: 'gutter' as const, ring })),
      ...difference([curb], [paving]).map(ring => ({ surface: 'curb' as const, ring }))],
    [this.face([0, -h], [length, -h], [0, 1], kerb), this.face([length, h], [0, h], [0, -1], kerb)]);
    this.architecture.medians!.push({ id: median.id, edgeId: 'r0', footprint, paving, start: 0, end: length, ornaments: [] });
    // Carriageway surrounds the island on both sides and ahead of its nose.
    const before = nose ? 1 : 0, lanes = [-1, 1].map(sign => rectangle(-before, sign < 0 ? -h - 1 : h, length + before, 1));
    const context = this.owner('roadway', profile, [...lanes, ...nose ? [rectangle(-1, -h, 1, h * 2)] : []].map(ring => ({ surface: 'roadway' as const, ring })));
    return this.withContext([context], { variant: nose ? 'nose' : 'plain', paint: false });
  }

  /** A median profile leaves its 3.4 m band to the island units and roadway that Atlas saved there. */
  private medianBand(profile: StreetProfile, start: number, length: number): NativeOwner {
    const h = profile.medianWidth / 2, band = rectangle(start, -h, length, h * 2), road = this.architecture.owners.find(o => o.kind === 'roadway')!;
    road.ground = road.ground.flatMap(g => difference([g.ring], [band]).map(ring => ({ ...g, ring })));
    return this.owner('roadway', profile, [{ surface: 'roadway', ring: band }]);
  }

  /** Context owners give this piece's edges their neighbours; other placements draw them. */
  private withContext(context: NativeOwner[], options: { variant?: string; seam?: Ring; paint?: boolean }): SceneInput {
    const edgeOwners = [...this.architecture.owners];
    this.architecture.owners = edgeOwners.filter(o => !context.includes(o));
    const { variant = 'plain', ...rest } = options;
    return { ...this.finish(variant), edgeOwners, ...rest };
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
