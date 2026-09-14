import { invariant } from '../../errors.ts';
import type { NativeArchitecture, NativeOwner } from '../../architecture/native-schema.ts';
import type { Ring, Vec2 } from '../../geometry/schema.ts';
import { bounds, intersects } from '../../geometry/polygons.ts';
import { difference, intersection, totalArea, area } from './Regions.ts';
import { BoundaryIndex, segment, type BoundarySegment } from './BoundaryIndex.ts';
import { SurfaceBatch } from './SurfaceBatch.ts';
import type { SurfaceCut } from './schema.ts';

type Edge = BoundarySegment & { previous?: BoundarySegment; next?: BoundarySegment };
const key = (p: Vec2) => `${p[0].toFixed(8)}:${p[1].toFixed(8)}`;
const move = (p: Vec2, d: Vec2, distance: number): Vec2 => [p[0] + d[0] * distance, p[1] + d[1] * distance];

/** Source EdgeRing profile and two-metre scan stations, fitted to actual road/gutter/curb contacts. */
export class EdgeRing {
  private readonly road: BoundaryIndex;
  private readonly curb: BoundaryIndex;
  private readonly gutter: BoundaryIndex;
  private readonly edges: Edge[];
  private readonly joins = new Map<string, Vec2>();
  constructor(architecture: Pick<NativeArchitecture, 'owners'>) {
    const fields = architecture.owners.flatMap(owner => owner.ground);
    this.road = new BoundaryIndex(fields.filter(field => field.surface === 'roadway').map(field => field.ring));
    this.curb = new BoundaryIndex(fields.filter(field => field.surface === 'curb').map(field => field.ring));
    this.gutter = new BoundaryIndex(fields.filter(field => field.surface === 'gutter').map(field => field.ring));
    const unique = new Map<string, BoundarySegment>();
    for (const field of fields.filter(field => field.surface === 'gutter')) for (const edge of this.road.contacts(field.ring)) unique.set(`${key(edge.a)}:${key(edge.b)}`, edge);
    const points = new Map<string, Vec2>();
    const canonical = (p: Vec2): Vec2 => { const id = key(p), previous = points.get(id); if (previous) return previous; points.set(id, p); return p; };
    const values = [...unique.values()].map(edge => segment(canonical(edge.a), canonical(edge.b)));
    const starts = new Map<string, BoundarySegment>(), ends = new Map<string, BoundarySegment>();
    for (const edge of values) { starts.set(key(edge.a), edge); ends.set(key(edge.b), edge); }
    this.edges = values.map(edge => ({ ...edge, ...(ends.has(key(edge.a)) ? { previous: ends.get(key(edge.a))! } : {}),
      ...(starts.has(key(edge.b)) ? { next: starts.get(key(edge.b))! } : {}) }));
  }

