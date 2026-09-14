import { invariant } from '../../errors.ts';
import type { NativeArchitecture, NativeOwner } from '../../architecture/native-schema.ts';
import type { Vec2 } from '../../geometry/schema.ts';
import { direction, distance, dot, sub } from '../surfaces/Frame.ts';
import { difference } from '../surfaces/Regions.ts';
import { SurfaceBatch } from '../surfaces/SurfaceBatch.ts';
import { Paint } from './Paint.ts';
import { Crosswalk } from './Crosswalk.ts';
import { arrows } from './Arrows.ts';
import { artifacts } from './Artifacts.ts';
import type { RoadFrame } from './schema.ts';

export class Markings {
  private readonly architecture: NativeArchitecture;
  private readonly seed: number;
  private readonly wear: (point: Vec2) => number;
  constructor(architecture: NativeArchitecture, seed: number, wear: (point: Vec2) => number) { this.architecture = architecture; this.seed = seed; this.wear = wear; }
  build(owner: NativeOwner, batch: SurfaceBatch): void {
    const fields = owner.ground.filter(ground => ground.surface === 'roadway');
    if (!fields.length) return;
    const top = fields[0]!.top;
    if (fields.some(field => field.top !== top)) throw invariant('Road paint owner has incompatible levels', { ownerId: owner.id });
    const domain = difference(fields.map(field => field.ring), [...owner.parking.map(bay => bay.footprint), ...this.architecture.shafts.map(shaft => shaft.ring)]);
    const paint = new Paint(batch, domain, this.seed), crossing = new Crosswalk(paint, this.seed);
    for (const road of this.architecture.roads) {
      if (road.kind === 'highway' || road.kind === 'alley') continue;
      const start = road.path[0]!, end = road.path.at(-1)!, d = direction(start, end), length = distance(start,end);
      if (road.path.some(point => Math.abs((point[0]-start[0])*d[1]-(point[1]-start[1])*d[0]) > 1e-7)) throw invariant('Native road paint requires an authored straight frame', { roadId: road.id });
      const frame: RoadFrame = {road,start,end,d,n:[-d[1],d[0]],length,top};
      const approaches = this.architecture.approaches.filter(approach => approach.edgeId === road.id).map(approach => {
        const stations = approach.field.map(point => dot(sub(point,start),d));
        return { approach, min: Math.min(...stations), max: Math.max(...stations), first: approach.nodeId === road.from };
      });
      const a = approaches.find(item => item.first), b = approaches.find(item => !item.first);
      const laneStart = a ? a.max + 1.4 : 0, laneEnd = b ? b.min - 1.4 : length;
      for (const side of [-1,1]) {
        paint.strip(frame,laneStart,laneEnd,side*(road.width/2-0.65),0.12,'whitePaint');
        if (road.lanes.length > 1) paint.strip(frame,laneStart,laneEnd,side*0.11,0.1,'yellowPaint');
        if (road.lanes.length === 4) for(let s=Math.ceil(laneStart/6)*6;s+3<=laneEnd;s+=6) paint.strip(frame,s,s+3,side*3.5,0.12,'whitePaint');
      }
      for (const item of approaches) {
        if (item.max-item.min < 2.8-1e-7) throw invariant('Crossing field cannot receive source markings',{approachId:item.approach.id});
        crossing.build(frame,(item.min+item.max-crossing.depth(frame))/2,item.first?0:length);
        const sign=item.first?1:-1, edge=item.first?item.max:item.min;
        if (road.lanes.length===4) {
          const incoming=road.lanes.filter(lane=>lane.direction===(item.first?'backward':'forward'));
          if(incoming.length) for(const offset of [0.4,1.05]) paint.bar(frame,edge+sign*offset,
            Math.min(...incoming.map(lane=>lane.offset-lane.width/2))+0.4,Math.max(...incoming.map(lane=>lane.offset+lane.width/2))-0.1,0.24,'whitePaint');
        }
        if(laneEnd-laneStart>20) arrows(paint,frame,edge+sign*4.7,item.approach.nodeId,this.architecture.turns);
      }
      artifacts(paint,frame,laneStart,laneEnd,this.seed,this.wear);
    }
  }
}
