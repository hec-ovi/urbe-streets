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
import { intersection, totalArea } from '../src/geometry/polygons.ts';

const blueprint = fileURLToPath(new URL('../../atlas/samples/city-urbe-tiny.json', import.meta.url));
const request = { blueprint, seed: 42, design: { version: 'native-1.0.0' as const, wear: 1 } };
const nativeMaterials = catalog as unknown as NativeMaterialCatalog;
let result: NativeStreetBuild;
let source: {
  meta: { bounds: { min: Vec2; max: Vec2 } };
  streets: {
    nodes: { id: string; position: Vec2; edgeIds: string[] }[];
    edges: { id: string; class: string; path: Vec2[] }[];
    construction: {
      junctions: { id: string; nodeIds: string[]; approaches: { edgeId: string }[] }[];
      reservations: { owners: { id: string; groundIndices: number[] }[]; frontages: { id: string }[] };
    };
  };
  volumetric: { ground: { polygon: Ring }[] };
};
beforeAll(async () => { result = await build(request, { nativeMaterials }); source = JSON.parse(await readFile(blueprint, 'utf8')); });

function fractionalBlueprint() {
  const length = 31.7;
  const strip = (z: number, depth: number): Ring => [[0, z], [length, z], [length, z + depth], [0, z + depth]];
  return {
    meta: { version: '0.26.0', units: 'meters', bounds: { min: [0, -3.5], max: [length, 6] }, boundary: strip(-3.5, 9.5) },
    streets: {
      nodes: [{ id: 'n0', position: [0, 0] }, { id: 'n1', position: [length, 0] }],
      edges: [{ id: 'e0', from: 'n0', to: 'n1', class: 'street', path: [[0, 0], [length, 0]] as Vec2[], width: 7, level: 0,
        elevationProfile: [{ distance: 0, level: 0 }, { distance: length, level: 0 }] }],
      highwayStructures: [], crossings: [], signals: [], planting: [],
      construction: {
        modules: { version: '1.0.0', definitions: [], placements: [] }, planningReservations: { version: '2.1.0' },
        runs: [{ id: 'r0', edges: [{ edgeId: 'e0', start: 0, end: length, forward: true }] }], junctions: [],
        reservations: { version: '1.0.0', groundArray: { path: 'volumetric.ground', count: 4 },
          owners: [{ id: 'roadway', kind: 'roadway', groundIndices: [0], excludedParcelIds: [], interiors: [], finish: null },
            { id: 'block', kind: 'block', groundIndices: [1, 2, 3], excludedParcelIds: [], interiors: [], finish: 'ordinary' }],
          frontages: [{ id: 'frontage:block', ownerId: 'block', edgeIds: ['e0'], start: [0, 3.5], end: [length, 3.5], inward: [0, 1],
            stationRange: [0, length], moduleStationOffset: 0, pavedWidth: 2, roadTop: 0, pavedTop: 0.2, curbWidth: 0.2, gutterWidth: 0.3, cornerIds: [null, null] }],
          corners: [], parking: [], protected: [] },
      },
    },
    architecture: { version: '1.0.0', edges: [{ edgeId: 'e0', lanes: [
      { id: 'e0.v0', offset: 1.75, width: 3.5, direction: 'backward', path: [[length, 1.75], [0, 1.75]] },
      { id: 'e0.v1', offset: -1.75, width: 3.5, direction: 'forward', path: [[0, -1.75], [length, -1.75]] },
    ] }], nodes: [{ nodeId: 'n0', turns: [] }, { nodeId: 'n1', turns: [] }] },
    transit: { subwayStations: [] }, parcels: [],
    volumetric: { ground: [
      { surface: 'roadway', polygon: strip(-3.5, 7), bottom: -0.2, top: 0 },
      { surface: 'gutter', polygon: strip(3.5, 0.3), bottom: -0.2, top: 0 },
      { surface: 'curb', polygon: strip(3.8, 0.2), bottom: -0.2, top: 0.2 },
      { surface: 'sidewalk', polygon: strip(4, 2), bottom: -0.2, top: 0.2 },
    ] },
  };
}

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

it('covers each plan centreline once with whole units and plain fitted fractional closures', async () => {
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
  const fractional = fractionalBlueprint();
  const closureResult = await build({ ...request, blueprint: fractional }, { nativeMaterials });
  const closurePieces = new Map(closureResult.kit.pieces.map(p => [p.id, p]));
  const fitted = closureResult.closures.filter(c => c.fittedLength > 0);
  expect(fitted).toHaveLength(1);
  expect(fitted[0]!.fittedLength).toBe(1.7);
  for (const c of [...result.closures, ...closureResult.closures]) {
    expect(c.segments * 8 + c.halfSegments * 4 + c.quarterSegments * 2 + c.fittedLength).toBeCloseTo(c.clearLength, 7);
    expect(c.segments).toBe(Math.floor(c.clearLength / 8));
    expect(c.halfSegments).toBe(Math.floor(c.clearLength % 8 / 4));
    expect(c.quarterSegments).toBe(Math.floor(c.clearLength % 4 / 2));
    expect(c.fittedLength).toBeGreaterThanOrEqual(0);
    expect(c.fittedLength).toBeLessThan(2);
    expect(c.fittedLength * 10).toBeCloseTo(Math.round(c.fittedLength * 10), 7);
  }
  const placements = closureResult.placements.placements.filter(p => closurePieces.get(p.piece)!.variant === 'fitted-closure');
  expect(placements).toHaveLength(fitted.length);
  for (const closure of fitted) {
    const road = fractional.streets.edges.find(r => r.id === closure.roadId)!;
    const origin = road.path[0]!, end = road.path.at(-1)!, station = closure.end - closure.fittedLength;
    const x = origin[0] + (end[0] - origin[0]) * station / closure.length;
    const z = origin[1] + (end[1] - origin[1]) * station / closure.length;
    const matching = placements.filter(p => Math.hypot(p.position[0] - x, p.position[2] - z) < 1e-7);
    expect(matching, closure.roadId).toHaveLength(1);
    const p = matching[0]!, piece = closurePieces.get(p.piece)!;
    expect(piece.length).toBe(closure.fittedLength);
    expect(p.scale).toBeUndefined();
    expect(piece.surfaces).toContain('curb');
    const bytes = Buffer.from(closureResult.assets[`streets/${piece.file}`]!);
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) expect(primitive.extras.streetCollision).toBe(true);
    const cos = Math.cos(p.rotationY), sin = Math.sin(p.rotationY);
    const footprint = piece.footprint.map(r => r.map(([x, z]): Vec2 => [p.position[0] + cos * x + sin * z, p.position[2] - sin * x + cos * z]));
    for (const feature of closureResult.features) expect(totalArea(intersection([feature.footprint], footprint)), feature.id).toBeLessThan(1e-8);
  }
});

