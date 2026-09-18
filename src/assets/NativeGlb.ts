import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { MeshoptEncoder } from 'meshoptimizer/encoder';
import { NativeVertices } from './NativeVertices.ts';
import { quantizeField, quantizeNormals, quantizeNormalized, quantizePositions } from './NativeQuantization.ts';
import type { NativeEncodedPiece, NativePieceData } from './native-schema.ts';

/** Native bindings and collision flags are carried explicitly without bitmap duplication. */
export async function encodeNativePiece(piece: NativePieceData): Promise<NativeEncodedPiece> {
  await MeshoptEncoder.ready;
  const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene(piece.id),materials=new Map<string,ReturnType<Document['createMaterial']>>();
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  doc.createExtension(EXTMeshoptCompression).setRequired(true)
    .setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  let triangles=0;
  for(const source of piece.meshes){
    let material=materials.get(source.surface);
    if(!material){material=doc.createMaterial(source.surface).setExtras({streetNativeSurface:source.surface});materials.set(source.surface,material);}
    const mesh=doc.createMesh(source.id),primitive=doc.createPrimitive().setMaterial(material).setExtras({streetCollision:source.collision});
    const vertices=new NativeVertices(source,piece.origin),positions=quantizePositions(vertices.positions);
    primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(vertices.indices).setBuffer(buffer));
    for(const [semantic,array,type] of [
      ['POSITION',positions.array,'VEC3'],['NORMAL',quantizeNormals(vertices.normals),'VEC3'],
      ['TEXCOORD_0',quantizeNormalized(vertices.uvs,1/65535,16),'VEC2'],
      ['_STREET_WEAR',quantizeField(vertices.wear),'SCALAR'],['_STREET_HEIGHT',quantizeField(vertices.heights),'SCALAR'],
    ] as const)primitive.setAttribute(semantic,doc.createAccessor().setType(type).setArray(array)
      .setNormalized(!(array instanceof Float32Array)).setBuffer(buffer));
    const extras={streetCollision:source.collision,streetOwnerIds:source.ownerIds,streetGroundIds:source.groundIds};
    const node=doc.createNode(source.id).setTranslation([...piece.origin]).setExtras(extras);
    mesh.addPrimitive(primitive);
    if(positions.array instanceof Int16Array)node.addChild(doc.createNode(`${source.id}:vertices`).setMesh(mesh)
      .setTranslation([...positions.offset]).setScale([positions.scale,positions.scale,positions.scale]).setExtras(extras));
    else node.setMesh(mesh);
    scene.addChild(node);
    triangles+=vertices.indices.length/3;
  }
  const io=new NodeIO().registerExtensions([KHRMeshQuantization,EXTMeshoptCompression])
    .registerDependencies({'meshopt.encoder':MeshoptEncoder});
  return {bytes:await io.writeBinary(doc),bounds:piece.bounds,triangles};
}
