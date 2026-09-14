import {expect,it} from 'vitest';
import {NodeIO} from '@gltf-transform/core';
import {NativePartition} from './NativePartition.ts';
import {encodeNativePiece} from './NativeGlb.ts';
import type {NativeMesh} from '../construction/surfaces/schema.ts';

const mesh=():NativeMesh=>({id:'source',surface:'curb',collision:true,ownerIds:['owner'],groundIds:['ground'],
  positions:[127,0,2,129,0,2,127,2,4],normals:[0,-Math.SQRT1_2,Math.SQRT1_2,0,-Math.SQRT1_2,Math.SQRT1_2,0,-Math.SQRT1_2,Math.SQRT1_2],
  uvs:[0,0,1,0,0,1],wear:[0,1,0],heights:[0,0,2]});
it('retains clipped surface fields and explicit GLB ownership, collision and rebasing',async()=>{
  const partition=new NativePartition();partition.add(mesh());
  const paint={...mesh(),id:'paint',surface:'yellowPaint',collision:false};partition.add(paint);
  const pieces=partition.finish();expect(pieces.map(p=>p.id)).toEqual(['sp:0:0','sp:1:0']);
  let triangles=0;
  for(const piece of pieces){
    const encoded=await encodeNativePiece(piece);triangles+=encoded.triangles;
    const document=await new NodeIO().readBinary(encoded.bytes);
    expect(document.getRoot().listTextures()).toHaveLength(0);
    for(const node of document.getRoot().listNodes()){
      expect(node.getTranslation()).toEqual(piece.origin);
      expect(node.getExtras().streetOwnerIds).toEqual(['owner']);
      const primitive=node.getMesh()!.listPrimitives()[0]!,collision=node.getExtras().streetCollision;
      expect(primitive.getExtras().streetCollision).toBe(collision);
      expect(primitive.getMaterial()!.getExtras().streetNativeSurface).toBe(collision?'curb':'yellowPaint');
      const positions=primitive.getAttribute('POSITION')!,uv=primitive.getAttribute('TEXCOORD_0')!,wear=primitive.getAttribute('_STREET_WEAR')!,height=primitive.getAttribute('_STREET_HEIGHT')!;
      for(let i=0;i<positions.getCount();i++){
        const p=positions.getElement(i,[]),u=uv.getElement(i,[]);expect(u[0]).toBeCloseTo((p[0]!+piece.origin[0]-127)/2,6);
        expect(wear.getScalar(i)).toBeCloseTo(u[0]!,6);expect(height.getScalar(i)).toBe(p[1]);
      }
    }
  }
  expect(triangles).toBe(6);
});
it('rejects incomplete source fields before export',()=>{const source=mesh();source.wear=[];expect(()=>new NativePartition().add(source)).toThrowError(expect.objectContaining({code:'E_INVARIANT'}));});
