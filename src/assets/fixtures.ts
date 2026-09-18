import { Document, NodeIO } from '@gltf-transform/core';
import type { NativePieceData } from './native-schema.ts';

/** Unquantized reference for the export contract, using the original five Float32 fields. */
export async function floatPiece(piece: NativePieceData): Promise<Uint8Array> {
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene(piece.id);
  const materials = new Map<string, ReturnType<Document['createMaterial']>>();
  for (const source of piece.meshes) {
    let material = materials.get(source.surface);
    if (!material) { material = doc.createMaterial(source.surface).setExtras({ streetNativeSurface: source.surface }); materials.set(source.surface, material); }
    const primitive = doc.createPrimitive().setMaterial(material).setExtras({ streetCollision: source.collision });
    for (const [semantic, data, type] of [
      ['POSITION', source.positions.map((value, i) => value - piece.origin[i % 3]!), 'VEC3'],
      ['NORMAL', source.normals, 'VEC3'], ['TEXCOORD_0', source.uvs, 'VEC2'],
      ['_STREET_WEAR', source.wear, 'SCALAR'], ['_STREET_HEIGHT', source.heights, 'SCALAR'],
    ] as const) primitive.setAttribute(semantic, doc.createAccessor().setType(type).setArray(new Float32Array(data)).setBuffer(buffer));
    scene.addChild(doc.createNode(source.id).setMesh(doc.createMesh(source.id).addPrimitive(primitive)).setTranslation([...piece.origin])
      .setExtras({ streetCollision: source.collision, streetOwnerIds: source.ownerIds, streetGroundIds: source.groundIds }));
  }
  return new NodeIO().writeBinary(doc);
}

export function gridPiece(): NativePieceData {
  const mesh = { id: 'grid', surface: 'paving', collision: true, ownerIds: ['owner'], groundIds: ['ground'],
    positions: [] as number[], normals: [] as number[], uvs: [] as number[], wear: [] as number[], heights: [] as number[] };
  for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) {
    for (const [dx, dz] of [[0, 0], [0, 1], [1, 0], [1, 0], [0, 1], [1, 1]]) {
      const px = (x + dx!) * 2, pz = (z + dz!) * 2;
      mesh.positions.push(128 + px, 0.2, -128 + pz); mesh.normals.push(0, 1, 0); mesh.uvs.push(px / 128, pz / 128);
      mesh.wear.push(px / 128); mesh.heights.push(0.2);
    }
  }
  return { id: 'sp:1:-1', origin: [128, 0, -128], bounds: { min: [128, 0.2, -128], max: [256, 0.2, 0] }, meshes: [mesh] };
}
