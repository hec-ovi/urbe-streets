import { beforeAll, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { build } from '../src/index.ts';
import type { NativeStreetBuild } from '../src/schema/native-result.ts';
import type { Ring, Vec2 } from '../src/geometry/schema.ts';
import kitSchema from '../schemas/street-kit.schema.json' with { type: 'json' };
import placementSchema from '../schemas/street-placement.schema.json' with { type: 'json' };
import catalog from './fixtures/native-materials.json' with { type: 'json' };
import type { NativeMaterialCatalog } from '../src/schema/native-materials.ts';

const blueprint = fileURLToPath(new URL('../../atlas/samples/city-urbe-tiny.json', import.meta.url));
const request = { blueprint, seed: 42, design: { version: 'native-1.0.0' as const, wear: 1 } };
const nativeMaterials = catalog as unknown as NativeMaterialCatalog;
let result: NativeStreetBuild;
let source: { streets: { edges: { id: string; class: string; from: string; to: string; path: Vec2[] }[]; construction: { reservations: { owners: { id: string; groundIndices: number[] }[] } } }; volumetric: { ground: { polygon: Ring }[] } };
beforeAll(async () => { result = await build(request, { nativeMaterials }); source = JSON.parse(await readFile(blueprint, 'utf8')); });

it('publishes schema valid kit and placements with exact Atlas ownership and material binding', () => {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  ajv.addSchema(kitSchema);
  for (const [schema, value] of [[kitSchema, result.kit], [placementSchema, result.placements]] as const) {
    const validate = ajv.compile(schema); expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
  }
  const ids = new Set(result.kit.pieces.map(p => p.id));
  expect(ids.size).toBe(result.kit.pieces.length);
  for (const p of result.placements.placements) {
    expect(ids.has(p.piece)).toBe(true);
    expect(p.cell).toEqual([Math.floor(p.position[0] / 128), Math.floor(p.position[2] / 128)]);
    expect(p.ownerIds).toContain(p.ownerId);
  }
  expect(result.ground.replacements.groundIndices).toEqual(source.streets.construction.reservations.owners.flatMap(o => o.groundIndices).sort((a, b) => a - b));
  for (const g of result.ground.owners) expect(g.polygon).toEqual(source.volumetric.ground[g.sourceIndex]!.polygon);
  expect(result.ground.cover.missingArea).toBeLessThan(1e-7);
  expect(result.ground.cover.outsideArea).toBeLessThan(1e-7);
  expect(result.materials.binding).toEqual(catalog);
  for (const p of result.kit.pieces) expect(p.surfaces.every(s => s in catalog.surfaces)).toBe(true);
});

it('gives byte identical pieces, placements and manifest for the same saved plan', async () => {
  const other = await build(request, { nativeMaterials });
  expect(Object.keys(other.assets)).toEqual(Object.keys(result.assets));
  for (const [path, bytes] of Object.entries(result.assets)) expect(Buffer.compare(Buffer.from(other.assets[path]!), Buffer.from(bytes)), path).toBe(0);
  const { assets: firstAssets, ...first } = result, { assets: secondAssets, ...second } = other;
  expect(JSON.stringify(second)).toBe(JSON.stringify(first));
});

/** Intersect signed polygon contours with the road line, then retain their nonzero winding intervals. */
function intervals(rings: Ring[], origin: Vec2, d: Vec2): [number, number][] {
  const events: { station: number; delta: number }[] = [];
  for (const ring of rings) for (const [i, p] of ring.entries()) {
    const q = ring[(i + 1) % ring.length]!;
    const ay = -(p[0] - origin[0]) * d[1] + (p[1] - origin[1]) * d[0];
    const by = -(q[0] - origin[0]) * d[1] + (q[1] - origin[1]) * d[0];
    if ((ay <= 0 && by > 0) || (by <= 0 && ay > 0)) {
      const t = ay / (ay - by), x = p[0] + (q[0] - p[0]) * t, y = p[1] + (q[1] - p[1]) * t;
      events.push({ station: (x - origin[0]) * d[0] + (y - origin[1]) * d[1], delta: by > ay ? 1 : -1 });
    }
  }
  events.sort((a, b) => a.station - b.station);
  const spans: [number, number][] = []; let winding = 0, start = 0;
  for (const event of events) { if (!winding) start = event.station; winding += event.delta; if (!winding && event.station - start > 1e-8) spans.push([start, event.station]); }
  return spans;
}

it('covers each plan centreline once and closes clear runs with minimal whole metre units', () => {
  const pieces = new Map(result.kit.pieces.map(p => [p.id, p]));
  for (const p of result.kit.pieces.filter(p => p.kind === 'segment')) {
    expect(p.bounds.min[0], p.id).toBeGreaterThanOrEqual(-1e-7);
    expect(p.bounds.max[0], p.id).toBeLessThanOrEqual(p.length + 1e-7);
  }
  for (const road of source.streets.edges.filter(e => e.class !== 'highway')) {
    const origin = road.path[0]!, end = road.path.at(-1)!, length = Math.hypot(end[0] - origin[0], end[1] - origin[1]);
    const d: Vec2 = [(end[0] - origin[0]) / length, (end[1] - origin[1]) / length];
    const spans = result.placements.placements.flatMap(p => {
      const piece = pieces.get(p.piece)!, c = Math.cos(p.rotationY), s = Math.sin(p.rotationY);
      const rings = piece.footprint.map(r => r.map(([x, z]): Vec2 => [p.position[0] + c * x + s * z, p.position[2] - s * x + c * z]));
      return intervals(rings, origin, d).map(([a, b]): [number, number] => [Math.max(0, a), Math.min(length, b)]).filter(([a, b]) => b - a > 1e-7);
    }).sort((a, b) => a[0] - b[0]);
    let station = 0;
    for (const [start, end] of spans) { expect(start, `${road.id} at ${station}`).toBeCloseTo(station, 6); station = end; }
    expect(station, road.id).toBeCloseTo(length, 6);
  }
  for (const c of result.closures) {
    expect(c.segments * 8 + c.halfSegments * 4 + c.quarterSegments * 2).toBeCloseTo(c.clearLength, 7);
    expect(c.segments).toBe(Math.floor(c.clearLength / 8));
    expect(c.halfSegments).toBe(Math.floor(c.clearLength % 8 / 4));
    expect(c.quarterSegments).toBe(Math.round(c.clearLength % 4 / 2));
  }
});

it('provides placed crossing arms and a shared central piece for every incident class pair', () => {
  const nodes = new Map<string, string[]>();
  for (const road of source.streets.edges.filter(r => r.class !== 'highway')) for (const node of [road.from, road.to]) nodes.set(node, [...nodes.get(node) ?? [], road.class]);
  const placed = new Set(result.placements.placements.map(p => p.piece));
  for (const classes of nodes.values()) {
    const pair = [...new Set(classes)].sort(); if (pair.length === 1) pair.push(pair[0]!);
    for (const kind of ['junction-arm', 'junction-center']) expect(result.kit.pieces.some(p => p.kind === kind && JSON.stringify(p.classes) === JSON.stringify(pair) && placed.has(p.id)), pair.join('+')).toBe(true);
  }
});

it('places one original prop per feature with the accepted tiny sample counts and bounds', () => {
  const expected = { cable: 34, guard: 4, inlet: 104, marquee: 105, 'tree-grate': 12 };
  const counts: Record<string, number> = {};
  const pieces = new Map(result.kit.pieces.map(p => [p.id, p]));
  const props = result.placements.placements.filter(p => pieces.get(p.piece)!.kind === 'prop');
  expect(props).toHaveLength(result.features.length);
  expect(new Set(props.map(p => p.featureId)).size).toBe(props.length);
  for (const feature of result.features) {
    counts[feature.kind] = (counts[feature.kind] ?? 0) + 1;
    const placement = props.find(p => p.featureId === feature.id)!;
    expect(placement.ownerId).toBe(feature.ownerId);
    expect(pieces.get(placement.piece)!.variant).toBe(feature.kind);
    const box = pieces.get(placement.piece)!.bounds, c = Math.cos(placement.rotationY), s = Math.sin(placement.rotationY);
    for (const x of [box.min[0], box.max[0]]) for (const y of [box.min[1], box.max[1]]) for (const z of [box.min[2], box.max[2]]) {
      const p = [placement.position[0] + c * x + s * z, placement.position[1] + y, placement.position[2] - s * x + c * z];
      p.forEach((v, axis) => { expect(v).toBeGreaterThanOrEqual(feature.bounds.min[axis]! - 0.001); expect(v).toBeLessThanOrEqual(feature.bounds.max[axis]! + 0.001); });
    }
  }
  expect(counts).toEqual(expected);
});

it('writes the complete bundle before its manifest and exposes metadata without GLBs in manifest mode', async () => {
  const dir = await mkdtemp(fileURLToPath(new URL('../out-test-', import.meta.url)));
  try {
    const output = await build(request, { nativeMaterials, outDir: join(dir, 'bundle') });
    expect(output.assets).toEqual({});
    const { assets, ...manifest } = output;
    expect(await readFile(join(dir, 'bundle/manifest.json'), 'utf8')).toBe(JSON.stringify(manifest));
    for (const [path, bytes] of Object.entries(result.assets)) expect(Buffer.compare(await readFile(join(dir, 'bundle', path)), Buffer.from(bytes)), path).toBe(0);
    await expect(build(request, { nativeMaterials, outDir: join(dir, 'bundle') })).rejects.toMatchObject({ code: 'E_INVALID_PARAMS' });
  } finally { await rm(dir, { recursive: true, force: true }); }
  const metadata = await build(request, { nativeMaterials, mode: 'manifest' });
  expect(Object.keys(metadata.assets).sort()).toEqual(['streets/kit.json', 'streets/placements.json']);
  expect(metadata.kit).toEqual(result.kit);
});

it('rejects invalid input and unsupported Atlas versions through build', async () => {
  await expect(build({ ...request, seed: NaN }, { nativeMaterials })).rejects.toMatchObject({ code: 'E_INVALID_PARAMS' });
  const invalid = { ...source, meta: { version: '0.24.0', units: 'meters' } };
  await expect(build({ ...request, blueprint: invalid }, { nativeMaterials })).rejects.toMatchObject({ code: 'E_UNSUPPORTED_ARCHITECTURE' });
  expect(result.meta.blueprintHash).toBe(createHash('sha256').update(await readFile(blueprint)).digest('hex'));
});
