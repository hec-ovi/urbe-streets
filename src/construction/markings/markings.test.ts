import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import fixture from './fixtures/crosswalk.json' with {type:'json'};
import {readNativeAtlas} from '../../architecture/NativeAtlas.ts';
import {nativeBlueprint} from '../../architecture/fixtures/native.ts';
import {SurfaceBatch} from '../surfaces/SurfaceBatch.ts';
import {rectangle} from '../../geometry/polygons.ts';
import {Paint} from './Paint.ts';
import {Crosswalk} from './Crosswalk.ts';
import {Markings} from './Markings.ts';

it('retains original crossing positions and scan UVs for both source profiles',async()=>{
  const a=await readNativeAtlas(nativeBlueprint());
  for(const expected of fixture){
    const road={...a.roads[0]!,width:expected.lanes*3.5,lanes:Array.from({length:expected.lanes},()=>a.roads[0]!.lanes[0]!)};
    const batch=new SurfaceBatch({ownerId:'owner',groundIds:['ground'],roadTop:0,wear:()=>.5});
    new Crosswalk(new Paint(batch,[rectangle(-20,-20,150,40)],42),42).build({road,start:[0,0],end:[100,0],d:[1,0],n:[0,1],length:100,top:0},10,0);
    const result=batch.finish(),points:string[]=[];
    for(const mesh of result.meshes)for(let i=0;i<mesh.positions.length/3;i++)points.push(JSON.stringify([mesh.surface,...mesh.positions.slice(i*3,i*3+3),...mesh.uvs.slice(i*2,i*2+2)].map(v=>typeof v==='number'?Number(v.toFixed(8)):v)));
    const values=[...new Set(points)].sort();
    expect(values.length).toBe(expected.vertices);
    expect(createHash('sha256').update(JSON.stringify(values)).digest('hex')).toBe(expected.sha256);
    expect(result.coverage).toEqual([]);expect(result.meshes.every(mesh=>!mesh.collision)).toBe(true);
  }
});

it('clips paint to its receiving field while retaining the source scan frame',()=>{
  const batch=new SurfaceBatch({ownerId:'owner',groundIds:['ground'],roadTop:0,wear:()=>.5});
  new Paint(batch,[rectangle(.5,0,1,1)],42).polygon('whitePaint',rectangle(0,0,2,1),.006,p=>[p[0]/2,p[1]]);
  const vertices=new Set<string>();
  for(const mesh of batch.finish().meshes)for(let i=0;i<mesh.positions.length/3;i++)vertices.add(JSON.stringify([...mesh.positions.slice(i*3,i*3+3),...mesh.uvs.slice(i*2,i*2+2)]));
  expect(vertices).toEqual(new Set([
    [.5,.006,0,.25,0],[1.5,.006,0,.75,0],[1.5,.006,1,.75,1],[.5,.006,1,.25,1],
  ].map(vertex=>JSON.stringify(vertex))));
});

it('uses declared road ownership and leaves highway paint to its renderer',async()=>{
  const a=await readNativeAtlas(nativeBlueprint()),owner=a.owners[0]!;
  const build=()=>{const batch=new SurfaceBatch({ownerId:owner.id,groundIds:owner.ground.map(g=>g.id),roadTop:0,wear:()=>0});new Markings(a,42,()=>0).build(owner,batch);return batch.finish();};
  expect(new Set(build().meshes.map(mesh=>mesh.surface))).toEqual(new Set(['whitePaint','yellowPaint']));
  a.roads[0]!.kind='highway';expect(build().meshes).toEqual([]);
});
