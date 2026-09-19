import type { NativeApproach, NativeArchitecture, NativeRoad } from '../../architecture/native-schema.ts';
import type { Box2, Ring, Vec2 } from '../../geometry/schema.ts';
import type { StreetClass, StreetClosure, StreetKitPiece } from '../../schema/street-kit.ts';
import { bounds, difference, intersection, rectangle, totalArea, union } from '../../geometry/polygons.ts';
import { BoxIndex } from '../../geometry/BoxIndex.ts';
import { direction, distance, dot, sub } from '../surfaces/Frame.ts';
import { invariant } from '../../errors.ts';
import { clean, UnitFrame } from './Frame.ts';

export interface UnitRegion {
  kind: Exclude<StreetKitPiece['kind'], 'prop' | 'overlay'>;
  frame: UnitFrame;
  mask: Ring[];
  box: Box2;
  roads: NativeRoad[];
  length: number;
  zone: string;
}

/** The only spatial partition is the authored run and its junctions. Cells are placement metadata. */
export class UnitPlan {
  readonly regions: UnitRegion[] = [];
  readonly closures: StreetClosure[] = [];
  constructor(a: NativeArchitecture) {
    const roads = a.roads.filter((r): r is NativeRoad & { kind: StreetClass } => r.kind !== 'highway');
    const ground = union(a.owners.filter(o => o.kind !== 'station').flatMap(o => o.ground.map(g => g.ring)));
    const byEdge = new Map<string, NativeApproach[]>();
    for (const approach of a.approaches) byEdge.set(approach.edgeId, [...byEdge.get(approach.edgeId) ?? [], approach]);
    const rims = new Map<string, number>();
    for (const owner of a.owners) if (owner.kind !== 'median') for (const f of owner.frontages) {
      const rim = f.pavedWidth + f.curbWidth + f.gutterWidth;
      for (const edgeId of f.edgeIds) rims.set(edgeId, Math.max(rims.get(edgeId) ?? 0, rim));
    }
    const corridors = new BoxIndex<Ring>();
    for (const road of roads) {
      const first = road.path[0]!, last = road.path.at(-1)!, d = direction(first, last), length = distance(first, last);
      if (road.path.some(p => Math.abs(dot(sub(p, first), [-d[1], d[0]])) > 1e-7)) throw invariant('Street units require a straight Atlas edge', { roadId: road.id });
      const approaches = byEdge.get(road.id) ?? [];
      const crossingStart = clean(Math.max(0, ...approaches.filter(p => p.nodeId === road.from).flatMap(p => p.field.map(v => dot(sub(v, first), d)))));
      const crossingEnd = clean(Math.min(length, ...approaches.filter(p => p.nodeId === road.to).flatMap(p => p.field.map(v => dot(sub(v, first), d)))));
      const arm = crossingEnd - crossingStart >= 16 ? 8 : 0;
      const start = clean(crossingStart + (approaches.some(p => p.nodeId === road.from) ? arm : 0));
      const end = clean(crossingEnd - (approaches.some(p => p.nodeId === road.to) ? arm : 0));
      const clearLength = clean(Math.max(0, end - start)), units = Math.floor(clearLength / 2);
      const fittedLength = clean(clearLength - units * 2);
      const segments = Math.floor(units / 4), halfSegments = Math.floor(units % 4 / 2), quarterSegments = units % 2;
      if (halfSegments || quarterSegments || fittedLength) this.closures.push({ roadId: road.id, length: clean(length), start, end, clearLength, segments, halfSegments, quarterSegments, fittedLength });
      const width = road.width / 2 + (rims.get(road.id) ?? 0);
      let station = start;
      for (const span of [...Array<number>(segments).fill(8), ...(halfSegments ? [4] : []), ...(quarterSegments ? [2] : []), ...(fittedLength ? [fittedLength] : [])]) {
        const frame = new UnitFrame([first[0] + d[0] * station, first[1] + d[1] * station], d);
        const mask = [rectangle(0, -width, span, width * 2).map(frame.world)];
        const box = bounds(mask.flat()), received = difference(mask, corridors.near(box));
        if (totalArea(received) > 1e-9) this.regions.push(this.region('segment', frame, received, [road], road.districtStyle ?? 'ordinary', span));
        corridors.add(mask[0]!, box); station = clean(station + span);
      }
    }
    const remaining = difference(ground, corridors.all);
    const nodes = new Map<string, { point: Vec2; roads: NativeRoad[] }>();
    for (const road of roads) for (const [id, point] of [[road.from, road.path[0]!], [road.to, road.path.at(-1)!]] as const) {
      const entry = nodes.get(id) ?? { point, roads: [] }; entry.roads.push(road); nodes.set(id, entry);
    }
    let unassigned = remaining;
    for (const [id, node] of nodes) {
      // Orthogonal Atlas junctions own the residue up to the midpoint of their incident edges.
      let x0 = a.bounds.min[0], x1 = a.bounds.max[0], z0 = a.bounds.min[1], z1 = a.bounds.max[1];
      for (const road of node.roads) {
        const other = road.from === id ? road.path.at(-1)! : road.path[0]!;
        if (other[0] < node.point[0] - 1e-7) x0 = Math.max(x0, (node.point[0] + other[0]) / 2);
        if (other[0] > node.point[0] + 1e-7) x1 = Math.min(x1, (node.point[0] + other[0]) / 2);
        if (other[1] < node.point[1] - 1e-7) z0 = Math.max(z0, (node.point[1] + other[1]) / 2);
        if (other[1] > node.point[1] + 1e-7) z1 = Math.min(z1, (node.point[1] + other[1]) / 2);
      }
      const domain = intersection(unassigned, [rectangle(x0, z0, x1 - x0, z1 - z0)]);
      if (totalArea(domain) < 1e-8) continue;
      unassigned = difference(unassigned, domain);
      const frame = new UnitFrame(node.point), local = domain.map(r => r.map(frame.local)), box = bounds(local.flat());
      const horizontal = node.roads.filter(r => Math.abs(r.path[0]![1] - r.path.at(-1)![1]) < 1e-7);
      const vertical = node.roads.filter(r => Math.abs(r.path[0]![0] - r.path.at(-1)![0]) < 1e-7);
      const hx = Math.max(0, ...vertical.map(r => r.width / 2)), hz = Math.max(0, ...horizontal.map(r => r.width / 2));
      const zone = node.roads.some(r => r.districtStyle === 'luxury') ? 'luxury' : node.roads.some(r => r.districtStyle === 'industrial') ? 'industrial' : 'ordinary';
      const center = hx && hz ? intersection(local, [rectangle(-hx, -hz, hx * 2, hz * 2)]) : [];
      if (totalArea(center) > 1e-8) this.regions.push(this.region('junction-center', frame, center.map(r => r.map(frame.world)), node.roads, zone));
      let arms = difference(local, center);
      const reach = Math.max(...box.min.map(Math.abs), ...box.max.map(Math.abs)) + hx + hz + 1;
      for (const [mask, direction] of [
        [[[hx, -hz], [reach, -hz - reach + hx], [reach, hz + reach - hx], [hx, hz]], [1, 0]],
        [[[-hx, hz], [-reach, hz + reach - hx], [-reach, -hz - reach + hx], [-hx, -hz]], [-1, 0]],
        [[[hx, hz], [hx + reach - hz, reach], [-hx - reach + hz, reach], [-hx, hz]], [0, 1]],
        [[[-hx, -hz], [-hx - reach + hz, -reach], [hx + reach - hz, -reach], [hx, -hz]], [0, -1]],
      ] as [Ring, Vec2][]) {
        if (totalArea([mask]) <= 1e-10) continue;
        const part = intersection(arms, [mask]); if (totalArea(part) <= 1e-8) continue;
        arms = difference(arms, part);
        this.regions.push(this.region('junction-arm', new UnitFrame(node.point, direction), part.map(r => r.map(frame.world)), node.roads, zone));
      }
      if (totalArea(arms) > 1e-7) this.regions.push(this.region('junction-arm', frame, arms.map(r => r.map(frame.world)), node.roads, zone));
    }
    if (totalArea(unassigned) > 1e-7) throw invariant('Street units leave ground outside every run and junction', { area: totalArea(unassigned) });
  }

  private region(kind: UnitRegion['kind'], frame: UnitFrame, mask: Ring[], roads: NativeRoad[], zone: string, length = 0): UnitRegion {
    return { kind, frame, mask, box: bounds(mask.flat()), roads, length, zone };
  }
}
