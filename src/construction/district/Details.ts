import type { NativeArchitecture, NativeFrontage, NativeOwner, NativeRoad } from '../../architecture/native-schema.ts';
import type { Ring, Vec2 } from '../../geometry/schema.ts';
import { bounds } from '../../geometry/polygons.ts';
import { BoxIndex } from '../../geometry/BoxIndex.ts';
import { difference, intersection, totalArea } from '../surfaces/Regions.ts';
import { along, cross, dot, sub } from '../surfaces/Frame.ts';
import { createHardware, type FurnitureModel, type FurnitureOptions } from '../hardware/index.ts';
import { capSides, marqueeDepth } from '../hardware/Marquee.ts';
import { palette } from './Palette.ts';
import type { DistrictFeature } from './schema.ts';
import settings from './settings.json' with { type: 'json' };
import { invariant } from '../../errors.ts';

/** First stations of the repeating drain and cable pieces along every frontage. */
const FIRST = { inlet: 8, cable: 28 } as const;
const mm = (n: number) => Math.round(n * 1e6) / 1e6;

/** A run station: its centre, inward setback and the stations its run must stay within. */
interface Station { centre: number; setback: number; from: number; to: number; stretch?: boolean }

/** Whole pieces on shared two-metre stations, with source clearance checks. */
export class DistrictDetails {
  readonly features: DistrictFeature[] = [];
  private readonly placed = new BoxIndex<Ring>();
  private readonly drains = new BoxIndex<Ring>();
  private readonly models = new Map<string, FurnitureModel>();
  private readonly runs = new Map<string, number>();
  /** Station extents of the drain and cable pieces on each frontage. */
  private readonly hazards = new Map<string, [number, number][]>();
  private readonly excluded: BoxIndex<Ring>;
  private readonly crossings: BoxIndex<Ring>;
  private readonly obstacles: BoxIndex<NativeArchitecture['obstaclePoints'][number]>;

  constructor(architecture: NativeArchitecture) {
    const crossings = architecture.approaches.flatMap(approach => [approach.field, ...approach.landings]);
    this.excluded = new BoxIndex([...crossings, ...architecture.stationBays.map(bay => bay.footprint), ...architecture.shafts.map(shaft => shaft.ring)], bounds);
    this.crossings = new BoxIndex(crossings, bounds);
    this.obstacles = new BoxIndex(architecture.obstaclePoints, o => ({ min: [o.position[0] - o.clearance, o.position[1] - o.clearance],
      max: [o.position[0] + o.clearance, o.position[1] + o.clearance] }));
    const roads = new Map<string, NativeRoad>(architecture.roads.map(road => [road.id, road]));
    const marquee: [NativeOwner, NativeFrontage][] = [];
    for (const owner of architecture.owners) {
      if (owner.kind === 'median') {
        const median = architecture.medians?.find(value => value.id === owner.id), face = owner.frontages[0]!;
        for (const ornament of median?.ornaments ?? []) if (ornament.kind === 'tree') {
          const station = dot(sub(ornament.position, face.start), [face.inward[1], -face.inward[0]]) - 0.9;
          this.add(owner, face, 'tree-grate', station, 1.8, 1.8, dot(sub(ornament.position, face.start), face.inward));
        }
      }
      if (owner.kind !== 'block' && owner.kind !== 'perimeter' && owner.kind !== 'underpass') continue;
      const colors = palette(owner, architecture);
      for (const face of owner.frontages) {
        const highway = face.edgeIds.every(id => roads.get(id)?.kind === 'highway');
        // The highway side of an underpass is not paved here, so it carries nothing.
        if (highway && owner.kind === 'underpass') continue;
        if ((colors.luxury || owner.finish === 'industrial-yellow') && face.gutterWidth === marqueeDepth) marquee.push([owner, face]);
        // A frontage under a highway carries runs but no drains or cables. The grade side of an underpass carries runs only;
        // its drains and guards stay with the source.
        if (highway || owner.kind === 'underpass') continue;
        const rim = face.curbWidth + face.gutterWidth;
        for (const [kind, interval] of [['inlet', settings.drainInterval], ['cable', settings.cableInterval]] as const) {
          if (kind === 'cable' && !colors.luxury) continue;
          for (let station = FIRST[kind]; station + 2 <= face.length - settings.endClearance; station += interval) {
            if (!this.supports(owner, face, station, station + 2)) this.add(owner, face, kind, station, 2, rim, 0);
          }
        }
      }
      if (owner.kind === 'underpass') continue;
      for (const guard of owner.guards) {
        const n = ([[0, 1], [-1, 0], [0, -1], [1, 0]] as Vec2[])[guard.turn]!;
        const face = owner.frontages.find(face => face.inward.every((value, axis) => Math.abs(value - n[axis]!) < 1e-8)
          && Math.abs(dot(sub(guard.origin, face.start), n) - face.curbWidth - face.gutterWidth) < 1e-6);
        if (!face) throw invariant('District guard has no source frontage', { ownerId: owner.id, moduleId: guard.moduleId });
        const station = dot(sub(guard.origin, face.start), [n[1], -n[0]]);
        for (let i = 0; i < guard.count; i++) this.add(owner, face, 'guard', station + i * guard.step, 2, 0.4, face.curbWidth + face.gutterWidth);
      }
    }
    // Runs come last, so every drain and cable of the plan is known when their clearances are measured.
    for (const [owner, face] of marquee) this.marquees(owner, face);
  }