  build(owner: NativeOwner, batch: SurfaceBatch, cuts: readonly SurfaceCut[], shafts: readonly Ring[]): number {
    const openings = [...shafts, ...cuts.filter(cut => cut.kind === 'inlet').map(cut => cut.ring)];
    const curb = difference(owner.ground.filter(field => field.surface === 'curb').map(field => field.ring), openings);
    const gutter = difference(owner.ground.filter(field => field.surface === 'gutter').map(field => field.ring), openings);
    if (!curb.length && !gutter.length) return 0;
    const datum = owner.frontages[0]; if (!datum) throw invariant('Street edge owner has no authored datum', { ownerId: owner.id });
    const top = datum.pavedTop, road = datum.roadTop, crown = road + 0.06;
    batch.polygon('joint', curb, top - 0.007, p => p, true, true);
    batch.polygon('joint', gutter, road - 0.02, p => p, true, true);
    let remainingCurb = curb, remainingGutter = gutter, groups = 0;
    const box = bounds([...curb, ...gutter].flat());
    for (const edge of this.edges) {
      const maskBounds = bounds([this.join(edge, false, -1), this.join(edge, true, -1), this.join(edge, false, 1), this.join(edge, true, 1)]);
      if (!intersects(box, maskBounds)) continue;
      const stations = new Set([0, edge.length]);
      for (let s = 2; s < edge.length; s += 2) stations.add(s);
      for (const cut of cuts.filter(cut => cut.kind === 'inlet')) for (const point of cut.ring.slice(0, 2)) {
        const across = (point[0] - edge.a[0]) * edge.n[0] + (point[1] - edge.a[1]) * edge.n[1];
        const station = (point[0] - edge.a[0]) * edge.d[0] + (point[1] - edge.a[1]) * edge.d[1];
        if (Math.abs(across) < 1e-7 && station > 0 && station < edge.length) stations.add(station);
      }
      const ordered = [...stations].sort((a, b) => a - b);
      for (let index = 0; index < ordered.length - 1; index++) {
        const start = ordered[index]!, end = ordered[index + 1]!, mask = this.mask(edge, start, end, 0);
        const channel = intersection(remainingGutter, [mask]);
        if (totalArea(channel) > 1e-12) {
          const transverse = (p: Vec2) => {
            const r = this.road.distance(p), c = this.curb.distance(p), width = r + c;
            if (!Number.isFinite(width) || width <= 0) throw invariant('Gutter lacks its two physical interfaces', { ownerId: owner.id, point: p });
            return r / width;
          };
          batch.polygon('gutter', channel, p => road + transverse(p) * 0.06,
            p => [((p[0] - edge.a[0]) * edge.d[0] + (p[1] - edge.a[1]) * edge.d[1] - start) / 2, transverse(p)]);
          remainingGutter = difference(remainingGutter, [mask]);
        }
        const claim = intersection(remainingCurb, [mask]);
        if (totalArea(claim) > 1e-12) {
          const bodyMask = end - start > 0.006 ? [this.mask(edge, start, end, 0.003)] : [];
          const body = intersection(claim, bodyMask);
          const joints = difference(claim, bodyMask);
          for (const ring of joints) this.walls(batch, 'joint', ring, crown, top - 0.007, true);
          const origin = start === 0 ? this.join(edge, false, 0.3) : move(move(edge.a, edge.d, start), edge.n, 0.3);
          batch.polygon('curb', body, top, p => [((p[0] - origin[0]) * edge.d[0] + (p[1] - origin[1]) * edge.d[1]) / 2,
            ((p[0] - origin[0]) * edge.n[0] + (p[1] - origin[1]) * edge.n[1]) / 0.2]);
          for (const ring of body) this.walls(batch, 'curb', ring, crown, top);
          remainingCurb = difference(remainingCurb, [mask]); groups++;
        }
      }
    }
    const missingCurb = totalArea(remainingCurb), missingGutter = totalArea(remainingGutter);
    if (missingCurb > 1e-7 || missingGutter > 1e-7) throw invariant('Authored edge contacts do not cover the street bands', { ownerId: owner.id, missingCurb, missingGutter });
    for (const cut of cuts.filter(cut => cut.kind === 'inlet')) {
      const frontage = owner.frontages.find(frontage => frontage.id === cut.frontageId);
      if (!frontage) throw invariant('Inlet has no source frontage', { featureId: cut.id });
      const n = frontage.inward, d: Vec2 = [n[1], -n[0]];
      for (const [station, reverse] of [[cut.start, false], [cut.end, true]] as const) {
        const a = move(frontage.start, d, station), b = move(a, n, 0.3), pan = road - 0.02;
        const vertices: [number, number, number][] = [[a[0], pan, a[1]], [a[0], road, a[1]], [b[0], crown, b[1]], [b[0], pan, b[1]]];
        const uv: [number, number][] = [[0, 0], [0, 0.1], [0.15, 0.4], [0.15, 0]];
        if (reverse) { vertices.reverse(); uv.reverse(); }
        batch.face('gutter', vertices, uv);
      }
    }
    return groups;
  }

  private join(edge: Edge, end: boolean, depth: number): Vec2 {
    const p = end ? edge.b : edge.a, other = end ? edge.next : edge.previous;
    const id = `${key(p)}:${depth}`, existing = this.joins.get(id); if (existing) return existing;
    if (!other) { const result = move(p, edge.n, depth); this.joins.set(id, result); return result; }
    const denominator = 1 + edge.n[0] * other.n[0] + edge.n[1] * other.n[1];
    if (denominator < 1e-9) throw invariant('Street edge contact reverses direction', { point: p });
    const result: Vec2 = [p[0] + (edge.n[0] + other.n[0]) * depth / denominator, p[1] + (edge.n[1] + other.n[1]) * depth / denominator];
    this.joins.set(id, result); return result;
  }
  private mask(edge: Edge, start: number, end: number, gap: number): Ring {
    const at = (station: number, depth: number, first: boolean): Vec2 => {
      const p = station === 0 ? this.join(edge, false, depth) : station === edge.length ? this.join(edge, true, depth)
        : move(move(edge.a, edge.d, station), edge.n, depth);
      return move(p, edge.d, first ? gap : -gap);
    };
    const polygon = [at(start, -1, true), at(end, -1, false), at(end, 1, false), at(start, 1, true)];
    return area(polygon) > 0 ? polygon : [...polygon].reverse();
  }
  private walls(batch: SurfaceBatch, surface: string, ring: Ring, low: number, high: number, exposedOnly = false): void {
    ring.forEach((a, i) => {
      const b = ring[(i + 1) % ring.length]!, length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!length) return;
      const exposed = this.gutter.distance([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]) < 1e-7;
      if (exposedOnly && !exposed) return;
      const bottom = exposed ? low : high - 0.007;
      batch.face(surface, [[a[0], bottom, a[1]], [a[0], high, a[1]], [b[0], high, b[1]], [b[0], bottom, b[1]]],
        [[0, 0], [0, (high - bottom) / 0.2], [length / 2, (high - bottom) / 0.2], [length / 2, 0]]);
    });
  }
}
