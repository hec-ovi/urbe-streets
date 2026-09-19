import { beforeAll, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { decodePiece, worldPosition } from '../src/assets/decode-fixture.ts';
import { build, placementFootprint } from '../src/index.ts';
import type { NativeStreetBuild } from '../src/schema/native-result.ts';
import type { Ring, Vec2 } from '../src/geometry/schema.ts';
import kitSchema from '../schemas/street-kit.schema.json' with { type: 'json' };
import placementSchema from '../schemas/street-placement.schema.json' with { type: 'json' };
import catalog from './fixtures/native-materials.json' with { type: 'json' };
import type { NativeMaterialCatalog } from '../src/schema/native-materials.ts';
import { area, difference, intersection, totalArea, union } from '../src/geometry/polygons.ts';

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
      reservations: { owners: { id: string; groundIndices: number[] }[]; frontages: { id: string; start: Vec2; inward: Vec2 }[]; parking: ParkingBay[] };
    };
  };
  volumetric: { ground: { polygon: Ring }[] };
};
beforeAll(async () => { result = await build(request, { nativeMaterials }); source = JSON.parse(await readFile(blueprint, 'utf8')); });

interface ParkingBay {
  id: string; ownerId: string; frontageId: string; start: number; end: number; support: { start: number; end: number };
  slotCount: number; slotLength: number; depth: number; endRun: number; walkingClearance: number; footprint: Ring; slots: Ring[];
}

function fractionalBlueprint(width = 7, length = 31.7) {
  const half = width / 2;
  const strip = (z: number, depth: number): Ring => [[0, z], [length, z], [length, z + depth], [0, z + depth]];
  return {
    meta: { version: '0.26.0', units: 'meters', bounds: { min: [0, -half], max: [length, half + 2.5] }, boundary: strip(-half, width + 2.5) },
    streets: {
      nodes: [{ id: 'n0', position: [0, 0] }, { id: 'n1', position: [length, 0] }],
      edges: [{ id: 'e0', from: 'n0', to: 'n1', class: 'street', path: [[0, 0], [length, 0]] as Vec2[], width, level: 0,
        elevationProfile: [{ distance: 0, level: 0 }, { distance: length, level: 0 }] }],
      highwayStructures: [], crossings: [], signals: [], planting: [],
      construction: {
        modules: { version: '1.0.0', definitions: [], placements: [], format: 'source' }, planningReservations: { version: '2.1.0' },
        runs: [{ id: 'r0', edges: [{ edgeId: 'e0', start: 0, end: length, forward: true }] }], junctions: [],
        reservations: { version: '1.0.0', groundArray: { path: 'volumetric.ground', count: 4 },
          owners: [{ id: 'roadway', kind: 'roadway', groundIndices: [0], excludedParcelIds: [], interiors: [], finish: null },
            { id: 'block', kind: 'block', groundIndices: [1, 2, 3], excludedParcelIds: [], interiors: [], finish: 'ordinary' }],
          frontages: [{ id: 'frontage:block', ownerId: 'block', edgeIds: ['e0'], start: [0, half], end: [length, half], inward: [0, 1],
            stationRange: [0, length], moduleStationOffset: 0, pavedWidth: 2, roadTop: 0, pavedTop: 0.2, curbWidth: 0.2, gutterWidth: 0.3, cornerIds: [null, null] }],
          corners: [], parking: [] as ParkingBay[], protected: [] },
      },
    },
    architecture: { version: '1.0.0', edges: [{ edgeId: 'e0', lanes: [
      { id: 'e0.v0', offset: 1.75, width: 3.5, direction: 'backward', path: [[length, 1.75], [0, 1.75]] },
      { id: 'e0.v1', offset: -1.75, width: 3.5, direction: 'forward', path: [[0, -1.75], [length, -1.75]] },
    ] }], nodes: [{ nodeId: 'n0', turns: [] }, { nodeId: 'n1', turns: [] }] },
    transit: { subwayStations: [] }, parcels: [],
    volumetric: { ground: [
      { surface: 'roadway', polygon: strip(-half, width), bottom: -0.2, top: 0 },
      { surface: 'gutter', polygon: strip(half, 0.3), bottom: -0.2, top: 0 },
      { surface: 'curb', polygon: strip(half + 0.3, 0.2), bottom: -0.2, top: 0.2 },
      { surface: 'sidewalk', polygon: strip(half + 0.5, 2), bottom: -0.2, top: 0.2 },
    ] },
  };
}

