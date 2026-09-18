import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';
import { NodeIO } from '@gltf-transform/core';
import { readNativeAtlas } from '../architecture/NativeAtlas.ts';
import { OwnerConstruction } from '../construction/OwnerConstruction.ts';
import { NativePartition } from './NativePartition.ts';
import { encodeNativePiece } from './NativeGlb.ts';
import { comparePositions, decodePiece } from './decode-fixture.ts';
import { floatPiece } from './fixtures.ts';

const { values } = parseArgs({ options: { blueprint: { type: 'string' } }, strict: true });
assert(values.blueprint, 'Supply --blueprint with the saved 500 m sample.');
const architecture = await readNativeAtlas(values.blueprint);
const construction = new OwnerConstruction(architecture, 42, 1), partition = new NativePartition();
try {
  for (let i = 0; i < architecture.owners.length; i++) {
    for (const mesh of construction.build(i).meshes) partition.add(mesh);
  }
} finally { construction.dispose(); }

const pieces = partition.finish();
const before = { pieces: pieces.length, bytes: 0, triangles: 0, maxPositionError: 0 };
const after = { pieces: pieces.length, bytes: 0, triangles: 0, maxPositionError: 0 };
const floatAttributes = new Set<string>();
for (const piece of pieces) {
  const reference = await floatPiece(piece), encoded = await encodeNativePiece(piece);
  const decoded = await decodePiece(encoded.bytes);
  const comparison = comparePositions(await new NodeIO().readBinary(reference), decoded);
  const triangles = piece.meshes.reduce((sum, mesh) => sum + mesh.positions.length / 9, 0);
  assert.equal(comparison.triangles, triangles);
  assert.equal(encoded.triangles, triangles);
  assert(comparison.maxError <= 0.001, `${piece.id} exceeds 1 mm`);
  before.bytes += reference.byteLength; before.triangles += triangles;
  after.bytes += encoded.bytes.byteLength; after.triangles += comparison.triangles;
  after.maxPositionError = Math.max(after.maxPositionError, comparison.maxError);
  for (const mesh of decoded.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    for (const semantic of primitive.listSemantics()) {
      if (primitive.getAttribute(semantic)!.getArray() instanceof Float32Array) floatAttributes.add(semantic);
    }
  }
}
console.log(JSON.stringify({ before, after, ratio: after.bytes / before.bytes, floatAttributes: [...floatAttributes].sort() }, null, 2));
assert(after.bytes <= before.bytes / 4, 'Compressed sample exceeds a quarter of the reference bytes');
