import {expect,it} from 'vitest';
import {NativePartition} from './NativePartition.ts';
import type {NativeMesh} from '../construction/surfaces/schema.ts';

const mesh=():NativeMesh=>({id:'source',surface:'curb',collision:true,ownerIds:['owner'],groundIds:['ground'],
  positions:[127,0,2,129,0,2,127,2,4],normals:[0,-Math.SQRT1_2,Math.SQRT1_2,0,-Math.SQRT1_2,Math.SQRT1_2,0,-Math.SQRT1_2,Math.SQRT1_2],
  uvs:[0,0,1,0,0,1],wear:[0,1,0],heights:[0,0,2]});
it('retains clipped surface fields and cell ownership before encoding',()=>{
  const partition=new NativePartition();partition.add(mesh());
  const paint={...mesh(),id:'paint',surface:'yellowPaint',collision:false};partition.add(paint);
  const pieces=partition.finish();expect(pieces.map(p=>p.id)).toEqual(['sp:0:0','sp:1:0']);
  let triangles=0;
  for(const piece of pieces){
    for(const source of piece.meshes){
      triangles+=source.positions.length/9;
      expect(source.ownerIds).toEqual(['owner']);expect(source.groundIds).toEqual(['ground']);
      expect(source.surface).toBe(source.collision?'curb':'yellowPaint');
      for(let i=0;i<source.wear.length;i++){
        expect(source.uvs[i*2]).toBeCloseTo((source.positions[i*3]!-127)/2,6);
        expect(source.wear[i]).toBe(source.uvs[i*2]);expect(source.heights[i]).toBe(source.positions[i*3+1]);
      }
    }
  }
  expect(triangles).toBe(6);
});
it('rejects incomplete source fields before export',()=>{const source=mesh();source.wear=[];expect(()=>new NativePartition().add(source)).toThrowError(expect.objectContaining({code:'E_INVARIANT'}));});