/** The same run in district format with one authored six slot parking bay carved out of its walk. */
function parkingBlueprint() {
  const length = 55.7, half = 3.5, slots = 6, start = 4, end = start + slots * 6 + 4;
  const source = fractionalBlueprint(7, length);
  const strip = (z: number, depth: number): Ring => [[0, z], [length, z], [length, z + depth], [0, z + depth]];
  const bay: Ring = [[start, 3.5], [end, 3.5], [end, 5.5], [start, 5.5]];
  const slot = (x: number): Ring => [[x, 3.5], [x + 6, 3.5], [x + 6, 5.5], [x, 5.5]];
  source.meta.bounds = { min: [0, -half], max: [length, 8.4] };
  source.meta.boundary = strip(-half, 11.9);
  source.volumetric.ground = [
    { surface: 'roadway', polygon: strip(-half, 7), bottom: -0.2, top: 0 },
    { surface: 'gutter', polygon: [[0,3.5],[start,3.5],[start,5.5],[end,5.5],[end,3.5],[length,3.5],[length,4],[end+0.5,4],[end+0.5,6],[start-0.5,6],[start-0.5,4],[0,4]], bottom: -0.2, top: 0 },
    { surface: 'curb', polygon: [[0,4],[start-0.5,4],[start-0.5,6],[end+0.5,6],[end+0.5,4],[length,4],[length,4.2],[end+0.7,4.2],[end+0.7,6.2],[start-0.7,6.2],[start-0.7,4.2],[0,4.2]], bottom: -0.2, top: 0.2 },
    { surface: 'sidewalk', polygon: [[0, 4.2], [start-0.7, 4.2], [start-0.7, 6.2], [end+0.7, 6.2], [end+0.7, 4.2], [length, 4.2], [length, 8.4], [0, 8.4]], bottom: -0.2, top: 0.2 },
    { surface: 'roadway', polygon: bay, bottom: -0.2, top: 0 },
  ];
  const construction = source.streets.construction, reservations = construction.reservations;
  construction.modules.format = 'district';
  reservations.groundArray.count = 5;
  reservations.owners[1]!.groundIndices = [1, 2, 3, 4];
  Object.assign(reservations.frontages[0]!, { pavedWidth: 4.2, gutterWidth: 0.5 });
  reservations.parking = [{ id: 'bay', ownerId: 'block', frontageId: 'frontage:block', start, end, support: { start: start - 2, end: end + 2 },
    slotCount: slots, slotLength: 6, depth: 2, endRun: 2, walkingClearance: 2.2, footprint: bay,
    slots: Array.from({ length: slots }, (_, i) => slot(start + 2 + i * 6)) }];
  return source;
}

it('publishes schema valid kit and placements with exact Atlas ownership and material binding', () => {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  ajv.addSchema(kitSchema);
  for (const [schema, value] of [[kitSchema, result.kit], [placementSchema, result.placements]] as const) {
    const validate = ajv.compile(schema); expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
  }
  const validatePiece = ajv.compile({ $ref: `${kitSchema.$id}#/$defs/piece` });
  const ordinary = result.kit.pieces.find(p => p.kind === 'segment' && p.profileId)!;
  const slot = result.kit.pieces.find(p => p.variant === 'parking-slot')!;
  for (const piece of [{ ...ordinary, length: 6 }, { ...ordinary, classes: ['street', 'road'] },
    { ...slot, length: 8 }, { ...slot, classes: ['alley'] }, { ...slot, variant: 'walk' }])
    expect(validatePiece(piece), JSON.stringify(piece)).toBe(false);
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
  expect(result.ground.cover.outsideArea).toBeGreaterThanOrEqual(0);
  expect(result.placements.version).toBe('1.2.0');
  const validate = ajv.compile(placementSchema);
  for (const key of ['featureId', 'configuration', 'offset', 'clip', 'openings', 'finishes', 'panels', 'markings', 'scans', 'message'])
    expect(validate({ ...result.placements, placements: [{ ...result.placements.placements[0], [key]: [] }] }), key).toBe(false);
  const lastGlyph = result.kit.glyphs.length - 1;
  expect(placementSchema.properties.placements.items.properties.text.items.maximum).toBe(lastGlyph);
  expect(validate({ ...result.placements, placements: [{ ...result.placements.placements[0], tint: [1, 0.5, 0], wear: 0.2, scan: { offset: [0, 0], scale: [0.25, 1] }, text: [0, lastGlyph] }] })).toBe(true);
  for (const values of [{ wear: 1.1 }, { tint: [-1, 0, 0] }, { scan: { offset: [0, 0], scale: [0, 1] } }, { text: [-1] }, { text: [lastGlyph + 1] }, { scale: [0, 1, 1] }])
    expect(validate({ ...result.placements, placements: [{ ...result.placements.placements[0], ...values }] })).toBe(false);
  expect(result.materials.binding).toEqual(catalog);
  for (const p of result.kit.pieces) expect(p.surfaces.every(s => s in catalog.surfaces)).toBe(true);
});

