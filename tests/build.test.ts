import { beforeAll, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { decodePiece, worldPosition } from '../src/assets/decode-fixture.ts';
import { build, placementFootprint } from '../src/index.ts';
import { UnitPlan } from '../src/construction/units/UnitPlan.ts';
import { PIECE_BUDGET } from '../src/construction/units/KitCatalogue.ts';
import { readNativeAtlas } from '../src/architecture/NativeAtlas.ts';
import type { NativeStreetBuild } from '../src/schema/native-result.ts';
import type { Ring, Vec2 } from '../src/geometry/schema.ts';
import kitSchema from '../schemas/street-kit.schema.json' with { type: 'json' };
import placementSchema from '../schemas/street-placement.schema.json' with { type: 'json' };
import catalog from './fixtures/native-materials.json' with { type: 'json' };
import type { NativeMaterialCatalog } from '../src/schema/native-materials.ts';
import { area, bounds, difference, intersection, totalArea, union } from '../src/geometry/polygons.ts';

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
      medians: { id: string; edgeId: string; start: number; end: number; footprint: Ring }[];
      reservations: { owners: { id: string; kind: string; groundIndices: number[] }[]; frontages: { id: string; ownerId: string; start: Vec2; end: Vec2; inward: Vec2; pavedWidth: number; gutterWidth: number; curbWidth: number }[]; parking: ParkingBay[] };
    };
  };
  volumetric: { ground: { surface: string; polygon: Ring }[] };
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


/** A complete district cross section exercises fitted closures without accepting an overhang. */
function symmetricBlueprint() {
  const plan = fractionalBlueprint(), length = 31.7;
  const strip = (z: number, width: number): Ring => [[0,z],[length,z],[length,z+width],[0,z+width]];
  plan.streets.construction.modules.format = 'district';
  plan.meta.bounds = {min:[0,-8.4],max:[length,8.4]};
  plan.meta.boundary = strip(-8.4,16.8);
  plan.volumetric.ground = [{surface:'roadway',polygon:strip(-3.5,7),bottom:-0.2,top:0},
    ...[1,-1].flatMap(sign => [['gutter',3.5,0.5,0],['curb',4,0.2,0.2],['sidewalk',4.2,4.2,0.2]].map(([surface,offset,width,top]) => ({
      surface: String(surface), polygon:strip(sign > 0 ? Number(offset) : -Number(offset)-Number(width),Number(width)),bottom:-0.2,top:Number(top)})))];
  const reservation = plan.streets.construction.reservations;
  reservation.groundArray.count = 7; reservation.owners[1]!.groundIndices = [1,2,3,4,5,6];
  const face = reservation.frontages[0]!;
  Object.assign(face,{pavedWidth:4.2,gutterWidth:0.5});
  reservation.frontages.push({...face,id:'frontage:opposite',start:[length,-3.5],end:[0,-3.5],inward:[0,-1]});
  return plan;
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
    .toEqual([[8, 'plain'], [4, 'closure'], [2, 'closure'], ...(p.width ? [[8, 'core'], [2, 'core-closure']] : []),
      ...(p.medianWidth ? [[2, 'island-nose'], [2, 'island'], [8, 'island']] : []),
      ...(p.zone === 'ordinary' && p.streetClass === 'road' ? [[8, 'under'], [2, 'under']] : [])].sort());
  expect(result.statistics.pieces).toBeLessThanOrEqual(PIECE_BUDGET);
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
  expect(mapped.placements.placements.some(p => p.piece.startsWith('infill/'))).toBe(true);
  expect(mapped.kit).toEqual(result.kit);
  expect(mapped.ground.cover.missingArea).toBeLessThan(1e-7);
  expect(mapped.ground.cover.outsideArea).toBeLessThan(1e-7);
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
  for (const road of source.streets.edges) {
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
  const fractional = symmetricBlueprint();
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
  // A fitted fraction is a 2 m road core and a 2 m kerb walk either side, each scaled to it.
  const placements = closureResult.placements.placements.filter(p => p.scale && p.piece.endsWith('/2m-core-closure'));
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
    expect(piece.variant).toBe('core-closure');
    expect(p.scale).toEqual([closure.fittedLength / 2, 1, 1]);
    expect(piece.surfaces.some(s => /Paint|crosswalk/.test(s))).toBe(false);
    const walks = closureResult.placements.placements.filter(w => w.piece.endsWith('/walk-closure') && w.scale?.[0] === closure.fittedLength / 2);
    expect(walks, closure.roadId).toHaveLength(2);
    expect(walks.every(w => closurePieces.get(w.piece)!.surfaces.includes('curb'))).toBe(true);
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
  const reserved = source.streets.construction.junctions;
  expect(reserved.length).toBeGreaterThan(0);
  for (const junction of reserved) {
    const classes = [...new Set(junction.approaches.map(a => classOf.get(a.edgeId)!))].sort();
    const positions = junction.nodeIds.map(id => nodeOf.get(id)!.position);
    const here = placed.filter(p => positions.some(([x, z]) => Math.hypot(p.position[0] - x, p.position[2] - z) < 1e-6)).map(p => pieces.get(p.piece)!);
    const highway = junction.nodeIds.some(id => nodeOf.get(id)!.edgeIds.some(e => classOf.get(e) === 'highway'));
    if (highway) {
      const physical = result.placements.placements.flatMap(p => { const piece = pieces.get(p.piece)!; return piece.kind === 'prop' || piece.kind === 'overlay' ? [] : placementFootprint(piece, p); });
      for (const [x, z] of positions) expect(totalArea(intersection(physical, [[[x-0.05,z-0.05],[x+0.05,z-0.05],[x+0.05,z+0.05],[x-0.05,z+0.05]]])), junction.id).toBeCloseTo(0.01, 6);
      continue;
    }
    expect(here.filter(p => p.kind === 'junction-center'), junction.id).toHaveLength(1);
    for (const piece of here) expect([...new Set(piece.classes)].sort(), `${junction.id} ${piece.id}`).toEqual(classes);
    const arms = placed.filter(p => pieces.get(p.piece)!.kind === 'junction-arm' && positions.some(([x, z]) => Math.hypot(p.position[0] - x, p.position[2] - z) <= 8.7 + 1e-6));
    expect(arms.length, junction.id).toBeGreaterThan(0);
  }
});

