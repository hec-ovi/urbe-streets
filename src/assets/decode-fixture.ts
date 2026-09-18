import { NodeIO, type Document, type Node, type Primitive } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer/decoder';

export async function decodePiece(bytes: Uint8Array): Promise<Document> {
  await MeshoptDecoder.ready;
  return new NodeIO().registerExtensions([KHRMeshQuantization, EXTMeshoptCompression])
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).readBinary(bytes);
}

export function worldPosition(node: Node, primitive: Primitive, index: number): number[] {
  const p = primitive.getAttribute('POSITION')!.getElement(index, []), m = node.getWorldMatrix();
  return [0, 1, 2].map(axis => m[axis]! * p[0]! + m[axis + 4]! * p[1]! + m[axis + 8]! * p[2]! + m[axis + 12]!);
}

/** Triangle codecs may rotate a triangle's first vertex, while preserving its winding and order. */
export function comparePositions(reference: Document, decoded: Document): { triangles: number; maxError: number } {
  let triangles = 0, maxError = 0;
  const nodes = decoded.getRoot().listNodes().filter(node => node.getMesh());
  for (const sourceNode of reference.getRoot().listNodes().filter(node => node.getMesh())) {
    const node = nodes.find(candidate => candidate.getMesh()!.getName() === sourceNode.getMesh()!.getName());
    if (!node) throw new Error('Decoded mesh is missing');
    const source = sourceNode.getMesh()!.listPrimitives()[0]!, primitive = node.getMesh()!.listPrimitives()[0]!;
    const count = source.getIndices()?.getCount() ?? source.getAttribute('POSITION')!.getCount();
    if (primitive.getIndices()!.getCount() !== count) throw new Error('Decoded triangle count differs');
    for (let i = 0; i < count; i += 3) {
      const before = [0, 1, 2].map(k => worldPosition(sourceNode, source, source.getIndices()?.getScalar(i + k) ?? i + k));
      const after = [0, 1, 2].map(k => worldPosition(node, primitive, primitive.getIndices()!.getScalar(i + k)));
      const error = Math.min(...[0, 1, 2].map(rotation => Math.max(...before.map((p, k) =>
        Math.hypot(...p.map((value, axis) => value - after[(k + rotation) % 3]![axis]!))))));
      maxError = Math.max(maxError, error);
      triangles++;
    }
  }
  if (nodes.length !== reference.getRoot().listNodes().filter(node => node.getMesh()).length) throw new Error('Decoded mesh count differs');
  return { triangles, maxError };
}