it('gives two cities and seeds byte identical complete kits within the inventory budgets', async () => {
  const other = await build({ ...request, blueprint: fileURLToPath(new URL('../../atlas/samples/city-urbe.json', import.meta.url)),
    seed: 918, design: { ...request.design, wear: 0.37 } }, { nativeMaterials });
  const paths = ['streets/kit.json', ...result.kit.pieces.map(p => `streets/${p.file}`)];
  for (const path of paths) expect(Buffer.compare(Buffer.from(other.assets[path]!), Buffer.from(result.assets[path]!)), path).toBe(0);
  expect(other.kit).toEqual(result.kit);
  expect(result.kit.profiles).toHaveLength(15);
  for (const p of result.kit.profiles) expect(result.kit.pieces.filter(k => k.profileId === p.id).map(k => [k.length, k.variant]).sort())
    .toEqual([[8, 'plain'], [4, 'closure'], [2, 'closure'], ...(p.width && !p.medianWidth ? [[8, 'core'], [2, 'core-closure']] : [])].sort());
  expect(result.statistics.pieces).toBeLessThanOrEqual(200);
  expect(result.statistics.pieceBytes + result.assets['streets/kit.json']!.length).toBeLessThanOrEqual(3_000_000);
  expect(result.statistics.placements).toBeGreaterThan(600);
  expect(other.statistics.placements).toBeGreaterThan(3000);
  expect(result.report.profiles).toEqual([]);
  expect(other.report.profiles).toEqual([]);
  for (const p of result.kit.pieces) expect(createHash('sha256').update(result.assets[`streets/${p.file}`]!).digest('hex')).toBe(p.sha256);
}, 60_000);

