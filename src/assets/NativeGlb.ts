import { Document, NodeIO } from '@gltf-transform/core';
import type { NativeEncodedPiece, NativePieceData } from './native-schema.ts';

/** Native bindings and collision flags are carried explicitly without bitmap duplication. */
export async function encodeNativePiece(piece: NativePieceData): Promise<NativeEncodedPiece> {
  const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene(piece.id),materials=new Map<string,ReturnType<Document['createMaterial']>>();
  let triangles=0;
  for(const source of piece.meshes){
    let material=materials.get(source.surface);
    if(!material){material=doc.createMaterial(source.surface).setExtras({streetNativeSurface:source.surface});materials.set(source.surface,material);}
    const mesh=doc.createMesh(source.id),primitive=doc.createPrimitive().setMaterial(material).setExtras({streetCollision:source.collision});
    const positions=new Float32Array(source.positions.length);
    for(let i=0;i<positions.length;i++)positions[i]=source.positions[i]!-piece.origin[i%3]!;
    for(const [semantic,array,type] of [
      ['POSITION',positions,'VEC3'],['NORMAL',new Float32Array(source.normals),'VEC3'],['TEXCOORD_0',new Float32Array(source.uvs),'VEC2'],
      ['_STREET_WEAR',new Float32Array(source.wear),'SCALAR'],['_STREET_HEIGHT',new Float32Array(source.heights),'SCALAR'],
    ] as const)primitive.setAttribute(semantic,doc.createAccessor().setType(type).setArray(array).setBuffer(buffer));
    mesh.addPrimitive(primitive);scene.addChild(doc.createNode(source.id).setMesh(mesh).setTranslation([...piece.origin])
      .setExtras({streetCollision:source.collision,streetOwnerIds:source.ownerIds,streetGroundIds:source.groundIds}));
    triangles+=positions.length/9;
  }
  return {bytes:await new NodeIO().writeBinary(doc),bounds:piece.bounds,triangles};
}
