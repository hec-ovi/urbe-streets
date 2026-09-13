import { unsupportedArchitecture, unsatisfiable } from '../errors.ts';
import { area, bounds, difference, totalArea, union } from '../geometry/polygons.ts';
import type { Ring, Vec2 } from '../geometry/schema.ts';
import type { Architecture, ConstructionSurface } from './schema.ts';
import type { FinishRole } from '../schema/request.ts';

type ObjectValue = Record<string, unknown>;
const fail = (path: string, message: string): never => { throw unsupportedArchitecture(`${path}: ${message}`, { path }); };
const object = (v: unknown, p: string): ObjectValue => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as ObjectValue : fail(p, 'expected object');
const array = (v: unknown, p: string): unknown[] => Array.isArray(v) ? v : fail(p, 'expected array');
const string = (v: unknown, p: string): string => typeof v === 'string' && v.length > 0 ? v : fail(p, 'expected nonempty string');
const number = (v: unknown, p: string): number => typeof v === 'number' && Number.isFinite(v) ? v : fail(p, 'expected finite number');
function point(v: unknown, p: string): Vec2 {
  const a = array(v, p);
  if (a.length !== 2) fail(p, 'expected [x,z]');
  const r: Vec2 = [number(a[0], p), number(a[1], p)];
  if (r.some(n => Math.abs(n) > 1e6)) fail(p, 'coordinate exceeds supported one-million-metre range');
  return r;
}
function polygon(v: unknown, p: string): Ring {
  const ring = array(v, p).map((v, i) => point(v, `${p}[${i}]`));
  if (ring.length < 3 || area(ring) <= 0) fail(p, 'expected a nondegenerate CCW ring');
  if (ring.some((v, i) => v[0] === ring[(i + 1) % ring.length]![0] && v[1] === ring[(i + 1) % ring.length]![1])) fail(p, 'repeated adjacent point');
  if (Math.abs(totalArea(union([ring])) - area(ring)) > 1e-7) fail(p, 'self-intersecting ring');
  return ring;
}
const roles: FinishRole[] = ['roadway', 'panel', 'joint', 'curb', 'gutter', 'gutter-lip', 'guardrail', 'marking'];
const groundRoles: Record<string, FinishRole> = { roadway: 'roadway', curb: 'curb', gutter: 'gutter', sidewalk: 'panel' };
function levels(v: ObjectValue, p: string, marking = false): { bottom: number; top: number } {
  const bottom = number(v.bottom, `${p}.bottom`), top = number(v.top, `${p}.top`);
  if (bottom > top || (!marking && bottom === top)) fail(p, 'bottom must be below top');
  return { bottom, top };
}
function indexed(values: unknown, p: string): Map<string, ObjectValue> {
  const result = new Map<string, ObjectValue>();
  array(values, p).forEach((v, i) => {
    const value = object(v, `${p}[${i}]`), id = string(value.id, `${p}[${i}].id`);
    if (result.has(id)) fail(p, `duplicate id ${id}`);
    result.set(id, value);
  });
  return result;
}