it('maps an off catalogue width to the nearest profile and reports it without adding a piece', async () => {
  const blueprint = fractionalBlueprint(30);
  const mapped = await build({ ...request, blueprint }, { nativeMaterials });
  expect(mapped.report.profiles).toEqual([{ roadId: 'e0', profileId: 'ordinary/local', requestedWidth: 30, width: 7, delta: -23 }]);
  expect(mapped.placements.placements.filter(p => result.kit.pieces.find(k => k.id === p.piece)!.kind === 'segment').every(p => p.piece.startsWith('street/ordinary/local/'))).toBe(true);
  expect(mapped.kit).toEqual(result.kit);
  expect(mapped.ground.cover.missingArea).toBeGreaterThan(0);
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

it('covers each plan centreline with whole units and plain fitted fractional closures', async () => {
  const pieces = new Map(result.kit.pieces.map(p => [p.id, p]));
  for (const p of result.kit.pieces.filter(p => p.kind === 'segment')) {
    expect(p.bounds.min[0], p.id).toBeGreaterThanOrEqual(-1e-7);
    expect(p.bounds.max[0], p.id).toBeLessThanOrEqual(p.length + 1e-7);
  }
  for (const road of source.streets.edges.filter(e => e.class !== 'highway')) {
    const origin = road.path[0]!, end = road.path.at(-1)!, length = Math.hypot(end[0] - origin[0], end[1] - origin[1]);
    const d: Vec2 = [(end[0] - origin[0]) / length, (end[1] - origin[1]) / length];
    const spans = result.placements.placements.flatMap(p => {
      const piece = pieces.get(p.piece)!;
      if (piece.kind === 'prop' || piece.kind === 'overlay') return [];
      const rings = placementFootprint(piece, p);
      return intervals(rings, origin, d).map(([a, b]): [number, number] => [Math.max(0, a), Math.min(length, b)]).filter(([a, b]) => b - a > 1e-7);
    }).sort((a, b) => a[0] - b[0]);
    let station = 0;
    for (const [start, end] of spans) { expect(start, `${road.id} at ${station}`).toBeLessThanOrEqual(station + 1e-6); station = Math.max(station, end); }
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
  const placements = closureResult.placements.placements.filter(p => p.scale && p.piece.endsWith('/2m-closure'));
  expect(placements).toHaveLength(fitted.length);
  for (const closure of fitted) {
    const road = fractional.streets.edges.find(r => r.id === closure.roadId)!;
    const origin = road.path[0]!, end = road.path.at(-1)!, station = closure.end - closure.fittedLength;
    const x = origin[0] + (end[0] - origin[0]) * station / closure.length;
    const z = origin[1] + (end[1] - origin[1]) * station / closure.length;
    const matching = placements.filter(p => Math.hypot(p.position[0] - x, p.position[2] - z) < 1e-7);
    expect(matching, closure.roadId).toHaveLength(1);
    const p = matching[0]!, piece = closurePieces.get(p.piece)!;
    expect(piece.length).toBe(2);
    expect(piece.variant).toBe('closure');
    expect(p.scale).toEqual([closure.fittedLength / 2, 1, 1]);
    expect(piece.surfaces.some(s => /Paint|crosswalk/.test(s))).toBe(false);
    expect(piece.surfaces).toContain('curb');
    const bytes = Buffer.from(closureResult.assets[`streets/${piece.file}`]!);
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) expect(primitive.extras.streetCollision).toBe(true);
    const footprint = placementFootprint(piece, p);
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
    for (const piece of here) expect([...new Set(piece.classes)].sort(), `${junction.id} ${piece.id}`).toEqual(classes);
    const arms = placed.filter(p => pieces.get(p.piece)!.kind === 'junction-arm' && positions.some(([x, z]) => Math.hypot(p.position[0] - x, p.position[2] - z) <= 8.7 + 1e-6));
    expect(arms.length, junction.id).toBeGreaterThan(0);
  }
});

it('places one original prop per constructed feature of the plan, inside its reserved bounds', () => {
  const pieces = new Map(result.kit.pieces.map(p => [p.id, p]));
  const props = result.placements.placements.filter(p => pieces.get(p.piece)!.kind === 'prop');
  const frontages = new Set(source.streets.construction.reservations.frontages.map(f => f.id));
  const roads = new Set(source.streets.edges.map(e => e.id));
  expect(result.features.length).toBeGreaterThan(0);
  expect(props).toHaveLength(result.features.length);
  expect(new Set(result.features.map(f => f.placement)).size).toBe(props.length);
  for (const feature of result.features) {
    const anchor = feature.frontageId ?? feature.roadId!;
    expect(frontages.has(anchor) || roads.has(anchor), feature.id).toBe(true);
    for (const [axis, plan] of [[0, 0], [2, 1]] as const) {
      expect(feature.bounds.min[axis], feature.id).toBeGreaterThanOrEqual(source.meta.bounds.min[plan]!);
      expect(feature.bounds.max[axis], feature.id).toBeLessThanOrEqual(source.meta.bounds.max[plan]!);
    }
    const placement = result.placements.placements[feature.placement]!;
    expect(props).toContain(placement);
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

it('rejects invalid input and plans it cannot read through build', async () => {
  await expect(build({ ...request, seed: NaN }, { nativeMaterials })).rejects.toMatchObject({ code: 'E_INVALID_PARAMS' });
  const version = { ...source, meta: { version: '0.24.0', units: 'meters' } };
  await expect(build({ ...request, blueprint: version }, { nativeMaterials })).rejects.toMatchObject({ code: 'E_UNSUPPORTED_ARCHITECTURE' });
  const { construction, ...streets } = source.streets;
  await expect(build({ ...request, blueprint: { ...source, streets } }, { nativeMaterials })).rejects.toMatchObject({ code: 'E_UNSUPPORTED_ARCHITECTURE' });
  expect(result.meta.blueprintHash).toBe(createHash('sha256').update(await readFile(blueprint)).digest('hex'));
});

it('fits parking slots, kerbs and returns to saved bays and reports unbuildable records', async () => {
  const authored = await build({ ...request, blueprint: parkingBlueprint() }, { nativeMaterials });
  const broken = parkingBlueprint(), bay = broken.streets.construction.reservations.parking[0]!;
  bay.footprint = bay.footprint.map(([x, z]) => [x, z + 0.1] as Vec2);
  bay.slots = bay.slots.map(slot => slot.map(([x, z]) => [x, z + 0.1] as Vec2));
  const dropped = await build({ ...request, blueprint: broken }, { nativeMaterials });
  expect(authored.report.degraded).toEqual([]);
  expect(dropped.report.degraded).toEqual([{ id: 'bay', reason: 'Parking footprint disagrees with authored ground' }]);
  const segments = (r: NativeStreetBuild) => r.placements.placements
    .map(p => r.kit.pieces.find(k => k.id === p.piece)!).filter(k => k.kind === 'segment');
  expect(segments(authored).filter(k => k.variant === 'parking-slot')).toHaveLength(6);
  expect(segments(dropped).some(k => k.variant === 'parking-slot')).toBe(false);
  expect(dropped.ground.cover).toEqual(authored.ground.cover);
  const city = source.streets.construction.reservations.parking;
  expect(result.report.degraded).toEqual([]);
  expect(segments(result).filter(k => k.variant === 'parking-slot')).toHaveLength(city.reduce((n, b) => n + b.slotCount, 0));
  for (const [built, plan] of [[authored, parkingBlueprint()], [result, source]] as const) {
    const pieces = new Map(built.kit.pieces.map(p => [p.id, p]));
    const faces = plan.streets.construction.reservations.frontages;
    const parking = built.placements.placements.filter(p => pieces.get(p.piece)!.variant.startsWith('parking-'));
    const triangles = new Map<string, { floor: Ring[]; paint: Ring[]; curb: Ring[] }>();
    for (const p of parking) if (!triangles.has(p.piece)) {
      const piece = pieces.get(p.piece)!;
      const document = await decodePiece(built.assets[`streets/${piece.file}`]!);
      const groups = { floor: [] as Ring[], paint: [] as Ring[], curb: [] as Ring[] };
      for (const node of document.getRoot().listNodes()) for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
        const surface = String(primitive.getMaterial()!.getExtras().streetNativeSurface);
        const kind = ['asphalt', 'district-hex'].includes(surface) ? 'floor' : surface === 'whitePaint' ? 'paint'
          : surface === 'curb' || surface.startsWith('district-curb-') ? 'curb' : undefined;
        if (!kind) continue;
        const indices = primitive.getIndices()!;
        for (let i = 0; i < indices.getCount(); i += 3) {
          const xyz = [0, 1, 2].map(k => worldPosition(node, primitive, indices.getScalar(i + k)));
          const [a, b, c] = xyz as [number[], number[], number[]];
          if ((b[2]! - a[2]!) * (c[0]! - a[0]!) - (b[0]! - a[0]!) * (c[2]! - a[2]!) <= 1e-8) continue;
          groups[kind].push(xyz.map(v => [v[0]!, v[2]!]));
        }
      }
      for (const k of ['floor','paint','curb'] as const) groups[k] = union(groups[k]);
      triangles.set(p.piece, groups);
    }
    for (const bay of plan.streets.construction.reservations.parking) {
      const face = faces.find(f => f.id === bay.frontageId)!;
      const d: Vec2 = [face.inward[1], -face.inward[0]];
      const local = ([x,z]: Vec2): Vec2 => [(x-face.start[0])*d[0]+(z-face.start[1])*d[1], (x-face.start[0])*face.inward[0]+(z-face.start[1])*face.inward[1]];
      const placed = parking.filter(p => {
        const [x,z] = local([p.position[0],p.position[2]]);
        return Math.abs(z)<1e-7 && x>=bay.support.start-1e-7 && x<bay.support.end;
      });
      expect(placed, bay.id).toHaveLength(bay.slotCount+2);
      expect(placed.map(p=>pieces.get(p.piece)!.variant)).toEqual(['parking-start', ...Array<string>(bay.slotCount).fill('parking-slot'), 'parking-end']);
      const stations = [bay.support.start, ...Array.from({ length: bay.slotCount }, (_, i) => bay.start + 2 + i * 6), bay.end - 2];
      placed.forEach((p, i) => expect(local([p.position[0], p.position[2]])[0], bay.id).toBeCloseTo(stations[i]!, 7));
      for (const p of placed) { expect(p.scale).toBeUndefined(); expect(p.rotationY).toBeCloseTo(-Math.atan2(d[1],d[0]), 7); }
      const geometry = (kind: 'floor' | 'paint' | 'curb') => placed.flatMap(p => placementFootprint({footprint:triangles.get(p.piece)![kind]},p)).map(r=>r.map(local));
      const floor = geometry('floor'), paint = geometry('paint'), curb = geometry('curb');
      expect(totalArea(difference([bay.footprint.map(local)],union(floor))),bay.id).toBeLessThan(0.01);
      expect(totalArea(difference(union(floor),[bay.footprint.map(local)])),bay.id).toBeLessThan(0.01);
      expect(totalArea(floor)-totalArea(union(floor)),bay.id).toBeLessThan(0.01);
      for (let i=0;i<=bay.slotCount;i++) {
        const x=bay.start+2+i*6;
        expect(totalArea(intersection(paint,[[[x,0.1],[x+0.12,0.1],[x+0.12,1.9],[x,1.9]]])),bay.id).toBeGreaterThan(0.21);
      }
      for (const x of [bay.start-0.7,bay.end+0.5])
        expect(totalArea(intersection(curb,[[[x,0.6],[x+0.2,0.6],[x+0.2,2.5],[x,2.5]]])),bay.id).toBeGreaterThan(0.36);
    }
  }
  const misplaced = parkingBlueprint();
  misplaced.streets.construction.reservations.parking[0]!.slots[1] = misplaced.streets.construction.reservations.parking[0]!.slots[0]!;
  const rejected = await build({...request,blueprint:misplaced},{nativeMaterials});
  expect(rejected.report.degraded).toEqual([{id:'bay',reason:'Parking does not match the rectangular bay and 6 m slot catalogue'}]);

}, 60_000);

it('reports whole transformed coverage, collision footprints and accepted fringes', () => {
  const pieces = new Map(result.kit.pieces.map(p => [p.id, p]));
  const surfaces = result.placements.placements.flatMap(p => {
    const piece = pieces.get(p.piece)!;
    if (!piece.hasCollision) return [];
    const rings = placementFootprint(piece, p);
    expect(totalArea(intersection(rings, result.ground.exclusions.map(e => e.polygon)))).toBeLessThan(1e-7);
    return piece.kind === 'prop' ? [] : rings;
  });
  const complete = union(surfaces), report = result.report.overhangs;
  expect(totalArea(difference(complete, result.ground.owners.map(g => g.polygon)))).toBeCloseTo(result.ground.cover.outsideArea, 6);
  expect(totalArea(surfaces) - totalArea(complete)).toBeCloseTo(report.overlapArea, 6);
  expect(report.accepted.length).toBeGreaterThan(0);
  expect(report.accepted.reduce((n, r) => n + r.boundaryArea, 0)).toBeCloseTo(report.boundaryArea, 6);
  expect(report.accepted.reduce((n, r) => n + r.fringeArea, 0)).toBeCloseTo(report.fringeArea, 6);
  for (const r of report.accepted) {
    expect(result.placements.placements[r.placement]!.piece).toBe(r.piece);
    expect(r.boundaryArea + r.fringeArea).toBeGreaterThan(1e-7);
  }
  const piece = result.kit.pieces.find(p => p.id === 'street/ordinary/local/2m-closure')!;
  const p = { piece: piece.id, position: [19, 3, 7] as const, rotationY: Math.PI / 2, scale: [0.5, 1, 2] as const, cell: [0, 0] as const, ownerId: 'roadway', ownerIds: ['roadway'] };
  const footprint = placementFootprint(piece, p);
  expect(footprint).toHaveLength(piece.footprint.length);
  piece.footprint.forEach((ring, i) => {
    expect(footprint[i]).toHaveLength(ring.length);
    ring.forEach(([x, z], j) => {
      expect(footprint[i]![j]![0]).toBeCloseTo(19 + z * 2, 7);
      expect(footprint[i]![j]![1]).toBeCloseTo(7 - x * 0.5, 7);
    });
  });
});

it('publishes footprints matching drawable GLB triangles without geometry selection', async () => {
  for (const piece of result.kit.pieces) {
    const decoded = await decodePiece(result.assets[`streets/${piece.file}`]!);
    const triangles: Ring[] = [];
    for (const node of decoded.getRoot().listNodes()) for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      if (piece.hasCollision && !primitive.getExtras().streetCollision) continue;
      const indices = primitive.getIndices()!;
      for (let i = 0; i < indices.getCount(); i += 3) {
        const ring = [0, 1, 2].map(k => { const p = worldPosition(node, primitive, indices.getScalar(i + k)); return [p[0]!, p[2]!] as Vec2; });
        const signed = area(ring);
        if (Math.abs(signed) > 1e-10) triangles.push(signed < 0 ? ring.reverse() : ring);
      }
    }
    const footprint = union(triangles);
    const perimeter = piece.footprint.reduce((n, r) => n + r.reduce((m, p, i) => {
      const q = r[(i + 1) % r.length]!; return m + Math.hypot(p[0] - q[0], p[1] - q[1]);
    }, 0), 0);
    const error = totalArea(difference(footprint, piece.footprint)) + totalArea(difference(piece.footprint, footprint));
    expect(error, piece.id).toBeLessThan(perimeter * 0.001 + 1e-6);
  }
});

it('bakes one dash phase, approach paint, corner seams and shader ready overlays', async () => {
  const piece = result.kit.pieces.find(p => p.id === 'road/ordinary/avenue/8m-plain')!;
  const decoded = await decodePiece(result.assets[`streets/${piece.file}`]!);
  const dash: number[] = [];
  for (const node of decoded.getRoot().listNodes()) for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
    if (primitive.getMaterial()!.getExtras().streetNativeSurface !== 'whitePaint') continue;
    expect(primitive.getExtras().streetCollision).toBe(false);
    const indices = primitive.getIndices()!;
    for (let i = 0; i < indices.getCount(); i++) {
      const p = worldPosition(node, primitive, indices.getScalar(i));
      if (Math.abs(p[2]! - 3.5) < 0.07) dash.push(p[0]!);
    }
  }
  expect(dash.length).toBeGreaterThan(0);
  expect(Math.min(...dash)).toBeCloseTo(0, 3);
  expect(Math.max(...dash)).toBeCloseTo(4, 3);
  for (const zone of ['ordinary', 'luxury', 'industrial']) {
    const arm = result.kit.pieces.find(p => p.id === `junction/${zone}/avenue/arm`)!;
    expect(arm.surfaces).toContain('yellowPaint');
    expect(arm.footprint.flat().some(([x, z]) => Math.abs(x - (Math.abs(z) - 7)) < 1e-7)).toBe(true);
  }
  const overlays = result.kit.pieces.filter(p => p.kind === 'overlay');
  expect(overlays.filter(p => p.variant === 'arrow')).toHaveLength(7);
  expect(overlays.filter(p => p.variant === 'drain')).toHaveLength(2);
  expect(overlays.filter(p => p.variant === 'scan')).toHaveLength(1);
  expect(overlays.every(p => !p.hasCollision)).toBe(true);
  const quad = overlays.find(p => p.variant === 'scan')!;
  expect(quad.triangles).toBe(2);
  const scans = result.placements.placements.filter(p => p.scan);
  expect(scans.length).toBeGreaterThan(0);
  for (const p of scans) {
    expect(p.piece).toBe(quad.id);
    expect(p.scan!.scale).toEqual([1 / result.kit.scanAtlas.length, 1]);
    expect(p.scan!.offset[0] * result.kit.scanAtlas.length).toBeLessThan(result.kit.scanAtlas.length);
  }
  const displays = result.placements.placements.filter(p => p.text);
  expect(displays.length).toBeGreaterThan(0);
  for (const p of displays) {
    expect(p.text!.every(g => g >= 0 && g < result.kit.glyphs.length)).toBe(true);
    expect(result.kit.pieces.find(k => k.id === p.piece)!.surfaces).toContain('district-marquee');
  }
});
