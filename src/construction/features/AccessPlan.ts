import type {NativeArchitecture} from '../../architecture/native-schema.ts';
import type {Box3,Vec2} from '../../geometry/schema.ts';
import {difference,intersection,totalArea} from '../../geometry/polygons.ts';
import {direction,distance,dot,sub} from '../surfaces/Frame.ts';
import {random} from '../style/random.ts';
import {Models} from './Models.ts';
import type {PlacedFeature} from './schema.ts';

/** Original transverse cassette candidates, wholly received by an authored road owner. */
export function accessPlan(a:NativeArchitecture,seed:number,wear:(p:Vec2)=>number,models:Models):PlacedFeature[]{
  const result:PlacedFeature[]=[];
  for(const road of a.roads){
    if(road.kind==='highway'||road.lanes.length!==4)continue;
    const approach=a.approaches.find(approach=>approach.edgeId===road.id&&approach.nodeId===road.from);if(!approach)continue;
    const start=road.path[0]!,end=road.path.at(-1)!,d=direction(start,end),n:Vec2=[d[1],-d[0]];
    const station=Math.min(...approach.field.map(point=>dot(sub(point,start),d)));
    if(random(seed,`${road.id}:${station}:access`)>=0.28||distance(start,end)<20)continue;
    const point:Vec2=[start[0]+d[0]*(station-0.7),start[1]+d[1]*(station-0.7)];
    const options={kind:'access' as const,length:road.width+0.6,depth:0.6,style:0,damaged:wear(point)>0.5},source=models.get(options);
    const place=([x,z]:Vec2):Vec2=>[point[0]+n[0]*x+d[0]*z,point[1]+n[1]*x+d[1]*z],footprint=source.footprint.map(place);
    const owner=a.owners.find(owner=>totalArea(difference([footprint],owner.ground.filter(ground=>ground.surface==='roadway').map(ground=>ground.ring)))===0);
    if(!owner||totalArea(intersection([footprint],[...a.shafts.map(shaft=>shaft.ring),...a.stationBays.map(bay=>bay.footprint),...a.approaches.flatMap(approach=>[approach.field,...approach.landings])]))>0)continue;
    const fields=owner.ground.filter(ground=>ground.surface==='roadway'),roadTop=fields[0]!.top;
    if(fields.some(field=>field.top!==roadTop))continue;
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(const part of source.model.parts){const positions=part.geometry.getAttribute('position');for(let i=0;i<positions.count;i++){
      const p=place([positions.getX(i),positions.getZ(i)]);[p[0],roadTop+positions.getY(i),p[1]].forEach((value,axis)=>{min[axis]=Math.min(min[axis]!,value);max[axis]=Math.max(max[axis]!,value);});
    }}
    const bounds:Box3={min:min.map(value=>Math.floor(value*1000)/1000) as unknown as Box3['min'],max:max.map(value=>Math.ceil(value*1000)/1000) as unknown as Box3['max']};
    result.push({descriptor:{id:`${road.id}:${station}:access`,kind:'access',ownerId:owner.id,frontageId:null,roadId:road.id,style:0,length:options.length,depth:options.depth,bounds,footprint},options,placement:{origin:[point[0],roadTop,point[1]],inward:d},cut:null});
  }
  return result;
}
