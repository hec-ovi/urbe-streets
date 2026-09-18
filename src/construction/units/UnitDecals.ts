import type { NativeArchitecture } from '../../architecture/native-schema.ts';
import type { Ring, Vec2 } from '../../geometry/schema.ts';
import type { StreetPlacement } from '../../schema/street-kit.ts';
import { difference, intersection, rectangle, totalArea, union } from '../../geometry/polygons.ts';
import { artifactPlan } from '../markings/Artifacts.ts';
import { direction, distance, dot, sub } from '../surfaces/Frame.ts';
import { at } from '../markings/Paint.ts';
import type { RoadFrame } from '../markings/schema.ts';
import { scanAtlas } from './OverlayPieces.ts';
import { placement } from './UnitOverlays.ts';
import { UnitFrame } from './Frame.ts';

/** A scan quad retains the source footprint and UVs through its authored instance dimensions. */
export function unitDecals(a: NativeArchitecture, seed: number, wear: (p: Vec2) => number, excluded: Ring[]): StreetPlacement[] {
  const fields = a.owners.flatMap(o => o.ground.filter(g => g.surface === 'roadway'));
  const domain = difference(union(fields.map(g => g.ring)), [...a.owners.flatMap(o => o.parking.map(p => p.footprint)), ...a.shafts.map(s => s.ring), ...excluded]);
  const result: StreetPlacement[] = [];
  for (const road of a.roads.filter(r => r.kind !== 'highway' && r.kind !== 'alley')) {
    const start = road.path[0]!, end = road.path.at(-1)!, d = direction(start, end), length = distance(start, end);
    const frame: RoadFrame = { road, start, end, d, n: [-d[1], d[0]], length, top: fields[0]?.top ?? 0 };
    const first = a.approaches.find(p => p.edgeId === road.id && p.nodeId === road.from), last = a.approaches.find(p => p.edgeId === road.id && p.nodeId === road.to);
    const laneStart = first ? Math.max(...first.field.map(p => dot(sub(p, start), d))) + 1.4 : 0;
    const laneEnd = last ? Math.min(...last.field.map(p => dot(sub(p, start), d))) - 1.4 : length;
    for (const mark of artifactPlan(frame, laneStart, laneEnd, seed, wear)) {
      const pose = new UnitFrame(at(frame, mark.station, mark.offset), d, frame.top);
      const ring = rectangle(-mark.length / 2, -mark.width / 2, mark.length, mark.width).map(pose.world);
      if (totalArea(intersection([ring], [...excluded, ...a.shafts.map(s => s.ring)])) > 1e-9) continue;
      const received = intersection([ring], domain); if (totalArea(received) <= 1e-10) continue;
      const owners = a.owners.filter(o => totalArea(intersection([ring], o.ground.map(g => g.ring))) > 1e-9).map(o => o.id);
      result.push({ ...placement('overlay/scan', new UnitFrame([pose.position[0], pose.position[2]], d, mark.height), owners),
        scale: [mark.length, 1, mark.width], scan: { offset: [scanAtlas.indexOf(mark.surface) / scanAtlas.length, 0], scale: [1 / scanAtlas.length, 1] } });
    }
  }
  return result;
}