  dispose(): void { this.models.forEach(model => model.dispose()); this.models.clear(); }

  /**
   * Capped LED runs on a luxury or industrial-yellow frontage: centred on each parking strip and
   * midway between consecutive drain stations, at least `spacing` apart. A drain or cable within
   * its clearance rules such a station out; where the frontage or strip is short, or a crossing is
   * near, the station takes the longest composition that fits. A frontage those stations leave
   * bare tries the middle of each stretch clear of its own drains, cables and parking supports,
   * widest first, until one run fits. A start cap opens the run and an end cap closes it, their
   * cut corners outward.
   */
  private marquees(owner: NativeOwner, face: NativeFrontage): void {
    const centres: number[] = [];
    const candidates: Station[] = owner.parking.filter(bay => bay.frontageId === face.id)
      .map(bay => ({ centre: (bay.start + bay.end) / 2, setback: bay.depth, from: bay.start + 2, to: bay.end - 2 }));
    for (let centre = FIRST.inlet + 1 + settings.drainInterval / 2; centre < face.length; centre += settings.drainInterval)
      candidates.push({ centre, setback: 0, from: settings.endClearance, to: face.length - settings.endClearance });
    for (const candidate of candidates) {
      if (centres.some(other => Math.abs(other - candidate.centre) < settings.marquee.spacing - 1e-9)) continue;
      if (this.run(owner, face, candidate)) centres.push(candidate.centre);
    }
    if (!centres.length) this.stretches(owner, face).some(candidate => this.run(owner, face, candidate));
  }

  /** Places the longest run composition that fits at a station; false when none does. */
  private run(owner: NativeOwner, face: NativeFrontage, candidate: Station): boolean {
    const run = settings.marquee;
    for (const segments of run.segments) {
      const length = segments.reduce((sum, value) => sum + value, 2 * run.cap), a = candidate.centre - length / 2, b = candidate.centre + length / 2;
      if (a < candidate.from - 1e-9 || b > candidate.to + 1e-9 || !candidate.setback && this.supports(owner, face, a, b)) continue;
      const ring: Ring = [along(face, a, candidate.setback), along(face, b, candidate.setback),
        along(face, b, candidate.setback + face.gutterWidth), along(face, a, candidate.setback + face.gutterWidth)];
      if (near(this.drains, ring, run.drainClearance)) { if (candidate.stretch) continue; return false; }
      let station = a;
      const parts: [DistrictFeature['kind'], number, number][] = [['marquee-cap', run.cap, capSides.start],
        ...segments.map(value => ['marquee', value, 0] as [DistrictFeature['kind'], number, number]), ['marquee-cap', run.cap, capSides.end]];
      const fitted = parts.map(([kind, value, style]) => {
        const feature = this.fit(owner, face, kind, mm(station), value, face.gutterWidth, candidate.setback, style); station += value; return feature;
      });
      if (fitted.some(feature => !feature) || near(this.crossings, ring, run.crossingClearance)) continue;
      const index = this.runs.get(owner.id) ?? 0, message = settings.messages[index % settings.messages.length]!;
      this.runs.set(owner.id, index + 1);
      for (const feature of fitted as DistrictFeature[]) this.commit(feature.kind === 'marquee' ? { ...feature, message } : feature);
      return true;
    }
    return false;
  }

