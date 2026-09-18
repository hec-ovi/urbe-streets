import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { invalidParams } from '../errors.ts';
import { nativeGround } from './NativeGround.ts';
import { nativeMovement } from './NativeMovement.ts';
import { nativeMedians } from './NativeMedians.ts';
import { bad, array, integer, number, object, path, point, records, ring, string, strings, indexed } from './values.ts';
import type { NativeArchitecture, NativeIdentity, NativeProtection, NativeShaft, NativeStationBay } from './native-schema.ts';

const digest = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');

export async function readNativeAtlas(input: unknown): Promise<NativeArchitecture> {
  let parsed: unknown = input, identity: NativeIdentity;
  if (typeof input === 'string') {
    try {
      const bytes = await readFile(input);
      identity = { hash: digest(bytes), encoding: 'json-file-bytes' };
      parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch (error) { throw invalidParams('Cannot read the saved blueprint JSON', { cause: error instanceof Error ? error.message : String(error) }); }
  } else {
    try { identity = { hash: digest(JSON.stringify(input)), encoding: 'json-stringify-utf8' }; }
    catch { throw invalidParams('Blueprint must be a JSON object or a saved JSON file path'); }
  }
  const source = object(parsed, 'blueprint');
  if (!source.meta) bad('meta', 'Expected a saved blueprint; archive indexes require a separate adapter');
  const meta = object(source.meta, 'meta');
  if (meta.version !== '0.26.0' || meta.units !== 'meters') bad('meta.version', 'Expected saved Atlas blueprint 0.26.0 in metres; archive indexes require a separate adapter');
  const box = object(meta.bounds, 'meta.bounds'), boundary = ring(meta.boundary, 'meta.boundary');
  const bounds = { min: point(box.min, 'meta.bounds.min'), max: point(box.max, 'meta.bounds.max') };
  if (bounds.min.some((n, i) => n >= bounds.max[i]!)) bad('meta.bounds', 'Invalid city bounds');
  const streets = object(source.streets, 'streets'), construction = object(streets.construction, 'streets.construction');
  const planning = object(construction.planningReservations, 'streets.construction.planningReservations');
  if (planning.version !== '2.1.0') bad('streets.construction.planningReservations.version', 'Planning reservations version 2.1.0 is required');
  const reservation = object(construction.reservations, 'construction.reservations');
  const { owners, count, remaining } = nativeGround(source), movement = nativeMovement(source);
  const ownerIds = new Set(owners.map(owner => owner.id)), roadIds = new Set(movement.roads.map(road => road.id));
  for (const owner of owners) for (const frontage of owner.frontages) if (frontage.edgeIds.some(id => !roadIds.has(id))) bad(`frontages.${frontage.id}`, 'Unknown frontage road');
  const modules = object(construction.modules, 'construction.modules');
  const format = modules.format === 'district' ? 'district' : 'source';
  if (modules.version !== '1.0.0') bad('construction.modules.version', 'Source module identities require version 1.0.0');
  const definitions = indexed(records(modules.definitions, 'modules.definitions'), 'modules.definitions');
  for (const p of records(modules.placements, 'modules.placements')) {
    const moduleId = string(p.moduleId, 'placement.moduleId'), ownerId = string(p.blockId, 'placement.blockId'), definition = definitions.get(moduleId);
    if (!definition || !ownerIds.has(ownerId)) bad('modules.placements', 'Unknown source module or owner');
    const parts = records(definition.parts, `modules.${moduleId}.parts`);
    if (!parts.length || !parts.every(part => part.role === 'guardrail')) continue;
    const turn = integer(p.turn, 'placement.turn'), repetitions = integer(p.count, 'placement.count'), step = number(p.step, 'placement.step');
    if (![0, 1, 2, 3].includes(turn) || repetitions < 1 || step <= 0) bad('modules.placements', 'Invalid guard reservation');
    owners.find(owner => owner.id === ownerId)!.guards.push({ moduleId, ownerId, origin: point(p.origin, 'placement.origin'), turn, count: repetitions, step });
  }
  const transit = object(source.transit, 'transit'), stations = indexed(records(transit.subwayStations, 'transit.subwayStations'), 'transit.subwayStations');
  const shafts: NativeShaft[] = [], stationBays: NativeStationBay[] = [];
  for (const [stationId, station] of stations) {
    records(station.shafts, `stations.${stationId}.shafts`).forEach((shaft, index) => shafts.push({ id: `shaft:${stationId}:${index}`, stationId, ring: ring(shaft.footprint, `stations.${stationId}.shafts[${index}]`) }));
    records(station.entranceBays, `stations.${stationId}.entranceBays`).forEach((bay, index) => {
      const edgeId = string(bay.edgeId, 'stationBay.edgeId'); if (!roadIds.has(edgeId)) bad('stationBay.edgeId', 'Unknown station bay road');
      stationBays.push({ id: `bay:${stationId}:${index}`, stationId, edgeId, footprint: ring(bay.footprint, 'stationBay.footprint'),
        shaft: ring(bay.shaft, 'stationBay.shaft'), approach: path(bay.approach, 'stationBay.approach') });
    });
  }
  const highways = records(streets.highwayStructures, 'streets.highwayStructures');
  const protectionIds = new Set<string>();
  const nodeIds = new Set(records(streets.nodes, 'streets.nodes').map(node => string(node.id, 'node.id')));
  const protections: NativeProtection[] = records(reservation.protected, 'reservations.protected').map(value => {
    const kind = string(value.kind, 'protection.kind') as NativeProtection['kind'];
    const key = `${kind}:${value.ownerId ?? value.stationId ?? value.structureIndex}:${value.bayIndex ?? value.shaftIndex ?? ''}`;
    if (protectionIds.has(key)) bad('reservations.protected', 'Duplicate infrastructure protection');
    protectionIds.add(key);
    if (kind === 'highway') { if (!highways[integer(value.structureIndex, 'protection.structureIndex')]) bad('reservations.protected', 'Unknown highway'); }
    else if (kind === 'underpass') {
      if (!owners.some(owner => owner.kind === 'underpass' && owner.id === value.ownerId) || !nodeIds.has(string(value.nodeId, 'protection.nodeId')) || strings(value.edgeIds, 'protection.edgeIds').some(id => !roadIds.has(id))) bad('reservations.protected', 'Unknown underpass owner or edge');
      array(value.highwayIndices, 'protection.highwayIndices').forEach(i => { if (!highways[integer(i, 'protection.highwayIndices')]) bad('reservations.protected', 'Unknown underpass highway'); });
    } else if (kind === 'station-bay' || kind === 'station-shaft') {
      const station = stations.get(string(value.stationId, 'protection.stationId'));
      if (!station || !array(station[kind === 'station-bay' ? 'entranceBays' : 'shafts'], 'protected.station')[integer(value[kind === 'station-bay' ? 'bayIndex' : 'shaftIndex'], 'protected.station.index')]) bad('reservations.protected', 'Unknown station protection');
    } else bad('reservations.protected', 'Unknown infrastructure protection');
    return { kind, source: structuredClone(value) };
  });
  if (protections.filter(p => p.kind === 'highway').length !== highways.length
    || protections.filter(p => p.kind === 'underpass').length !== owners.filter(owner => owner.kind === 'underpass').length
    || protections.filter(p => p.kind === 'station-bay').length !== stationBays.length
    || protections.filter(p => p.kind === 'station-shaft').length !== shafts.length) bad('reservations.protected', 'Incomplete infrastructure protection');
  const obstaclePoints: NativeArchitecture['obstaclePoints'] = [];
  records(streets.signals, 'streets.signals').forEach((item, index) =>
    obstaclePoints.push({ id: `signals:${index}`, position: point(item.position, 'signals.position'), clearance: 1 }));
  records(streets.planting, 'streets.planting').forEach((item, index) => {
    if (item.kind !== 'tree' && item.kind !== 'pole' && item.kind !== 'bin') bad(`planting[${index}].kind`, 'Unknown planting support kind');
    obstaclePoints.push({ id: `planting:${index}`, position: point(item.position, 'planting.position'), clearance: item.kind === 'tree' ? 0.5 : 0.15 });
  });
  const parcels = indexed(records(source.parcels, 'parcels'), 'parcels');
  const exclusions = [...parcels].map(([id, parcel]) => {
    const access = object(parcel.access, `parcels.${id}.access`);
    obstaclePoints.push({ id: `access:${id}`, position: point(access.point, `parcels.${id}.access.point`), clearance: 6 });
    return ring(parcel.lot, `parcels.${id}.lot`);
  });
  for (const owner of owners) if (owner.excludedParcelIds.some(id => !parcels.has(id))) bad(`owners.${owner.id}`, 'Unknown local parcel exclusion');
  if (source.hydrology !== undefined) for (const body of records(object(source.hydrology, 'hydrology').bodies, 'hydrology.bodies')) {
    exclusions.push(...array(body.surfaces, 'water.surfaces').map((r, i) => ring(r, `water.surfaces[${i}]`)));
  }
  const medians = nativeMedians(construction.medians, owners, movement.roads);
  return { version: meta.version, reservationVersion: planning.version, format, medians, identity, bounds, boundary, groundArrayCount: count, owners, ...movement,
    shafts, stationBays, protections, obstaclePoints, exclusions, highwayHash: digest(JSON.stringify(streets.highwayStructures)),
    stationHash: digest(JSON.stringify(transit.subwayStations)), remainingGroundIndices: remaining };
}
