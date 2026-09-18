import { invariant } from '../../errors.ts';
import type { NativeApproach, NativeArchitecture, NativeLane, NativeOwner, NativeRoad, NativeTurn } from '../../architecture/native-schema.ts';
import type { Box2, Vec2 } from '../../geometry/schema.ts';
import { bounds, intersects } from '../../geometry/polygons.ts';
import { direction, distance, dot, sub } from '../surfaces/Frame.ts';
import { difference } from '../surfaces/Regions.ts';
import { SurfaceBatch } from '../surfaces/SurfaceBatch.ts';
import { Paint } from './Paint.ts';
import { Crosswalk } from './Crosswalk.ts';
import { arrows } from './Arrows.ts';
import { artifacts } from './Artifacts.ts';
import type { RoadFrame } from './schema.ts';

interface Approach { approach: NativeApproach; min: number; max: number; first: boolean }
interface RoadPlan {
  road: NativeRoad; start: Vec2; end: Vec2; d: Vec2; n: Vec2; length: number;
  approaches: Approach[]; laneStart: number; laneEnd: number; lanes: NativeLane[]; turns: NativeTurn[]; reach: Box2;
}

// No mark sits further than this from the lane band or an approach field: arrows reach 4.7 + 1.8 m
// along the frame, crossings 3.2 m, and the widest silhouette 1.15 m past the carriageway edge.
const REACH = 8, SPREAD = 2;

export class Markings {
  private readonly architecture: NativeArchitecture;
  private readonly seed: number;
  private readonly wear: (point: Vec2) => number;
  private readonly plans: RoadPlan[];
  constructor(architecture: NativeArchitecture, seed: number, wear: (point: Vec2) => number) {
    this.architecture = architecture; this.seed = seed; this.wear = wear; this.plans = plan(architecture);
  }
  build(owner: NativeOwner, batch: SurfaceBatch): void {
    const fields = owner.ground.filter(ground => ground.surface === 'roadway');
    if (!fields.length) return;
    const top = fields[0]!.top;
    if (fields.some(field => field.top !== top)) throw invariant('Road paint owner has incompatible levels', { ownerId: owner.id });
    const domain = difference(fields.map(field => field.ring), [...owner.parking.map(bay => bay.footprint), ...this.architecture.shafts.map(shaft => shaft.ring)]);
    const received = bounds(fields.flatMap(field => field.ring));
    const paint = new Paint(batch, domain, this.seed), crossing = new Crosswalk(paint, this.seed);
    for (const road of this.plans) {
      if (!intersects(road.reach, received)) continue;
      const { laneStart, laneEnd, lanes } = road, frame: RoadFrame = { road: road.road, start: road.start, end: road.end, d: road.d, n: road.n, length: road.length, top };
      for (const side of [-1,1]) {
        paint.strip(frame,laneStart,laneEnd,side*(road.road.width/2-(this.architecture.format==='district'?0.16:0.65)),0.12,'whitePaint');
        if (road.road.lanes.length > 1) paint.strip(frame,laneStart,laneEnd,side*((road.road.medianWidth??0)/2+0.11),0.1,'yellowPaint');
      }
      for(let i=0;i<lanes.length-1;i++){
        if(lanes[i]!.direction!==lanes[i+1]!.direction)continue;
        const offset=(lanes[i]!.offset-lanes[i]!.width/2+lanes[i+1]!.offset+lanes[i+1]!.width/2)/2;
        for(let s=Math.ceil(laneStart/6)*6;s+3<=laneEnd;s+=6)paint.strip(frame,s,s+3,offset,0.12,'whitePaint');
      }
      for (const item of road.approaches) {
        crossing.build(frame,(item.min+item.max-crossing.depth(frame))/2,item.first?0:road.length);
        const sign=item.first?1:-1, edge=item.first?item.max:item.min;
        if (road.road.lanes.length===4) {
          const incoming=road.road.lanes.filter(lane=>lane.direction===(item.first?'backward':'forward'));
          if(incoming.length) for(const offset of [0.4,1.05]) paint.bar(frame,edge+sign*offset,
            Math.min(...incoming.map(lane=>lane.offset-lane.width/2))+0.4,Math.max(...incoming.map(lane=>lane.offset+lane.width/2))-0.1,0.24,'whitePaint');
        }
        if(laneEnd-laneStart>20) arrows(paint,frame,edge+sign*4.7,item.approach.nodeId,road.turns);
      }
      artifacts(paint,frame,laneStart,laneEnd,this.seed,this.wear);
    }
  }
}

/** Road frames, approach stations and legal turns do not depend on the receiving owner, so each is read once. */
function plan(architecture: NativeArchitecture): RoadPlan[] {
  const byEdge = new Map<string, NativeApproach[]>(), byNode = new Map<string, NativeTurn[]>();
  for (const approach of architecture.approaches) byEdge.set(approach.edgeId, [...byEdge.get(approach.edgeId) ?? [], approach]);
  for (const turn of architecture.turns) byNode.set(turn.nodeId, [...byNode.get(turn.nodeId) ?? [], turn]);
  const plans: RoadPlan[] = [];
  for (const road of architecture.roads) {
    if (road.kind === 'highway' || road.kind === 'alley') continue;
    const start = road.path[0]!, end = road.path.at(-1)!, d = direction(start, end), length = distance(start, end);
    if (road.path.some(point => Math.abs((point[0]-start[0])*d[1]-(point[1]-start[1])*d[0]) > 1e-7)) throw invariant('Native road paint requires an authored straight frame', { roadId: road.id });
    const approaches = (byEdge.get(road.id) ?? []).map(approach => {
      const stations = approach.field.map(point => dot(sub(point, start), d));
      return { approach, min: Math.min(...stations), max: Math.max(...stations), first: approach.nodeId === road.from };
    });
    for (const item of approaches) if (item.max - item.min < 2.8 - 1e-7) throw invariant('Crossing field cannot receive source markings', { approachId: item.approach.id });
    const a = approaches.find(item => item.first), b = approaches.find(item => !item.first);
    const nodes = new Set(approaches.map(item => item.approach.nodeId));
    const stations = [0, length, ...approaches.flatMap(item => [item.min, item.max])], n: Vec2 = [-d[1], d[0]];
    const across = road.width / 2 + SPREAD;
    const corners: Vec2[] = [];
    for (const station of [Math.min(...stations) - REACH, Math.max(...stations) + REACH]) for (const offset of [-across, across])
      corners.push([start[0] + d[0] * station + n[0] * offset, start[1] + d[1] * station + n[1] * offset]);
    plans.push({ road, start, end, d, n, length, approaches, laneStart: a ? a.max + 1.4 : 0, laneEnd: b ? b.min - 1.4 : length,
      lanes: [...road.lanes].sort((first, second) => second.offset - first.offset),
      turns: [...nodes].flatMap(nodeId => byNode.get(nodeId) ?? []), reach: bounds(corners) });
  }
  return plans;
}