  /** Stations centred on the stretches of a frontage clear of its own drains, cables and parking supports, widest first. */
  private stretches(owner: NativeOwner, face: NativeFrontage): Station[] {
    const run = settings.marquee, from = settings.endClearance, to = face.length - settings.endClearance;
    const shortest = Math.min(...run.segments.map(segments => segments.reduce((sum, value) => sum + value, 2 * run.cap)));
    const blocked = [...(this.hazards.get(face.id) ?? []).map(([a, b]) => [a - run.drainClearance, b + run.drainClearance]),
      ...owner.parking.filter(bay => bay.frontageId === face.id).map(bay => [bay.support.start, bay.support.end]), [to, Infinity]]
      .sort((x, y) => x[0]! - y[0]!);
    const clear: [number, number][] = [];
    let start = from;
    for (const [a, b] of blocked) {
      if (Math.min(a!, to) - start >= shortest - 1e-9) clear.push([start, Math.min(a!, to)]);
      start = Math.max(start, b!);
    }
    return clear.sort((x, y) => y[1] - y[0] - (x[1] - x[0]) || x[0] - y[0])
      .map(([a, b]) => ({ centre: mm((a + b) / 2), setback: 0, from, to, stretch: true }));
  }

  /** Whether stations a..b reach a parking bay's support, where the kerb leaves the frontage. */
  private supports(owner: NativeOwner, face: NativeFrontage, a: number, b: number): boolean {
    return owner.parking.some(bay => bay.frontageId === face.id && b > bay.support.start && a < bay.support.end);
  }

  private add(owner: NativeOwner, face: NativeFrontage, kind: DistrictFeature['kind'], station: number, length: number, depth: number, setback: number): void {
    const feature = this.fit(owner, face, kind, station, length, depth, setback);
    if (feature) this.commit(feature);
  }

  private commit(feature: DistrictFeature): void {
    const box = bounds(feature.descriptor.footprint);
    this.features.push(feature); this.placed.add(feature.descriptor.footprint, box);
    if (feature.kind !== 'inlet' && feature.kind !== 'cable') return;
    this.drains.add(feature.descriptor.footprint, box);
    const list = this.hazards.get(feature.face.id) ?? this.hazards.set(feature.face.id, []).get(feature.face.id)!;
    list.push([feature.station, feature.station + feature.descriptor.length]);
  }

