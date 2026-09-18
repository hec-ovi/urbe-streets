import { expect, it } from 'vitest';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { encodeNativePiece } from './NativeGlb.ts';
import { comparePositions, decodePiece } from './decode-fixture.ts';
import { floatPiece, gridPiece } from './fixtures.ts';

it('indexes each primitive and shares only vertices with all five fields equal', async () => {
  const piece = gridPiece(), mesh = piece.meshes[0]!;
  for (const field of ['positions', 'normals', 'uvs', 'wear', 'heights'] as const) {
    const size = field === 'uvs' ? 2 : field === 'positions' || field === 'normals' ? 3 : 1;
    const triangle = mesh[field].slice(0, size * 3);
    mesh[field] = Array.from({ length: 7 }, () => triangle).flat();
    const variant = ['positions', 'normals', 'uvs', 'wear', 'heights'].indexOf(field) + 2;
    mesh[field][variant * size * 3] = mesh[field][variant * size * 3]! + 0.1;
  }
  const decoded = await decodePiece((await encodeNativePiece(piece)).bytes);
  const primitive = decoded.getRoot().listMeshes()[0]!.listPrimitives()[0]!;
  expect(primitive.getIndices()!.getCount()).toBe(21);
  expect(primitive.getAttribute('POSITION')!.getCount()).toBe(8);
});

it('requires quantization and meshopt and refuses a reader without its decoder', async () => {
  const { bytes } = await encodeNativePiece(gridPiece());
  const json = (await new NodeIO().binaryToJSON(bytes)).json;
  expect(json.extensionsRequired).toEqual(expect.arrayContaining(['KHR_mesh_quantization', 'EXT_meshopt_compression']));
  expect(json.extensionsUsed).toEqual(expect.arrayContaining(json.extensionsRequired!));
  expect(json.bufferViews!.every(view => view.extensions?.EXT_meshopt_compression)).toBe(true);
  await expect(new NodeIO().readBinary(bytes)).rejects.toThrow(/extension/i);
  await expect(new NodeIO().registerExtensions([KHRMeshQuantization, EXTMeshoptCompression]).readBinary(bytes)).rejects.toThrow(/meshopt.decoder/i);
});

it('decodes within 1 mm with identical triangles, field precision and native ownership', async () => {
  const piece = gridPiece(), mesh = piece.meshes[0]!;
  // Separate primitives exercise normalized fields, tiled UVs, signed heights and tall hardware.
  const normalized = { ...mesh, id: 'normalized', surface: 'curb', positions: mesh.positions.slice(0, 9), normals: mesh.normals.slice(0, 9),
    uvs: [0, 0, 1, 0, 0, 1], wear: [0, 0.501, 1], heights: [-0.03, 0.2, 0.9] };
  const tiled = { ...normalized, id: 'tiled', surface: 'asphalt', collision: false, uvs: [-2.25, 0, 12.5, 0, 0, 3.125], heights: [-2, 0.2, 3] };
  piece.meshes.push(normalized, tiled);
  const before = await new NodeIO().readBinary(await floatPiece(piece));
  const encoded = await encodeNativePiece(piece), after = await decodePiece(encoded.bytes);
  const comparison = comparePositions(before, after);
  expect(comparison.maxError).toBeLessThanOrEqual(0.001);
  expect(comparison.triangles).toBe(encoded.triangles);
  expect(encoded.bounds).toEqual(piece.bounds);
  expect(after.getRoot().listTextures()).toHaveLength(0);
  const compact = await decodePiece((await encodeNativePiece({ ...piece, meshes: [normalized], bounds: piece.bounds })).bytes);
  expect(compact.getRoot().listMeshes()[0]!.listPrimitives()[0]!.getAttribute('POSITION')!.getArray()).toBeInstanceOf(Int16Array);
  for (const node of after.getRoot().listNodes().filter(node => node.getMesh())) for (const primitive of node.getMesh()!.listPrimitives()) {
    const source = piece.meshes.find(m => m.id === primitive.getExtras().streetSource)!;
    expect(node.getExtras()).toEqual({ streetCollision: source.collision, streetOwnerIds: source.ownerIds, streetGroundIds: source.groundIds });
    expect(primitive.getExtras().streetCollision).toBe(source.collision);
    expect(primitive.getMaterial()!.getExtras().streetNativeSurface).toBe(source.surface);
    const fields = [['NORMAL', source.normals, 3], ['TEXCOORD_0', source.uvs, 2], ['_STREET_WEAR', source.wear, 1], ['_STREET_HEIGHT', source.heights, 1]] as const;
    // Unique first-seen vertices retain order through compression.
    for (const [semantic, values, size] of fields) {
      const attribute = primitive.getAttribute(semantic)!;
      const range = Math.max(...values) - Math.min(...values);
      const tolerance = semantic === 'NORMAL' ? 1 / 32767 : semantic === 'TEXCOORD_0' ? 1 / 65535 : range / 255;
      for (let i = 0; i < 3; i++) {
        const candidates = [0, 1, 2].map(k => attribute.getElement(primitive.getIndices()!.getScalar(k), []));
        expect(candidates.some(v => v.every((n, axis) => Math.abs(Math.fround(n) - Math.fround(values[i * size + axis]!)) <= tolerance))).toBe(true);
      }
    }

    if (source.id === 'grid') expect(primitive.getAttribute('POSITION')!.getArray()).toBeInstanceOf(Float32Array);
    if (source.id === 'tiled') {
      expect(primitive.getAttribute('TEXCOORD_0')!.getArray()).toBeInstanceOf(Float32Array);
      expect(primitive.getAttribute('_STREET_HEIGHT')!.getArray()).toBeInstanceOf(Float32Array);
    }
  }

});

it('stores a representative panel piece in at most a quarter of the Float32 bytes', async () => {
  const piece = gridPiece();
  const before = await floatPiece(piece), after = await encodeNativePiece(piece);
  expect(after.bytes.byteLength).toBeLessThanOrEqual(before.byteLength / 4);
});

it('rejects incomplete source attributes at the GLB entry', async () => {
  const piece = gridPiece(); piece.meshes[0]!.wear = [];
  await expect(encodeNativePiece(piece)).rejects.toMatchObject({ code: 'E_INVARIANT' });
});