it('builds corners, tees, highway corridors and median islands from whole units, with concrete only on the kerb where a highway corridor ends at a street beneath it', () => {
  const pieces = new Map(result.kit.pieces.map(p => [p.id, p])), placements = result.placements.placements;
  const footprints = (list: typeof placements) => list.flatMap(p => placementFootprint(pieces.get(p.piece)!, p));
  const { owners, frontages } = source.streets.construction.reservations;
  // A tee's far side and a corner's outer side are the crossing street's kerb, built as one far kerb in its block's finish.
  expect(placements.filter(p => p.piece.startsWith('junction/far-kerb/')).length).toBeGreaterThanOrEqual(8);
  // A highway's grade corridor ends at the saved kerb line of each street passing beneath it. That kerb's gutter and
  // curb, across the roadway and both corridor sidewalks, is the only place concrete infill may remain.
  const underpass = new Set(owners.filter(o => o.kind === 'underpass').map(o => o.id));
  const kerbs = frontages.filter(f => underpass.has(f.ownerId) && f.id.endsWith(':highway')).map((f): Ring => {
    const length = Math.hypot(f.end[0] - f.start[0], f.end[1] - f.start[1]), kerb = f.gutterWidth + f.curbWidth, side = f.pavedWidth + kerb;
    const along = (p: Vec2, x: number, z = 0): Vec2 => [p[0] + (f.end[0] - f.start[0]) / length * x + f.inward[0] * z, p[1] + (f.end[1] - f.start[1]) / length * x + f.inward[1] * z];
    const ring = [along(f.start, -side), along(f.end, side), along(f.end, side, kerb), along(f.start, -side, kerb)];
    return area(ring) < 0 ? [...ring].reverse() : ring;
  });
  expect(kerbs.length).toBeGreaterThan(0);
  const concrete = footprints(placements.filter(p => p.piece === 'infill/concrete'));
  expect(totalArea(difference(concrete, kerbs))).toBeLessThan(1e-6);
  // 0.7 m by the corridor's 23.8 m at most per side, on gutter, curb and walk, never on the roadway.
  for (const kerb of kerbs) expect(totalArea(intersection(concrete, [kerb]))).toBeLessThanOrEqual(area(kerb) + 1e-6);
  expect(Math.max(...kerbs.map(area))).toBeLessThan(17);
  const roadway = source.volumetric.ground.filter(g => g.surface === 'roadway').map(g => g.polygon);
  expect(totalArea(intersection(concrete, roadway))).toBeLessThan(1e-6);
  // A highway's grade corridor is a court at road level, never a carriageway; its deck stays delegated.
  expect(result.delegated.highways.count).toBeGreaterThan(0);
  for (const edge of source.streets.edges.filter(e => e.class === 'highway')) {
    const [a, b] = [edge.path[0]!, edge.path.at(-1)!], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const along = (p: typeof placements[number]) => Math.abs(Math.cos(p.rotationY) * (b[1] - a[1]) + Math.sin(p.rotationY) * (b[0] - a[0])) / length < 1e-6;
    const on = placements.filter(p => pieces.get(p.piece)!.kind === 'segment' && !p.piece.startsWith('infill/') && along(p)
      && Math.abs((p.position[0] - a[0]) * (b[1] - a[1]) - (p.position[2] - a[1]) * (b[0] - a[0])) / length < 1e-6);
    expect(on.length, edge.id).toBeGreaterThan(0);
    expect(on.every(p => pieces.get(p.piece)!.variant === 'under'), edge.id).toBe(true);
    const court = 'hex-orange' in nativeMaterials.surfaces ? 'hex-orange' : 'district-hex';
    expect(on.every(p => pieces.get(p.piece)!.surfaces.join() === court), edge.id).toBe(true);
  }
  // Each saved island is covered exactly by a nose at either end and whole units between, at its Atlas stations.
  expect(source.streets.construction.medians.length).toBeGreaterThan(0);
  for (const median of source.streets.construction.medians) {
    const units = placements.filter(p => p.piece.startsWith('island/') && p.ownerId === median.id), covered = footprints(units);
    expect(units.filter(p => p.piece.endsWith('-nose')), median.id).toHaveLength(2);
    expect(units.every(p => !p.scale), median.id).toBe(true);
    expect(Math.abs(totalArea(covered) - area(median.footprint)), median.id).toBeLessThan(1e-6);
    expect(totalArea(difference([median.footprint], covered)), median.id).toBeLessThan(1e-6);
    expect(totalArea(intersection(concrete, [median.footprint])), median.id).toBe(0);
  }
  // The band ahead of each nose is luxury carriageway: world sampled paving, never concrete.
  expect(placements.some(p => p.piece === 'infill/district-hex')).toBe(true);
  expect(placements.some(p => p.piece === 'infill/asphalt')).toBe(false);
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
  for (const key of Object.keys(authored.ground.cover) as (keyof typeof authored.ground.cover)[]) expect(dropped.ground.cover[key]).toBeCloseTo(authored.ground.cover[key], 6);
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
      // The floor fills the bay's rectangular notch and holds its footprint, square or with 45 degree returns.
      const notch: Ring = [[bay.start,0],[bay.end,0],[bay.end,2],[bay.start,2]];
      expect(totalArea(difference([notch],union(floor))),bay.id).toBeLessThan(0.01);
      expect(totalArea(difference(union(floor),[notch])),bay.id).toBeLessThan(0.01);
      expect(totalArea(difference([bay.footprint.map(local)],union(floor))),bay.id).toBeLessThan(0.01);
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

it('reports whole transformed coverage and collision footprints, every surface on saved ground and none repeated', () => {
  const pieces = new Map(result.kit.pieces.map(p => [p.id, p]));
  const surfaces = result.placements.placements.flatMap(p => {
    const piece = pieces.get(p.piece)!;
    if (!piece.hasCollision) return [];
    const rings = placementFootprint(piece, p);
    expect(totalArea(intersection(rings, result.ground.exclusions.map(e => e.polygon)))).toBeLessThan(1e-7);
    return piece.kind === 'prop' ? [] : rings;
  });
  const complete = union(surfaces);
  expect(totalArea(difference(complete, result.ground.owners.map(g => g.polygon)))).toBeCloseTo(result.ground.cover.outsideArea, 6);
  expect(result.ground.cover.outsideArea).toBeLessThan(1e-6);
  expect(totalArea(difference(complete, source.volumetric.ground.map(g => g.polygon)))).toBeLessThan(1e-6);
  expect(totalArea(surfaces) - totalArea(complete)).toBeLessThan(1e-6);
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

it('bakes one dash phase and corner seams and places crossing paint from Atlas', async () => {
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
    expect(arm.surfaces.some(s => /Paint|crosswalk/.test(s))).toBe(false);
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
    expect(result.kit.pieces.find(k => k.id === p.piece)!.surfaces).toContain('marquee-led');
  }
});

/** Decoded triangles of one kit piece as world positions and TEXCOORD_0, keyed by native surface. */
async function pieceTriangles(built: NativeStreetBuild, id: string) {
  const piece = built.kit.pieces.find(p => p.id === id)!;
  const document = await decodePiece(built.assets[`streets/${piece.file}`]!);
  const surfaces = new Map<string, { p: number[]; uv: number[] }[][]>();
  for (const node of document.getRoot().listNodes()) for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
    const surface = String(primitive.getMaterial()!.getExtras().streetNativeSurface), indices = primitive.getIndices()!, uv = primitive.getAttribute('TEXCOORD_0')!;
    for (let i = 0; i < indices.getCount(); i += 3) (surfaces.get(surface) ?? surfaces.set(surface, []).get(surface)!)
      .push([0, 1, 2].map(k => ({ p: worldPosition(node, primitive, indices.getScalar(i + k)), uv: uv.getElement(indices.getScalar(i + k), []) })));
  }
  return { piece, surfaces };
}

/** Least plan distance between two rings; zero where they overlap. */
function ringGap(a: Ring, b: Ring): number {
  if (totalArea(intersection([a], [b])) > 1e-9) return 0;
  const toSegment = (p: Vec2, s: Vec2, e: Vec2) => {
    const d = [e[0] - s[0], e[1] - s[1]], l = d[0]! ** 2 + d[1]! ** 2, t = l ? Math.max(0, Math.min(1, ((p[0] - s[0]) * d[0]! + (p[1] - s[1]) * d[1]!) / l)) : 0;
    return Math.hypot(p[0] - s[0] - t * d[0]!, p[1] - s[1] - t * d[1]!);
  };
  return Math.min(...[[a, b], [b, a]].flatMap(([x, y]) => x!.flatMap(p => y!.map((s, i) => toSegment(p, s, y![(i + 1) % y!.length]!)))));
}

it('publishes the capped LED run as 2 m and 1 m segments and a mirrored cap pair within their budgets', async () => {
  const ids = new Set(result.kit.pieces.map(p => p.id));
  expect(ids.has('prop/marquee/2m-0.5m-0')).toBe(false);
  expect(result.kit.pieces).toHaveLength(255);
  const key = (p: number[]) => p.map(n => Math.round(n * 1000) || 0).join();
  const vertices = (surfaces: Map<string, { p: number[] }[][]>) => [...surfaces.values()].flat(2);
  for (const [id, length, budget] of [['prop/marquee-run/segment-2m', 2, 150], ['prop/marquee-run/segment-1m', 1, 100],
    ['prop/marquee-run/cap-start', 0.27, 40], ['prop/marquee-run/cap-end', 0.27, 40]] as const) {
    const { piece, surfaces } = await pieceTriangles(result, id), cap = id.includes('/cap-');
    expect(piece.triangles, id).toBeLessThanOrEqual(budget);
    expect(piece.hasCollision, id).toBe(true);
    expect(piece.bounds.min[0]).toBeCloseTo(-length / 2, 3); expect(piece.bounds.max[0]).toBeCloseTo(length / 2, 3);
    expect(piece.bounds.max[1]).toBeCloseTo(0.185, 3); expect(piece.bounds.max[2]).toBeCloseTo(0.5, 3);
    expect(piece.bounds.min[2]).toBeCloseTo(cap ? 0.065 : 0, 3);
    if (cap) { expect(piece.surfaces).toHaveLength(1); continue; }
    const mirrored = new Set(vertices(surfaces).map(v => key([-v.p[0]!, v.p[1]!, v.p[2]!])));
    expect(vertices(surfaces).every(v => mirrored.has(key(v.p))), id).toBe(true);
    // The LED field is its own slot; UV metres run left to right seen from the road and road to curb.
    const field = surfaces.get('marquee-led')!.flat();
    expect(field).toHaveLength(6);
    for (const v of field) { expect(v.uv[0]! + v.p[0]!).toBeCloseTo(length / 2 - 0.04, 4); expect(v.uv[1]!).toBeCloseTo(v.p[2]! - 0.165, 4); }
    expect(Math.max(...field.map(v => v.uv[0]!))).toBeCloseTo(length - 0.08, 4);
    expect(Math.max(...field.map(v => v.uv[1]!))).toBeCloseTo(0.23, 4);
    // A channel riser at Z 0.135 closes the 1 cm seam between frames over the full length.
    const riser = surfaces.get('darkMetal')!.filter(t => t.every(v => Math.abs(v.p[2]! - 0.135) < 1e-4)).flat();
    expect([Math.min(...riser.map(v => v.p[0]!)), Math.max(...riser.map(v => v.p[0]!))]).toEqual([-length / 2, length / 2].map(n => expect.closeTo(n, 4)));
    expect([Math.min(...riser.map(v => v.p[1]!)), Math.max(...riser.map(v => v.p[1]!))]).toEqual([expect.closeTo(0.06, 4), expect.closeTo(0.1, 4)]);
  }
  // The caps mirror each other in X; each cuts its outer curb-side corner 6 cm in plan and keeps its inner end square.
  const [start, end] = await Promise.all(['cap-start', 'cap-end'].map(async side => vertices((await pieceTriangles(result, `prop/marquee-run/${side}`)).surfaces)));
  const ends = new Set(end!.map(v => key(v.p)));
  expect(start!.every(v => ends.has(key([-v.p[0]!, v.p[1]!, v.p[2]!])))).toBe(true);
  const curb = start!.filter(v => Math.abs(v.p[2]! - 0.5) < 1e-3).map(v => v.p[0]!);
  expect([Math.min(...curb), Math.max(...curb)]).toEqual([expect.closeTo(-0.135 + 0.06, 3), expect.closeTo(0.135, 3)]);
});

it('places capped runs on luxury and industrial-yellow frontages midway between drains or in a bare frontage\'s clear stretch, clear of drains, cables and crossings, one message per run', async () => {
  const architecture = await readNativeAtlas(blueprint);
  const owners = new Map(source.streets.construction.reservations.owners.map(o => [o.id, o as { id: string; finish?: string | null }]));
  const pieces = new Map(result.kit.pieces.map(p => [p.id, p]));
  const footprint = (index: number) => placementFootprint(pieces.get(result.placements.placements[index]!.piece)!, result.placements.placements[index]!).flat() as Ring;
  const station = (id: string) => Number(id.split(':').at(-2));
  const runs: typeof result.features[] = [];
  for (const frontage of new Set(result.features.map(f => f.frontageId))) {
    const list = result.features.filter(f => f.frontageId === frontage && f.kind.startsWith('marquee')).sort((a, b) => station(a.id) - station(b.id));
    for (let i = 0; i < list.length;) { let j = i + 1; while (list[j]!.kind !== 'marquee-cap') j++; runs.push(list.slice(i, j + 1)); i = j + 1; }
  }
  expect(runs.length).toBeGreaterThan(20);
  const drains = result.features.filter(f => f.kind === 'inlet' || f.kind === 'cable');
  const crossings = architecture.approaches.flatMap(a => [a.field, ...a.landings]);
  for (const run of runs) {
    const [first, last] = [run[0]!, run.at(-1)!], segments = run.slice(1, -1);
    expect([first.kind, last.kind]).toEqual(['marquee-cap', 'marquee-cap']);
    expect([first, last].map(f => result.placements.placements[f.placement]!.piece)).toEqual(['prop/marquee-run/cap-start', 'prop/marquee-run/cap-end']);
    expect(segments.every(f => f.kind === 'marquee' && [1, 2].includes(f.length)) && [2, 3].includes(segments.length)).toBe(true);
    const a = station(first.id), b = station(last.id) + last.length;
    expect(b - a).toBeGreaterThanOrEqual(4.5);
    run.forEach((f, i) => i && expect(station(f.id)).toBeCloseTo(station(run[i - 1]!.id) + run[i - 1]!.length, 6));
    expect(owners.get(first.ownerId)!.finish).toMatch(/^(luxury-(red|blue)|industrial-yellow)$/);
    // A strip run is centred on its bay, on the bay's gutter. Curb runs are centred midway between two drain stations of the
    // 24 m grid (8 + 24k), or are the one run of a frontage that grid left bare.
    const setback = Number(first.id.split(':').at(-1)), alone = runs.filter(other => other[0]!.frontageId === first.frontageId).length === 1;
    if (setback) {
      const bay = source.streets.construction.reservations.parking.find(bay => bay.frontageId === first.frontageId)!;
      expect([setback, (a + b) / 2]).toEqual([bay.depth, expect.closeTo((bay.start + bay.end) / 2, 6)]);
    } else if (!alone) expect(((a + b) / 2 - 21) % 24).toBeCloseTo(0, 6);
    const texts = segments.map(f => JSON.stringify(result.placements.placements[f.placement]!.text));
    expect(new Set(texts).size).toBe(1);
    expect(texts[0]).toMatch(/^\[\d/);
    for (const cap of [first, last]) expect(result.placements.placements[cap.placement]!.text).toBeUndefined();
    for (const f of run) {
      const ring = footprint(f.placement);
      for (const drain of drains) expect(ringGap(ring, drain.footprint), `${f.id} ${drain.id}`).toBeGreaterThanOrEqual(4 - 1e-6);
      for (const crossing of crossings) expect(ringGap(ring, crossing), f.id).toBeGreaterThanOrEqual(6 - 1e-6);
    }
  }
  // Every luxury or industrial-yellow frontage with 16.54 m of clear curb (a 4.54 m run and both 6 m end clearances; no drain,
  // cable or parking bay on it) carries a run, the grade side of an underpass and the frontages under a highway included.
  const roads = new Map(architecture.roads.map(road => [road.id, road.kind]));
  const clear = architecture.owners.filter(owner => /^(luxury-(red|blue)|industrial-yellow)$/.test(owner.finish ?? '') && ['block', 'perimeter', 'underpass'].includes(owner.kind))
    .flatMap(owner => owner.frontages.filter(face => face.gutterWidth === 0.5 && face.length >= 16.54 - 1e-9
      && !owner.parking.some(bay => bay.frontageId === face.id) && !drains.some(f => f.frontageId === face.id)));
  expect(clear.some(face => face.id.startsWith('frontage:underpass:'))).toBe(true);
  expect(clear.some(face => face.edgeIds.every(id => roads.get(id) === 'highway'))).toBe(true);
  const closures = new UnitPlan(architecture).regions.filter(r => r.kind === 'segment' && r.length < 2).flatMap(r => r.mask);
  for (const face of clear) {
    const strip: Ring = [face.start, [face.start[0]+face.inward[0]*0.7,face.start[1]+face.inward[1]*0.7],
      [face.end[0]+face.inward[0]*0.7,face.end[1]+face.inward[1]*0.7],face.end];
    if (totalArea(intersection([area(strip) < 0 ? [...strip].reverse() : strip], closures)) > 1e-7) continue;
    expect(runs.some(run => run[0]!.frontageId === face.id), face.id).toBe(true);
  }
  // The plan's parking strips carry runs of their own.
  expect(runs.filter(run => run[0]!.id.endsWith(':2')).length).toBeGreaterThan(0);
  const again = await build(request, { nativeMaterials, mode: 'manifest' });
  expect(again.placements).toEqual(result.placements);
  // A red or yellow parking strip carries one run centred on its slots, on the bay's own gutter.
  for (const finish of ['luxury-red', 'industrial-yellow']) {
    const plan = parkingBlueprint();
    plan.streets.construction.reservations.owners[1]!.finish = finish;
    const parked = await build({ ...request, blueprint: plan }, { nativeMaterials, mode: 'manifest' });
    const strip = parked.features.filter(f => f.kind.startsWith('marquee')).sort((x, y) => station(x.id) - station(y.id));
    expect(strip.map(f => f.kind === 'marquee-cap' ? 'cap' : f.length), finish).toEqual(['cap', 2, 2, 2, 'cap']);
    expect(strip.every(f => Number(f.id.split(':').at(-1)) === 2)).toBe(true);
    expect((station(strip[0]!.id) + station(strip.at(-1)!.id) + 0.27) / 2).toBeCloseTo(24, 6);
  }
}, 60_000);

it('draws each drain station as one inlet with a flush grate and curb throats under a cover-only overlay', async () => {
  const overlay = await pieceTriangles(result, 'overlay/drain/0.7m');
  // This binding has no drain cover yet, so the hatch falls back to the tread plate.
  expect([...overlay.surfaces.keys()]).toEqual(['tread']);
  expect(overlay.piece.triangles).toBe(2);
  // The 2 x 2 m hatch's UVs run in metres.
  const uv = overlay.surfaces.get('tread')!.flat(), corner = (u: number, v: number) => uv.some(x => Math.abs(x.uv[0]! - u) < 1e-4 && Math.abs(x.uv[1]! - v) < 1e-4);
  expect([corner(0, 0), corner(2, 0), corner(0, 2), corner(2, 2)]).toEqual([true, true, true, true]);
  const inlet = await pieceTriangles(result, 'prop/inlet/2m-0.7m-0');
  expect(inlet.piece.surfaces).toEqual(['concrete', 'darkMetal', 'metal']);
  // Bars follow the 6 cm gutter crown 5 mm proud; the insert faces the road with four dark throats.
  for (const v of inlet.surfaces.get('metal')!.flat()) expect(v.p[1]! - 0.12 * v.p[2]!).toBeCloseTo(0.005, 4);
  const throats = inlet.surfaces.get('darkMetal')!.filter(t => t.every(v => Math.abs(v.p[2]! - 0.49) < 1e-4));
  expect(throats).toHaveLength(4);
  const placed = result.placements.placements;
  const stations = placed.filter(p => p.piece === 'prop/inlet/2m-0.7m-0'), overlays = placed.filter(p => p.piece === 'overlay/drain/0.7m');
  expect(overlays.map(p => p.position)).toEqual(stations.map(p => p.position));
});

it('binds drain covers and grates and patched infill asphalt where the binding carries them, else their older surfaces', async () => {
  const surfaces = (built: NativeStreetBuild, id: string) => built.kit.pieces.find(p => p.id === id)!.surfaces;
  expect(surfaces(result, 'overlay/drain/0.7m')).toEqual(['tread']);
  expect(surfaces(result, 'infill/asphalt')).toEqual(['asphalt']);
  const access = result.kit.pieces.filter(p => p.surfaces.includes('perforated') && p.id.includes('access'));
  expect(access.length).toBeGreaterThan(0);
  const binding = structuredClone(nativeMaterials);
  binding.surfaces.drainCover = binding.surfaces.tread!;
  binding.surfaces.drainGrate = binding.surfaces.perforated!;
  binding.surfaces['asphalt-patched'] = binding.surfaces.ordinary!;
  const bound = await build(request, { nativeMaterials: binding, mode: 'manifest' });
  expect(surfaces(bound, 'overlay/drain/0.7m')).toEqual(['drainCover']);
  expect(surfaces(bound, 'infill/asphalt')).toEqual(['asphalt-patched']);
  for (const piece of access) expect(surfaces(bound, piece.id), piece.id).toContain('drainGrate');
  // The geometry is the same: a binding names finishes, never shapes.
  expect(bound.kit.pieces.map(p => [p.id, p.triangles])).toEqual(result.kit.pieces.map(p => [p.id, p.triangles]));
});

it('resolves marquee surfaces through the binding, falling back to existing surfaces when it lacks them, except the LED field', async () => {
  const surfaces = (built: NativeStreetBuild, id: string) => built.kit.pieces.find(p => p.id === id)!.surfaces;
  expect(surfaces(result, 'prop/marquee-run/segment-2m')).toEqual(['concrete', 'darkMetal', 'marquee-led', 'ochre']);
  expect(surfaces(result, 'prop/marquee-run/cap-start')).toEqual(['darkMetal']);
  const binding = structuredClone(nativeMaterials);
  for (const [name, like] of [['marquee-channel', 'darkMetal'], ['marquee-frame', 'ochre'], ['marquee-lip', 'concrete'], ['marquee-cap', 'darkMetal']] as const)
    binding.surfaces[name] = binding.surfaces[like]!;
  const bound = await build({ ...request, blueprint: fractionalBlueprint() }, { nativeMaterials: binding, mode: 'manifest' });
  expect(surfaces(bound, 'prop/marquee-run/segment-2m')).toEqual(['marquee-channel', 'marquee-frame', 'marquee-led', 'marquee-lip']);
  expect(surfaces(bound, 'prop/marquee-run/cap-end')).toEqual(['marquee-cap']);
  // The LED field has no fallback: a binding without it fails the build and names it.
  const bare = structuredClone(nativeMaterials);
  delete bare.surfaces['marquee-led'];
  await expect(build({ ...request, blueprint: fractionalBlueprint() }, { nativeMaterials: bare, mode: 'manifest' }))
    .rejects.toMatchObject({ code: 'E_INVALID_PARAMS', details: { surfaceId: 'marquee-led' } });
});

it('keeps every underpass lane continuous at grade, with no raised triangles', async () => {
  const a = await readNativeAtlas(blueprint), pieces = new Map(result.kit.pieces.map(p => [p.id,p]));
  const nodes = new Set(a.protections.filter(p => p.kind === 'underpass').map(p => String(p.source.nodeId)));
  expect(nodes.size).toBeGreaterThan(0);
  const decoded = new Map<string, Awaited<ReturnType<typeof pieceTriangles>>>();
  for (const nodeId of nodes) for (const road of a.roads.filter(r => r.kind !== 'highway' && (r.from === nodeId || r.to === nodeId))) {
    const node = road.from === nodeId ? road.path[0]! : road.path.at(-1)!;
    const origin = road.path[0]!, end = road.path.at(-1)!, length = Math.hypot(end[0]-origin[0],end[1]-origin[1]);
    const d: Vec2 = [(end[0]-origin[0])/length,(end[1]-origin[1])/length], n: Vec2 = [-d[1],d[0]];
    for (const lane of road.lanes) {
      const world = (x: number,z: number): Vec2 => [node[0]+d[0]*x+n[0]*z,node[1]+d[1]*x+n[1]*z];
      const region = [world(-8,lane.offset-lane.width/2),world(8,lane.offset-lane.width/2),world(8,lane.offset+lane.width/2),world(-8,lane.offset+lane.width/2)];
      const cover: Ring[] = [];
      for (const placement of result.placements.placements) {
        const piece = pieces.get(placement.piece)!;
        if (!piece.hasCollision || totalArea(intersection(placementFootprint(piece,placement),[region])) < 1e-7) continue;
        if (!decoded.has(piece.id)) decoded.set(piece.id,await pieceTriangles(result,piece.id));
        const c = Math.cos(placement.rotationY), s = Math.sin(placement.rotationY), scale = placement.scale ?? [1,1,1];
        for (const triangle of [...decoded.get(piece.id)!.surfaces.values()].flat()) {
          const points = triangle.map(v => [placement.position[0]+c*v.p[0]!*scale[0]+s*v.p[2]!*scale[2],
            placement.position[1]+v.p[1]!*scale[1],placement.position[2]-s*v.p[0]!*scale[0]+c*v.p[2]!*scale[2]]);
          let ring: Ring = points.map(p => [p[0]!,p[2]!] as Vec2);
          if (Math.abs(area(ring)) < 1e-8) continue;
          if (area(ring) < 0) ring = [...ring].reverse();
          if (points.some(p => p[1]! > 0.05)) expect(totalArea(intersection([ring],[region])),`${nodeId} ${lane.id} ${piece.id}`).toBeLessThan(0.001);
          if (points.every(p => Math.abs(p[1]!) < 0.001)) cover.push(ring);
        }
      }
      // Quantized GLBs permit 1 mm at an edge; the entire lane interior must be asphalt.
      expect(totalArea(difference([region],union(cover))),`${nodeId} ${lane.id}`).toBeLessThan(0.04);
    }
  }
  // Each Atlas stripe is whole paint tiles end to end, near one mask turn long each, never one stretched quad.
  const stripes = result.placements.placements.filter(p => p.piece.startsWith('overlay/stripe/'));
  expect(stripes.length).toBeGreaterThan(a.markings!.length);
  let next = 0;
  for (const ring of a.markings!) {
    const box = bounds(ring), length = Math.max(box.max[0] - box.min[0], box.max[1] - box.min[1]);
    const tiles = stripes.slice(next, next += Math.max(1, Math.round(length / 2.7)));
    for (const tile of tiles) {
      expect(tile.scale![0]).toBeGreaterThan(0.66);
      expect(tile.scale![0]).toBeLessThan(1.5);
      expect(tile.scale![2]).toBe(1);
    }
    const actual = union(tiles.flatMap(tile => placementFootprint(pieces.get(tile.piece)!, tile)));
    expect(totalArea(difference([ring],actual))+totalArea(difference(actual,[ring]))).toBeLessThan(1e-6);
  }
});

it('rejects overlapping instances, wrong surface roles and raised infill over live lanes', async () => {
  const { KitCatalogue } = await import('../src/construction/units/KitCatalogue.ts');
  const { UnitCoverage } = await import('../src/construction/units/UnitCoverage.ts');
  const a = await readNativeAtlas(symmetricBlueprint()), catalogue = new KitCatalogue();
  const piece = catalogue.pieces.find(p => p.metadata.id === 'street/ordinary/local/8m-plain')!;
  const p = { piece: piece.metadata.id,position:[0,0,0] as const,rotationY:0,cell:[0,0] as const,ownerId:'roadway',ownerIds:['roadway'] };
  const cover = new UnitCoverage(a);
  cover.add(piece,p,0);
  expect(() => cover.add(piece,p,1)).toThrow(expect.objectContaining({code:'E_INVARIANT'}));
  expect(new UnitCoverage(a).fits(piece,{...p,position:[0,0,2]})).toBe(false);
  const raised = catalogue.pieces.find(p => p.metadata.id === 'infill/concrete')!;
  const ground = {...a.owners[0]!.ground[0]!,top:0.2};
  expect(() => new UnitCoverage(a).add(raised,{...p,piece:raised.metadata.id},0,ground))
    .toThrow(/level-zero driving lane/);
});

it('keeps one sidewalk finish all round each block: its kerbs, arm sides and far kerbs, and no whole-street piece on a motor street', () => {
  const pieces = new Map(result.kit.pieces.map(p => [p.id, p])), placements = result.placements.placements;
  const owners = new Map((source.streets.construction.reservations.owners as unknown as { id: string; kind: string; finish: string | null }[]).map(o => [o.id, o]));
  const finishOf = (id: string) => id.startsWith('kerb/') ? id.split('/')[1] : id.startsWith('junction/side/') ? id.split('/')[2]
    : id.startsWith('junction/far-kerb/') ? id.split('/')[3] : null;
  const seen = new Map<string, Set<string>>();
  for (const p of placements) {
    const finish = finishOf(p.piece);
    if (!finish) continue;
    const owner = owners.get(p.ownerId);
    if (owner?.kind !== 'block') continue;
    seen.set(owner.id, (seen.get(owner.id) ?? new Set()).add(finish));
  }
  expect(seen.size).toBeGreaterThan(0);
  for (const [id, finishes] of seen) expect([...finishes], id).toEqual([owners.get(id)!.finish]);
  // Sidewalks along motor streets come only from finished kerbs, so no zone's own walk shows beside a block.
  const whole = placements.filter(p => /^(street|road)\//.test(p.piece) && /\/(8m-plain|4m-closure|2m-closure)$/.test(p.piece));
  expect(whole).toEqual([]);
  expect(placements.filter(p => /^junction\/[a-z]+\/(one-way|local|avenue|median)\/(arm|return)$/.test(p.piece))).toEqual([]);
  for (const p of placements.filter(p => p.piece.startsWith('junction/side/'))) expect(pieces.get(p.piece)!.surfaces.some(s => /curb|gutter/.test(s))).toBe(true);
});

it('maps gutters to the curb scan\'s own proportions and paint to one scale along and across, never stretched', async () => {
  const { KitCatalogue } = await import('../src/construction/units/KitCatalogue.ts');
  const catalogue = new KitCatalogue();
  /** Texture units per metre along local X and Z over a flat triangle. */
  const rates = (positions: number[], uvs: number[], i: number) => {
    const p = [0, 1, 2].map(k => [positions[(i + k) * 3]!, positions[(i + k) * 3 + 2]!]), t = [0, 1, 2].map(k => [uvs[(i + k) * 2]!, uvs[(i + k) * 2 + 1]!]);
    const [ax, az] = [p[1]![0]! - p[0]![0]!, p[1]![1]! - p[0]![1]!], [bx, bz] = [p[2]![0]! - p[0]![0]!, p[2]![1]! - p[0]![1]!];
    const det = ax * bz - az * bx;
    if (Math.abs(det) < 1e-9) return null;
    const grad = (c: 0 | 1) => { const da = t[1]![c]! - t[0]![c]!, db = t[2]![c]! - t[0]![c]!; return [(da * bz - db * az) / det, (db * ax - da * bx) / det]; };
    const [u, v] = [grad(0), grad(1)];
    return { u: Math.hypot(...u), v: Math.hypot(...v) };
  };
  const gutter = catalogue.pieces.find(p => p.metadata.id === 'kerb/luxury-red/walk')!.geometry.meshes.find(m => m.surface === 'district-gutter-red')!;
  let checked = 0;
  for (let i = 0; i + 2 < gutter.positions.length / 3; i += 3) {
    const ys = [0, 1, 2].map(k => gutter.positions[(i + k) * 3 + 1]!);
    if (Math.max(...ys) - Math.min(...ys) > 0.07) continue;
    const r = rates(gutter.positions, gutter.uvs, i);
    if (!r) continue;
    // A 2048 x 256 band scan: as many pixels per metre along the gutter as across it.
    expect(r.u * 2048 / (r.v * 256)).toBeCloseTo(1, 1);
    checked++;
  }
  expect(checked).toBeGreaterThan(0);
  const paint = catalogue.pieces.find(p => p.metadata.id === 'road/luxury/avenue/8m-core')!.geometry.meshes.find(m => m.surface === 'whitePaint')!;
  for (let i = 0; i + 2 < paint.positions.length / 3; i += 3) {
    const r = rates(paint.positions, paint.uvs, i);
    if (r) expect(r.u / r.v).toBeCloseTo(1, 6);
  }
  const stripe = catalogue.pieces.find(p => p.metadata.id === 'overlay/stripe/0.5m')!.geometry.meshes[0]!;
  const r = rates(stripe.positions, stripe.uvs, 0)!;
  expect(r.u).toBeCloseTo(r.v, 6);
});