  /** The whole piece at its station, or null when it leaves its receiving ground or meets a reservation or placed piece. */
  private fit(owner: NativeOwner, face: NativeFrontage, kind: DistrictFeature['kind'], station: number, length: number, depth: number, setback: number, style = 0): DistrictFeature | null {
    const key = `${kind}:${length}:${depth}:${style}`;
    let model = this.models.get(key);
    if (!model) { model = createHardware({ kind, length, depth, style, damaged: false } satisfies FurnitureOptions); this.models.set(key, model); }
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const part of model.parts) {
      const positions = part.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) for (const [axis, value] of [positions.getX(i), positions.getY(i), positions.getZ(i)].entries()) {
        min[axis] = Math.min(min[axis]!, value); max[axis] = Math.max(max[axis]!, value);
      }
    }
    if (kind === 'inlet') { min[0] = -length / 2; max[0] = length / 2; min[2] = 0; max[2] = depth + 2; max[1] = Math.max(max[1]!, 0.2); }
    const a = station + length / 2 + min[0]!, b = station + length / 2 + max[0]!;
    const z0 = setback + min[2]!, z1 = setback + max[2]!;
    const footprint: Ring = [along(face, a, z0), along(face, b, z0), along(face, b, z1), along(face, a, z1)];
    const receiving = owner.ground.filter(field => !['guard', 'tree-grate'].includes(kind) || field.surface === 'sidewalk').map(field => field.ring);
    const box = bounds(footprint);
    if (totalArea(difference([footprint], receiving)) > 1e-7 || totalArea(intersection([footprint], this.excluded.near(box))) > 1e-7
      || this.placed.near(box).some(other => totalArea(intersection([footprint], [other])) > 1e-7)) return null;
    if (this.obstacles.near(box).some(point => Math.hypot(Math.max(box.min[0] - point.position[0], 0, point.position[0] - box.max[0]),
      Math.max(box.min[1] - point.position[1], 0, point.position[1] - box.max[1])) < point.clearance)) return null;
    const id = `${face.id}:${kind}:${station}:${setback}`;
    const feature: DistrictFeature = { owner, face, station, setback, kind, model,
      descriptor: { id, kind, ownerId: owner.id, frontageId: face.id, style, length, depth,
        bounds: { min: [Math.floor(box.min[0] * 1000) / 1000, Math.floor((face.roadTop + min[1]!) * 1000) / 1000, Math.floor(box.min[1] * 1000) / 1000],
          max: [Math.ceil(box.max[0] * 1000) / 1000, Math.ceil((face.roadTop + max[1]!) * 1000) / 1000, Math.ceil(box.max[1] * 1000) / 1000] }, footprint } };
    if (kind === 'inlet') {
      feature.cut = { id, kind: 'inlet', frontageId: face.id, start: station, end: station + length, setback, depth,
        ring: [along(face, station), along(face, station + length), along(face, station + length, depth), along(face, station, depth)] };
      feature.panel = [along(face, station, depth), along(face, station + 2, depth), along(face, station + 2, depth + 2), along(face, station, depth + 2)];
    }
    return feature;
  }
}

/** Whether a placed ring lies closer than the clearance to the given ring. */
function near(index: BoxIndex<Ring>, ring: Ring, clearance: number): boolean {
  const box = bounds(ring);
  return index.near({ min: [box.min[0] - clearance, box.min[1] - clearance], max: [box.max[0] + clearance, box.max[1] + clearance] })
    .some(other => gap(ring, other) < clearance - 1e-9);
}

/** Least plan distance between two simple rings; zero where they touch, cross or nest. */
function gap(a: Ring, b: Ring): number {
  const inside = (p: Vec2, ring: Ring) => {
    let odd = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, zi] = ring[i]!, [xj, zj] = ring[j]!;
      if ((zi > p[1]) !== (zj > p[1]) && p[0] < (xj - xi) * (p[1] - zi) / (zj - zi) + xi) odd = !odd;
    }
    return odd;
  };
  const edges = (ring: Ring) => ring.map((p, i) => [p, ring[(i + 1) % ring.length]!] as const);
  const crosses = ([p, q]: readonly [Vec2, Vec2], [r, s]: readonly [Vec2, Vec2]) => {
    const d = sub(q, p), e = sub(s, r), den = cross(d, e);
    if (Math.abs(den) < 1e-12) return false;
    const t = cross(sub(r, p), e) / den, u = cross(sub(r, p), d) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  };
  if (a.some(p => inside(p, b)) || b.some(p => inside(p, a)) || edges(a).some(x => edges(b).some(y => crosses(x, y)))) return 0;
  const toSegment = (p: Vec2, [s, e]: readonly [Vec2, Vec2]) => {
    const d = sub(e, s), length = dot(d, d), t = length ? Math.max(0, Math.min(1, dot(sub(p, s), d) / length)) : 0;
    return Math.hypot(p[0] - s[0] - t * d[0], p[1] - s[1] - t * d[1]);
  };
  let least = Infinity;
  for (const [points, ring] of [[a, b], [b, a]] as const) for (const p of points) for (const edge of edges(ring)) least = Math.min(least, toSegment(p, edge));
  return least;
}
