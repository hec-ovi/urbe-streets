import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { MeshoptEncoder } from 'meshoptimizer/encoder';
import { NativeStreams } from './NativeStreams.ts';
import { quantizeNormals, quantizeNormalized, quantizePositions } from './NativeQuantization.ts';
import type { NativeEncodedPiece, NativePieceData } from './native-schema.ts';

/** Native bindings and collision flags are carried explicitly without bitmap duplication. */
export async function encodeNativePiece(piece: NativePieceData): Promise<NativeEncodedPiece> {
  await MeshoptEncoder.ready;
  const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene(piece.id),materials=new Map<string,ReturnType<Document['createMaterial']>>();
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  doc.createExtension(EXTMeshoptCompression).setRequired(true)
    .setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  const vertices=new NativeStreams(piece),positions=quantizePositions(vertices.positions),fields=vertices.fields();
  const attributes = [
    ['POSITION',positions.array,'VEC3'],['NORMAL',quantizeNormals(vertices.normals),'VEC3'],
    ['TEXCOORD_0',quantizeNormalized(vertices.uvs,1/65535,16),'VEC2'],
    ['_STREET_WEAR',fields.wear,'SCALAR'],['_STREET_HEIGHT',fields.heights,'SCALAR'],
  ] as const;
  const accessors=attributes.map(([semantic,array,type]) => [semantic,doc.createAccessor().setType(type).setArray(array)
    .setNormalized(!(array instanceof Float32Array)).setBuffer(buffer)] as const);
  const root=doc.createNode().setTranslation([...piece.origin]);scene.addChild(root);
  const parent=positions.array instanceof Int16Array
    ? doc.createNode().setTranslation([...positions.offset]).setScale([positions.scale,positions.scale,positions.scale]) : root;
  if(parent!==root)root.addChild(parent);
  const groups=new Map<string,ReturnType<Document['createMesh']>>();
  let triangles=0,offset=0;
  for(const [index,source] of piece.meshes.entries()){
    let material=materials.get(source.surface);
    if(!material){material=doc.createMaterial(source.surface).setExtras({streetNativeSurface:source.surface});materials.set(source.surface,material);}
    const primitive=doc.createPrimitive().setMaterial(material).setExtras({streetCollision:source.collision,streetSource:source.id});
    const indices=vertices.indices.slice(offset,offset+vertices.counts[index]!);
    offset+=indices.length;
    primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer));
    for(const [semantic,accessor] of accessors)primitive.setAttribute(semantic,accessor);
    const extras={streetCollision:source.collision,...(source.ownerIds.length?{streetOwnerIds:source.ownerIds}:{}),...(source.groundIds.length?{streetGroundIds:source.groundIds}:{})};
    const key=JSON.stringify(extras);let mesh=groups.get(key);
    if(!mesh){mesh=doc.createMesh();groups.set(key,mesh);parent.addChild(doc.createNode().setExtras(extras).setMesh(mesh));}
    mesh.addPrimitive(primitive);
    triangles+=indices.length/3;
  }
  const io=new NodeIO().registerExtensions([KHRMeshQuantization,EXTMeshoptCompression])
    .registerDependencies({'meshopt.encoder':MeshoptEncoder});
  return {bytes:await io.writeBinary(doc),bounds:piece.bounds,triangles};
}
