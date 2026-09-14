import type { NativeTurn } from '../../architecture/native-schema.ts';
import type { Vec2 } from '../../geometry/schema.ts';
import { dot, sub } from '../surfaces/Frame.ts';
import { Paint, at } from './Paint.ts';
import type { RoadFrame } from './schema.ts';

/** Original arrow outline, using each arriving Atlas lane's legal exits. */
export function arrows(paint: Paint, frame: RoadFrame, station: number, nodeId: string, turns: NativeTurn[]): void {
  for (const lane of frame.road.lanes) {
    const sign = lane.direction === 'forward' ? 1 : -1;
    if ((sign === 1 ? frame.road.to : frame.road.from) !== nodeId) continue;
    const exits = new Set(turns.filter(turn => turn.nodeId === nodeId && turn.fromLaneId === lane.id && turn.level === 0).map(turn => turn.kind));
    if (![...exits].some(kind => kind !== 'u-turn')) continue;
    const shape: Vec2[] = [[-1.8, -0.12]];
    if (exits.has('right')) shape.push([-0.35,-0.12],[-0.35,-0.3],[-0.28,-0.46],[-0.55,-0.46],[-0.08,-1.15],[0.55,-0.46],[0.2,-0.46],[0.2,-0.12]);
    if (exits.has('through')) shape.push([0.7,-0.12],[0.7,-0.5],[1.8,0],[0.7,0.5],[0.7,0.12]);
    else shape.push([0.2,-0.12],[0.2,0.12]);
    if (exits.has('left')) shape.push([0.2,0.12],[0.2,0.46],[0.55,0.46],[-0.08,1.15],[-0.55,0.46],[-0.28,0.46],[-0.35,0.3],[-0.35,0.12]);
    shape.push([-1.8,0.12]);
    const origin = at(frame, station, lane.offset);
    paint.polygon('whitePaint', shape.map(([x,z]) => at(frame, station + x * sign, lane.offset + z * sign)), frame.top + 0.008,
      p => [dot(sub(p, origin), frame.d) / 2.7 + station * 0.31, 0.5 + dot(sub(p, origin), frame.n) * 0.18]);
  }
}
