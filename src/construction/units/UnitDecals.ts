import type { NativeArchitecture } from '../../architecture/native-schema.ts';
import type { Vec2, Vec3 } from '../../geometry/schema.ts';
import { difference, intersection, rectangle, totalArea, union } from '../../geometry/polygons.ts';
import { artifactPlan } from '../markings/Artifacts.ts';
import { direction, distance, dot, sub } from '../surfaces/Frame.ts';
import { SurfaceBatch } from '../surfaces/SurfaceBatch.ts';
import { at } from '../markings/Paint.ts';
import type { RoadFrame } from '../markings/schema.ts';
import { pieceGeometry } from './PieceConstruction.ts';
import type { NativePieceData } from '../../assets/native-schema.ts';
import { canonical, UnitFrame } from './Frame.ts';

export interface UnitDecal { geometry: NativePieceData; frame: UnitFrame; scale: Vec3; owners: string[]; surface: string }

/** A scan quad retains the source footprint and UVs through its authored instance dimensions. */
export function unitDecals(a: NativeArchitecture, seed: number, wear: (p: Vec2) => number): UnitDecal[] {
  const fields = a.owners.flatMap(o => o.ground.filter(g => g.surface === 'roadway'));
  const domain = difference(union(fields.map(g => g.ring)), [...a.owners.flatMap(o => o.parking.map(p => p.footprint)), ...a.shafts.map(s => s.ring)]);
  const result: UnitDecal[] = [];
  for (const road of a.roads.filter(r => r.kind !== 'highway' && r.kind !== 'alley')) {
    const start = road.path[0]!, end = road.path.at(-1)!, d = direction(start, end), length = distance(start, end);
    const frame: RoadFrame = { road, start, end, d, n: [-d[1], d[0]], length, top: fields[0]?.top ?? 0 };
    const first = a.approaches.find(p => p.edgeId === road.id && p.nodeId === road.from), last = a.approaches.find(p => p.edgeId === road.id && p.nodeId === road.to);
    const laneStart = first ? Math.max(...first.field.map(p => dot(sub(p, start), d))) + 1.4 : 0;
    const laneEnd = last ? Math.min(...last.field.map(p => dot(sub(p, start), d))) - 1.4 : length;
    for (const mark of artifactPlan(frame, laneStart, laneEnd, seed, wear)) {
      const pose = new UnitFrame(at(frame, mark.station, mark.offset), d, frame.top);
      const ring = rectangle(-mark.length / 2, -mark.width / 2, mark.length, mark.width).map(pose.world);
      const received = intersection([ring], domain); if (totalArea(received) <= 1e-10) continue;
      const normalized = canonical(received.map(r => r.map(p => { const v = pose.local(p); return [v[0] / mark.length, v[1] / mark.width] as Vec2; })));
      const batch = new SurfaceBatch({ ownerId: 'decal', groundIds: ['decal'], roadTop: 0, wear: () => 0 });
      batch.polygon(mark.surface, normalized, mark.height - frame.top, p => [p[0] + 0.5, 0.5 - p[1]], false);
      const owners = [...new Set(fields.filter(g => totalArea(intersection([g.ring], received)) > 1e-10).map(g => g.ownerId))];
      result.push({ geometry: pieceGeometry('decal', [batch.finish()]), frame: pose, scale: [mark.length, 1, mark.width], owners, surface: mark.surface });
    }
  }
  return result;
}