it('places crossing arms and one shared central piece at every junction the plan reserves', () => {
  const classOf = new Map(source.streets.edges.map(e => [e.id, e.class]));
  const nodeOf = new Map(source.streets.nodes.map(n => [n.id, n]));
  const pieces = new Map(result.kit.pieces.map(p => [p.id, p]));
  const placed = result.placements.placements.filter(p => pieces.get(p.piece)!.kind.startsWith('junction'));
  /** Highway interactions stay delegated, so junctions on a highway node are not built here. */
  const reserved = source.streets.construction.junctions.filter(j => j.nodeIds.every(id => nodeOf.get(id)!.edgeIds.every(e => classOf.get(e) !== 'highway')));
  expect(reserved.length).toBeGreaterThan(0);
  for (const junction of reserved) {
    const classes = [...new Set(junction.approaches.map(a => classOf.get(a.edgeId)!))].sort();
    const positions = junction.nodeIds.map(id => nodeOf.get(id)!.position);
    const here = placed.filter(p => positions.some(([x, z]) => Math.hypot(p.position[0] - x, p.position[2] - z) < 1e-6)).map(p => pieces.get(p.piece)!);
    expect(here.filter(p => p.kind === 'junction-center'), junction.id).toHaveLength(1);
    expect(here.filter(p => p.kind === 'junction-arm').length, junction.id).toBeGreaterThan(0);
    for (const piece of here) expect([...new Set(piece.classes)].sort(), `${junction.id} ${piece.id}`).toEqual(classes);
  }
});

it('places one original prop per constructed feature of the plan, inside its reserved bounds', () => {
  const pieces = new Map(result.kit.pieces.map(p => [p.id, p]));
  const props = result.placements.placements.filter(p => pieces.get(p.piece)!.kind === 'prop');
  const frontages = new Set(source.streets.construction.reservations.frontages.map(f => f.id));
  const roads = new Set(source.streets.edges.map(e => e.id));
  expect(result.features.length).toBeGreaterThan(0);
  expect(props).toHaveLength(result.features.length);
  expect(new Set(props.map(p => p.featureId)).size).toBe(props.length);
  for (const feature of result.features) {
    const anchor = feature.frontageId ?? feature.roadId!;
    expect(frontages.has(anchor) || roads.has(anchor), feature.id).toBe(true);
    for (const [axis, plan] of [[0, 0], [2, 1]] as const) {
      expect(feature.bounds.min[axis], feature.id).toBeGreaterThanOrEqual(source.meta.bounds.min[plan]!);
      expect(feature.bounds.max[axis], feature.id).toBeLessThanOrEqual(source.meta.bounds.max[plan]!);
    }
    const matching = props.filter(p => p.featureId === feature.id);
    expect(matching, feature.id).toHaveLength(1);
    const placement = matching[0]!;
    expect(placement.ownerId).toBe(feature.ownerId);
    expect(pieces.get(placement.piece)!.variant).toBe(feature.kind);
    const box = pieces.get(placement.piece)!.bounds, c = Math.cos(placement.rotationY), s = Math.sin(placement.rotationY);
    for (const x of [box.min[0], box.max[0]]) for (const y of [box.min[1], box.max[1]]) for (const z of [box.min[2], box.max[2]]) {
      const p = [placement.position[0] + c * x + s * z, placement.position[1] + y, placement.position[2] - s * x + c * z];
      p.forEach((v, axis) => { expect(v).toBeGreaterThanOrEqual(feature.bounds.min[axis]! - 0.001); expect(v).toBeLessThanOrEqual(feature.bounds.max[axis]! + 0.001); });
    }
  }
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
}, 120_000);

it('rejects invalid input and unsupported Atlas versions through build', async () => {
  await expect(build({ ...request, seed: NaN }, { nativeMaterials })).rejects.toMatchObject({ code: 'E_INVALID_PARAMS' });
  const invalid = { ...source, meta: { version: '0.24.0', units: 'meters' } };
  await expect(build({ ...request, blueprint: invalid }, { nativeMaterials })).rejects.toMatchObject({ code: 'E_UNSUPPORTED_ARCHITECTURE' });
  expect(result.meta.blueprintHash).toBe(createHash('sha256').update(await readFile(blueprint)).digest('hex'));
});
