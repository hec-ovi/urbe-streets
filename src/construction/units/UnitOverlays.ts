import type { NativeArchitecture } from '../../architecture/native-schema.ts';
import type { StreetPlacement } from '../../schema/street-kit.ts';
import type { Ring, Vec2 } from '../../geometry/schema.ts';
import { intersection, totalArea } from '../../geometry/polygons.ts';
import { direction, distance, dot, sub } from '../surfaces/Frame.ts';
import { arrowId, turnKinds } from './OverlayPieces.ts';
import { UnitFrame } from './Frame.ts';

export function placement(piece: string, frame: UnitFrame, ownerIds: string[]): StreetPlacement {
  return { piece, position: frame.position, rotationY: frame.rotationY,
    cell: [Math.floor(frame.position[0] / 128), Math.floor(frame.position[2] / 128)], ownerId: ownerIds[0]!, ownerIds };
}

/** Legal arrows use the source lane anchor and the complete shared silhouette. */
export function turnPlacements(a: NativeArchitecture, excluded: Ring[]): StreetPlacement[] {
  const result: StreetPlacement[] = [];
  for (const road of a.roads.filter(r => r.kind !== 'highway' && r.kind !== 'alley')) {
    const first = road.path[0]!, last = road.path.at(-1)!, d = direction(first, last), length = distance(first, last);
    const approaches = a.approaches.filter(p => p.edgeId === road.id).map(p => ({ p,
      stations: p.field.map(v => dot(sub(v, first), d)) }));
    const start = approaches.find(v => v.p.nodeId === road.from), end = approaches.find(v => v.p.nodeId === road.to);
    if ((end ? Math.min(...end.stations) - 1.4 : length) - (start ? Math.max(...start.stations) + 1.4 : 0) <= 20) continue;
    for (const { p, stations } of approaches) for (const lane of road.lanes) {
      const sign = lane.direction === 'forward' ? 1 : -1;
      if ((sign === 1 ? road.to : road.from) !== p.nodeId) continue;
      const kinds = turnKinds.filter(kind => a.turns.some(t => t.nodeId === p.nodeId && t.fromLaneId === lane.id && t.level === 0 && t.kind === kind));
      if (!kinds.length) continue;
      const station = p.nodeId === road.from ? Math.max(...stations) + 4.7 : Math.min(...stations) - 4.7;
      const point: Vec2 = [first[0] + d[0] * station - d[1] * lane.offset, first[1] + d[1] * station + d[0] * lane.offset];
      const frame = new UnitFrame(point, [d[0] * sign, d[1] * sign]);
      const shape: Ring = [[-1.8, -1.15], [1.8, -1.15], [1.8, 1.15], [-1.8, 1.15]];
      const box = shape.map(frame.world);
      if (totalArea(intersection([box], excluded)) > 1e-9) continue;
      result.push(placement(arrowId(kinds), frame, ['roadway']));
    }
  }
  return result;
}