/** All reads of Atlas's saved format live here. No sibling code imports. */
export function readAtlas(input: unknown): Architecture {
  const source = object(input, 'blueprint'), meta = object(source.meta, 'meta');
  if (meta.version !== '0.21.0') fail('meta.version', 'supported version is 0.21.0');
  if (meta.units !== 'meters') fail('meta.units', 'expected meters');
  string(meta.seed, 'meta.seed');
  const boundary = polygon(meta.boundary, 'meta.boundary'), box = object(meta.bounds, 'meta.bounds');
  const cityBounds = { min: point(box.min, 'meta.bounds.min'), max: point(box.max, 'meta.bounds.max') };
  const boundaryBounds = bounds(boundary);
  if (cityBounds.min.some((n, i) => n >= cityBounds.max[i]! || n > boundaryBounds.min[i]!) || cityBounds.max.some((n, i) => n < boundaryBounds.max[i]!)) fail('meta.bounds', 'must contain the boundary');
  const districts = indexed(source.districts, 'districts');
  for (const [id, d] of districts) polygon(d.boundary, `districts.${id}.boundary`);
  const blocks = indexed(source.blocks, 'blocks');
  for (const [id, b] of blocks) {
    if (!districts.has(string(b.districtId, `blocks.${id}.districtId`))) fail(`blocks.${id}`, 'unknown district');
    polygon(b.boundary, `blocks.${id}.boundary`);
  }
  const streets = object(source.streets, 'streets');
  const nodes = indexed(streets.nodes, 'streets.nodes'), edges = indexed(streets.edges, 'streets.edges');
  for (const [id, n] of nodes) point(n.position, `streets.nodes.${id}.position`);
  for (const [id, edge] of edges) {
    const path = `streets.edges.${id}`;
    if (!nodes.has(string(edge.from, `${path}.from`)) || !nodes.has(string(edge.to, `${path}.to`))) fail(path, 'unknown endpoint node');
    const points = array(edge.path, `${path}.path`).map((p, i) => point(p, `${path}.path[${i}]`));
    if (points.length < 2) fail(path, 'centerline needs two points');
    const start = point(nodes.get(edge.from as string)!.position, path), end = point(nodes.get(edge.to as string)!.position, path);
    if (JSON.stringify(points[0]) !== JSON.stringify(start) || JSON.stringify(points.at(-1)) !== JSON.stringify(end)) fail(path, 'path endpoints differ from nodes');
    const width = number(edge.width, `${path}.width`), sidewalk = object(edge.sidewalk, `${path}.sidewalk`);
    for (const side of ['left', 'right']) if (number(sidewalk[side], `${path}.sidewalk.${side}`) < 0) fail(path, 'negative side reservation');
    if (width <= 0) fail(`${path}.width`, 'positive carriageway required');
    if (edge.class === 'highway' || number(edge.level, `${path}.level`) !== 0) fail(path, 'elevated construction requires the highway reservation extension');
    if (!['street', 'road', 'alley'].includes(String(edge.class))) fail(`${path}.class`, 'unknown street class');
    const length = points.slice(1).reduce((n, p, i) => n + Math.hypot(p[0] - points[i]![0], p[1] - points[i]![1]), 0);
    let lastDistance = -1;
    const knots = array(edge.elevationProfile, `${path}.elevationProfile`).map((k, i) => {
      const value = object(k, path), distance = number(value.distance, `${path}.elevationProfile[${i}].distance`);
      if (distance <= lastDistance || number(value.level, path) !== 0) fail(path, 'expected increasing flat elevation knots');
      lastDistance = distance;
      return distance;
    });
    if (knots[0] !== 0 || Math.abs((knots.at(-1) ?? 0) - length) > 1e-8) fail(path, 'elevation must cover the complete path');
    array(edge.districtIds, `${path}.districtIds`).forEach(d => { if (!districts.has(string(d, path))) fail(path, 'unknown district'); });
    if (edge.crossSection !== undefined) {
      const section = object(edge.crossSection, `${path}.crossSection`), lanes = array(section.lanes, `${path}.crossSection.lanes`);
      if (!lanes.length || lanes.length > 8) fail(path, 'expected 1 to 8 lanes');
      const spans = lanes.map((v, i) => {
        const lane = object(v, path), w = number(lane.width, `${path}.lanes[${i}].width`), offset = number(lane.offset, `${path}.lanes[${i}].offset`);
        if (!['forward', 'backward'].includes(String(lane.direction)) || w <= 0) fail(path, 'invalid lane');
        if (Math.abs(offset) + w / 2 > width / 2 + 1e-8) throw unsatisfiable('Lane exceeds carriageway', { edgeId: id, lane: i, width, offset, laneWidth: w });
        return [offset - w / 2, offset + w / 2];
      }).sort((a, b) => a[0]! - b[0]!);
      if (spans.some((s, i) => i > 0 && s[0]! < spans[i - 1]![1]! - 1e-8)) throw unsatisfiable('Lanes overlap', { edgeId: id });
    }
  }
  if (array(streets.highwayStructures, 'streets.highwayStructures').length) fail('streets.highwayStructures', 'highway construction is not supported');
  const exclusions: Ring[] = [];
  for (const [id, parcel] of indexed(source.parcels, 'parcels')) exclusions.push(polygon(parcel.lot, `parcels.${id}.lot`));
  const transit = object(source.transit, 'transit');
  const stations = array(transit.subwayStations, 'transit.subwayStations');
  if (stations.length) fail('transit.subwayStations', 'station construction requires the station reservation extension');
  if (source.hydrology !== undefined) fail('hydrology', 'water construction needs the final street exclusion interface');

  const construction = streets.construction === undefined ? undefined : object(streets.construction, 'streets.construction');
  const modules = construction?.modules === undefined ? undefined : object(construction.modules, 'streets.construction.modules');
  const surfaces: ConstructionSurface[] = [], reserved: Ring[] = [], moduleOwners = new Set<string>();
  if (modules) {
    if (modules.version !== '1.0.0') fail('streets.construction.modules.version', 'supported version is 1.0.0');
    const definitions = indexed(modules.definitions, 'modules.definitions');
    const frontages = modules.frontages === undefined ? new Map() : indexed(modules.frontages, 'modules.frontages');
    const parts = new Map<string, { role: FinishRole; polygon: Ring; bottom: number; top: number }[]>();
    for (const [id, definition] of definitions) parts.set(id, array(definition.parts, `modules.${id}.parts`).map((p, i) => {
      const v = object(p, `modules.${id}.parts[${i}]`), role = string(v.role, 'module.role') as FinishRole;
      if (!roles.includes(role)) fail('module.role', `unsupported role ${role}`);
      return { role, polygon: polygon(v.polygon, `modules.${id}.parts[${i}].polygon`), ...levels(v, `modules.${id}.parts[${i}]`, role === 'marking') };
    }));
    array(modules.placements, 'modules.placements').forEach((v, index) => {
      const p = object(v, `modules.placements[${index}]`), moduleId = string(p.moduleId, 'placement.moduleId'), blockId = string(p.blockId, 'placement.blockId');
      if (!parts.has(moduleId) || (!blocks.has(blockId) && !frontages.has(blockId))) fail(`modules.placements[${index}]`, 'unknown module or land owner');
      moduleOwners.add(blockId);
      const origin = point(p.origin, 'placement.origin'), turn = number(p.turn, 'placement.turn'), count = number(p.count, 'placement.count'), step = number(p.step, 'placement.step');
      if (![0, 1, 2, 3].includes(turn) || !Number.isSafeInteger(count) || count < 1 || step < 0 || (count > 1 && step === 0)) fail('placement', 'invalid turn, count or step');
      const rotate = ([x, z]: Vec2): Vec2 => ([[x, z], [-z, x], [-x, -z], [z, -x]] as const)[turn]!;
      for (let repeat = 0; repeat < count; repeat++) {
        const shift = rotate([repeat * step, 0]), anchor: Vec2 = [origin[0] + shift[0], origin[1] + shift[1]];
        parts.get(moduleId)!.forEach((part, n) => {
          surfaces.push({ ...part, id: `sm:${index}:${repeat}:${n}`, sourceIds: [blockId, moduleId], origin: anchor, turn,
            polygon: part.polygon.map(p => { const q = rotate(p); return [anchor[0] + q[0], anchor[1] + q[1]]; }) });
        });
      }
    });
  }
  const volumetric = object(source.volumetric, 'volumetric');
  array(volumetric.ground, 'volumetric.ground').forEach((v, i) => {
    const p = `volumetric.ground[${i}]`, g = object(v, p), role = string(g.surface, `${p}.surface`), ring = polygon(g.polygon, `${p}.polygon`), height = levels(g, p);
    if (role === 'block' || role === 'open') return;
    if (!(role in groundRoles)) fail(p, `unsupported surface ${role}`);
    reserved.push(ring);
    if (g.moduleBlockId !== undefined) {
      if (!moduleOwners.has(string(g.moduleBlockId, `${p}.moduleBlockId`))) fail(p, 'missing physical module owner');
      return;
    }
    surfaces.push({ id: `sg:${i}`, sourceIds: [`volumetric.ground[${i}]`], role: groundRoles[role]!, polygon: ring, ...height, origin: [0, 0], turn: 0 });
  });
  const roadLand = surfaces.filter(s => s.role === 'roadway').map(s => s.polygon);
  const painted = surfaces.filter(s => s.role === 'marking').map(s => s.polygon);
  array(streets.crossings, 'streets.crossings').forEach((v, i) => {
    const crossing = object(v, `streets.crossings[${i}]`), nodeId = string(crossing.nodeId, 'crossing.nodeId');
    if (!nodes.has(nodeId)) fail('crossing.nodeId', 'unknown node');
    array(crossing.segments, 'crossing.segments').forEach((s, j) => {
      const segment = object(s, 'crossing.segment'), edgeId = string(segment.edgeId, 'crossing.edgeId');
      if (!edges.has(edgeId)) fail('crossing.edgeId', 'unknown edge');
      point(segment.from, 'crossing.from'); point(segment.to, 'crossing.to');
      if (number(segment.width, 'crossing.width') <= 0) fail('crossing.width', 'expected positive width');
      array(segment.markings, 'crossing.markings').forEach((v, k) => {
        const stripe = polygon(v, `crossings[${i}].segments[${j}].markings[${k}]`);
        if (totalArea(difference([stripe], roadLand)) > 1e-7) throw unsatisfiable('Crossing paint escapes roadway', { nodeId, edgeId });
        // An existing physical module may already carry this marking.
        for (const [n, fragment] of difference([stripe], painted).entries()) {
          surfaces.push({ id: `sc:${i}:${j}:${k}:${n}`, sourceIds: [nodeId, edgeId], role: 'marking', polygon: fragment,
            bottom: 0.005, top: 0.005, origin: [0, 0], turn: 0 });
        }
        painted.push(stripe);
      });
    });
  });
  if (!surfaces.length || !reserved.length) fail('volumetric.ground', 'no street construction');
  if (totalArea(difference(reserved, [boundary])) > 1e-7) fail('volumetric.ground', 'street land exceeds city boundary');
  return { version: String(meta.version), bounds: cityBounds, boundary, surfaces, reserved, exclusions, modules: !!modules,
    omissions: ['Legal turns and walking-lane identities are absent from the supported Atlas schema; no arrows or walking terminal strips are generated.', 'District replanning, new hardware, furniture, stations, highways and water are not constructed.'] };
}
