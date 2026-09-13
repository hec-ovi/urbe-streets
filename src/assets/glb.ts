import { Document, NodeIO } from '@gltf-transform/core';
import { SurfaceBatch } from '../geometry/SurfaceBatch.ts';
import { bounds } from '../geometry/polygons.ts';
import { exactPanel, type Catalog } from '../finishes/catalog.ts';
import type { Vec2, Vec3, Box3 } from '../geometry/schema.ts';
import type { MaterialBinding } from '../schema/materials.ts';
import type { PiecePart } from './pieces.ts';

export async function encodePiece(id: string, parts: PiecePart[], catalog: Catalog): Promise<{ bytes: Uint8Array; bounds: Box3; triangles: number }> {
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene(id);
  const groups = new Map<string, { batch: SurfaceBatch; binding: MaterialBinding }>();
  const box: Box3 = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const { source, polygon } of parts) {
    const binding = catalog.resolve(source.role, source.sourceIds[0]!);
    const key = `${binding.key}:${binding.variant}`;
    let group = groups.get(key);
    if (!group) { group = { batch: new SurfaceBatch(), binding }; groups.set(key, group); }
    const local = ([x, , z]: Vec3): Vec2 => {
      const dx = x - source.origin[0], dz = z - source.origin[1];
      return ([[dx, dz], [dz, -dx], [-dx, -dz], [-dz, dx]] as const)[source.turn]!;
    };
    const localBox = bounds(source.polygon.map(([x, z]) => local([x, 0, z])));
    const width = localBox.max[0] - localBox.min[0], depth = localBox.max[1] - localBox.min[1];
    if (binding.alignment === 'exact') exactPanel(binding, width, depth, source.id);
    group.batch.prism(polygon, source.bottom, source.top, (p, normal) => {
      const [u, v] = local(p);
      if (binding.alignment === 'exact') return [(u - localBox.min[0]) / width, (v - localBox.min[1]) / depth];
      if (normal[1]) return [u / binding.worldSize[0], v / binding.worldSize[1]];
      const n = local([normal[0] + source.origin[0], 0, normal[2] + source.origin[1]]);
      return [(Math.abs(n[0]) > Math.abs(n[1]) ? v : u) / binding.worldSize[0], p[1] / binding.worldSize[1]];
    }, source.id);
  }
  let triangles = 0;
  const mesh = doc.createMesh(id);
  for (const { batch, binding } of groups.values()) {
    const data = batch.finish();
    triangles += data.positions.length / 9;
    for (let i = 0; i < data.positions.length; i++) {
      const axis = i % 3, value = data.positions[i]!;
      (box.min as unknown as number[])[axis] = Math.min(box.min[axis]!, value);
      (box.max as unknown as number[])[axis] = Math.max(box.max[axis]!, value);
    }
    const material = doc.createMaterial(binding.key).setMetallicFactor(binding.physical.metallicFactor ?? 1)
      .setRoughnessFactor(binding.physical.roughnessFactor ?? 1).setAlphaMode(binding.physical.alphaMode ?? 'OPAQUE')
      .setExtras({ catalogKey: binding.key, variant: binding.variant, delivery: 'catalog-reference' });
    const primitive = doc.createPrimitive().setMaterial(material);
    for (const [semantic, values, type] of [['POSITION', data.positions, 'VEC3'], ['NORMAL', data.normals, 'VEC3'], ['TEXCOORD_0', data.uvs, 'VEC2']] as const)
      primitive.setAttribute(semantic, doc.createAccessor().setType(type).setArray(values).setBuffer(buffer));
    mesh.addPrimitive(primitive);
  }
  scene.addChild(doc.createNode(id).setMesh(mesh));
  return { bytes: await new NodeIO().writeBinary(doc), bounds: box, triangles };
}
