import { describe, it, expect } from 'vitest';
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { build } from '../src/index.ts';
import type { StreetRequest, MaterialCatalog } from '../src/index.ts';
import example from '../examples/request.json' with { type: 'json' };
import sampleCatalog from '../examples/catalog.json' with { type: 'json' };

const request = () => structuredClone(example) as unknown as StreetRequest;
const catalog = () => structuredClone(sampleCatalog) as unknown as MaterialCatalog;

describe('build public contract', () => {
  it('returns deterministic bounded GLBs, retained ground, selections and capabilities', async () => {
    const input = request(), before = JSON.stringify(input);
    const a = await build(input, { materials: catalog() });
    const b = await build(input, { materials: catalog() });
    expect(a).toEqual(b);
    expect(JSON.stringify(input)).toBe(before);
    expect(a.meta).toMatchObject({ version: '0.1.0', architectureVersion: '0.21.0', seed: 42 });
    expect(a.ground.cover.reservedArea).toBeCloseTo(260 * 12);
    expect(a.ground.cover.difference).toBeLessThan(1e-7);
    expect(a.capabilities).toMatchObject({ modules: true, turnMovements: false, walkingLanes: false });
    expect(a.construction.some(c => c.role === 'marking' && c.sourceIds.includes('e0'))).toBe(true);
    expect(a.capabilities.omissions.length).toBeGreaterThan(0);
    expect(a.pieces.length).toBeGreaterThan(1);
    const owners = new Set(a.ground.owners.map(o => o.id));
    let triangles = 0;
    for (const p of a.pieces) {
      expect(p.asset).not.toBeNull();
      expect(p.groundIds.every(id => owners.has(id))).toBe(true);
      expect(p.bounds.max[0] - p.bounds.min[0]).toBeLessThanOrEqual(128);
      expect(p.bounds.max[2] - p.bounds.min[2]).toBeLessThanOrEqual(128);
      const doc = await new NodeIO().readBinary(a.assets[p.asset!]!);
      for (const mesh of doc.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
        const positions = primitive.getAttribute('POSITION')!.getArray()!;
        const normals = primitive.getAttribute('NORMAL')!.getArray()!;
        const uv = primitive.getAttribute('TEXCOORD_0')!.getArray()!;
        triangles += positions.length / 9;
        expect([...positions, ...normals, ...uv].every(Number.isFinite)).toBe(true);
        expect([...positions].every((v, i) => v >= p.bounds.min[i % 3]! && v <= p.bounds.max[i % 3]!)).toBe(true);
        expect(a.textures.bindings.some(b => b.key === primitive.getMaterial()!.getName())).toBe(true);
      }
    }
    expect(a.statistics).toMatchObject({ pieces: a.pieces.length, triangles, groundOwners: owners.size });
    expect(a.construction.every(c => a.textures.bindings.some(b => b.key === c.material && b.variant === c.variant))).toBe(true);
    const otherSeed = request(); otherSeed.seed = 7;
    const c = await build(otherSeed, { materials: catalog(), mode: 'manifest' });
    expect(c.meta.identity).not.toBe(a.meta.identity);
    expect(c.ground).toEqual(a.ground);
    expect(c.assets).toEqual({});
    expect(c.pieces.every(p => p.asset === null)).toBe(true);
  });

  it('writes a complete bundle using a catalog path and a new destination', async () => {
    await mkdir('out', { recursive: true });
    const root = await mkdtemp(resolve('out/test-'));
    try {
      const output = join(root, 'build');
      const result = await build(request(), { materials: 'examples/catalog.json', outDir: output });
      const manifest = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'));
      expect(result.statistics.pieces).toBe(manifest.pieces.length);
      expect(result.assets).toEqual({});
      for (const piece of manifest.pieces) expect((await new NodeIO().read(join(output, piece.asset))).getRoot().listMeshes().length).toBe(1);
      await expect(build(request(), { materials: catalog(), outDir: output })).rejects.toMatchObject({ code: 'E_INVALID_PARAMS' });
      expect(JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'))).toEqual(manifest);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('rejects invalid request fields and unavailable material bindings', async () => {
    const invalid = request(); invalid.seed = NaN;
    await expect(build(invalid, { materials: catalog() })).rejects.toMatchObject({ code: 'E_INVALID_PARAMS' });
    const missing = catalog(); delete missing.entries['cyberpunk/panel/mid'];
    await expect(build(request(), { materials: missing })).rejects.toMatchObject({ code: 'E_INVALID_PARAMS', details: { key: 'cyberpunk/panel/mid' } });
  });

  it('rejects an unsupported architecture with a source field path', async () => {
    const input = structuredClone(example); input.blueprint.meta.version = '99.0.0';
    await expect(build(input as unknown as StreetRequest, { materials: catalog() })).rejects.toMatchObject({ code: 'E_UNSUPPORTED_ARCHITECTURE', details: { path: 'meta.version' } });
  });

  it('rejects a lane that cannot fit its unchanged carriageway', async () => {
    const input = structuredClone(example); input.blueprint.streets.edges[0]!.crossSection.lanes[0]!.width = 100;
    await expect(build(input as unknown as StreetRequest, { materials: catalog() })).rejects.toMatchObject({ code: 'E_UNSATISFIABLE', details: { edgeId: 'e0' } });
  });

  it('rejects overlapping physical construction with owner identity', async () => {
    const input = structuredClone(example);
    input.blueprint.streets.construction.modules.placements.push(input.blueprint.streets.construction.modules.placements[0]!);
    await expect(build(input as unknown as StreetRequest, { materials: catalog() })).rejects.toMatchObject({ code: 'E_INVARIANT', details: { ownerIds: expect.any(Array), sourceIds: expect.any(Array) } });
  });
});
