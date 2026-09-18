import { area, difference, totalArea } from '../geometry/polygons.ts';
import { StreetsError } from '../errors.ts';
import { bad, array, integer, number, object, path, point, records, ring, string, strings, indexed, type RecordValue } from './values.ts';
import type { NativeCorner, NativeFrontage, NativeGround, NativeOwner, NativeParking } from './native-schema.ts';
import type { StreetDegradation } from '../schema/street-kit.ts';

export function nativeGround(source: RecordValue): { owners: NativeOwner[]; count: number; remaining: number[]; degraded: StreetDegradation[] } {
  const streets = object(source.streets, 'streets'), construction = object(streets.construction, 'streets.construction');
  const format = object(construction.modules, 'construction.modules').format, district = format === 'district';
  if (format !== undefined && format !== 'source' && format !== 'district') bad('construction.modules.format', 'Unsupported street module format');
  const reservation = object(construction.reservations, 'streets.construction.reservations');
  if (reservation.version !== '1.0.0') bad('streets.construction.reservations.version', 'Native reservations version 1.0.0 is required');
  const ground = records(object(source.volumetric, 'volumetric').ground, 'volumetric.ground');
  const address = object(reservation.groundArray, 'reservations.groundArray');
  if (address.path !== 'volumetric.ground' || address.count !== ground.length) bad('reservations.groundArray', 'Reservations address a different saved ground array');
  const ownerRows = indexed(records(reservation.owners, 'reservations.owners'), 'reservations.owners');
  const seen = new Set<number>();
  const owners: NativeOwner[] = [...ownerRows].map(([id, value]) => {
    const kind = string(value.kind, `owners.${id}.kind`) as NativeOwner['kind'];
    if (!['block', 'perimeter', 'underpass', 'roadway', 'station', 'median'].includes(kind) || kind === 'median' && !district) bad(`owners.${id}.kind`, 'Unknown street owner kind');
    const fields: NativeGround[] = array(value.groundIndices, `owners.${id}.groundIndices`).map(v => {
      const index = integer(v, `owners.${id}.groundIndices`), field = ground[index];
      if (!field || seen.has(index)) bad(`owners.${id}.groundIndices`, 'Missing or multiply owned ground index');
      seen.add(index);
      const surface = string(field.surface, `ground[${index}].surface`) as NativeGround['surface'];
      if (!['roadway', 'sidewalk', 'curb', 'gutter'].includes(surface) || (field.moduleBlockId !== undefined && field.moduleBlockId !== id)) bad(`ground[${index}]`, 'Ground ownership does not match its reservation');
      const bottom = number(field.bottom, `ground[${index}].bottom`), top = number(field.top, `ground[${index}].top`);
      if (bottom > top) bad(`ground[${index}]`, 'Ground levels are reversed');
      return { id: `atlas-ground:${index}`, sourceIndex: index, ownerId: id, surface, ring: ring(field.polygon, `ground[${index}].polygon`), bottom, top };
    });
    if (!fields.length) bad(`owners.${id}`, 'Street owner has no ground');
    return { id, kind, finish: value.finish === null ? null : string(value.finish, `owners.${id}.finish`), ground: fields,
      interiors: array(value.interiors, `owners.${id}.interiors`).map((r, i) => ring(r, `owners.${id}.interiors[${i}]`)),
      excludedParcelIds: strings(value.excludedParcelIds, `owners.${id}.excludedParcelIds`), frontages: [], corners: [], parking: [], guards: [] };
  });
  const byOwner = new Map(owners.map(owner => [owner.id, owner]));
  const frontageRows = indexed(records(reservation.frontages, 'reservations.frontages'), 'reservations.frontages');
  const frontages = new Map<string, NativeFrontage>();
  for (const [id, v] of frontageRows) {
    const ownerId = string(v.ownerId, `frontages.${id}.ownerId`), owner = byOwner.get(ownerId);
    if (!owner) bad(`frontages.${id}`, 'Missing frontage owner');
    const station = point(v.stationRange, `frontages.${id}.stationRange`), inward = point(v.inward, `frontages.${id}.inward`);
    const start = point(v.start, `frontages.${id}.start`), end = point(v.end, `frontages.${id}.end`);
    if (station[0] !== 0 || station[1] <= 0 || Math.abs(Math.hypot(...inward) - 1) > 1e-9
      || Math.abs((end[0] - start[0]) * inward[1] - (end[1] - start[1]) * inward[0] - station[1]) > 1e-8) bad(`frontages.${id}`, 'Invalid authored frontage frame');
    const corners = array(v.cornerIds, `frontages.${id}.cornerIds`).map(x => x === null ? null : string(x, `frontages.${id}.cornerIds`));
    if (corners.length !== 2) bad(`frontages.${id}.cornerIds`, 'Expected two corner handoffs');
    const f: NativeFrontage = { id, ownerId, start, end, inward, edgeIds: strings(v.edgeIds, `frontages.${id}.edgeIds`), length: station[1],
      moduleStationOffset: number(v.moduleStationOffset, `frontages.${id}.moduleStationOffset`), pavedWidth: number(v.pavedWidth, `frontages.${id}.pavedWidth`),
      roadTop: number(v.roadTop, `frontages.${id}.roadTop`), pavedTop: number(v.pavedTop, `frontages.${id}.pavedTop`),
      curbWidth: number(v.curbWidth, `frontages.${id}.curbWidth`), gutterWidth: number(v.gutterWidth, `frontages.${id}.gutterWidth`), cornerIds: corners as [string | null, string | null] };
    if (!(owner.kind === 'median' ? [2] : district ? [4.2] : [2, 4, 6]).includes(f.pavedWidth)
      || f.curbWidth !== 0.2 || f.gutterWidth !== (district ? 0.5 : 0.3) || Math.abs(f.pavedTop - f.roadTop - 0.2) > 1e-9) bad(`frontages.${id}`, 'Unsupported street cross section');
    if (!owner.ground.some(g => g.surface === 'sidewalk' && g.top === f.pavedTop)
      || !owner.ground.some(g => (g.surface === 'roadway' || g.surface === 'gutter') && g.top === f.roadTop)) bad(`frontages.${id}`, 'Frontage datum differs from its ground');
    owner.frontages.push(f); frontages.set(id, f);
  }
  const cornerRows = indexed(records(reservation.corners, 'reservations.corners'), 'reservations.corners');
  for (const [id, v] of cornerRows) {
    const ownerId = string(v.ownerId, `corners.${id}.ownerId`), owner = byOwner.get(ownerId), frontageIds = strings(v.frontageIds, `corners.${id}.frontageIds`);
    if (!owner || frontageIds.length !== 2 || frontageIds.some(id => frontages.get(id)?.ownerId !== ownerId)) bad(`corners.${id}`, 'Unknown corner frontage or owner');
    const common = { id, ownerId, frontageIds };
    const corner: NativeCorner = v.kind === 'arc' ? { ...common, kind: 'arc', center: point(v.center, `corners.${id}.center`), radius: number(v.radius, `corners.${id}.radius`), arc: path(v.arc, `corners.${id}.arc`) }
      : v.kind === 'explicit' ? { ...common, kind: 'explicit', boundary: ring(v.boundary, `corners.${id}.boundary`) } : bad(`corners.${id}.kind`, 'Unknown corner support');
    owner.corners.push(corner);
  }
  for (const f of frontages.values()) if (f.cornerIds.some(id => id !== null && !cornerRows.has(id))) bad(`frontages.${f.id}`, 'Missing corner support');
  const parkingRows = indexed(records(reservation.parking, 'reservations.parking'), 'reservations.parking');
  const degraded: StreetDegradation[] = [];
  for (const [id, v] of parkingRows) {
    // A bay the box cannot build is dropped; the ordinary segment keeps its ground covered.
    try {
      const bay = parkingBay(id, v, byOwner, frontages, district);
      byOwner.get(bay.ownerId)!.parking.push(bay);
    } catch (error) {
      if (!(error instanceof StreetsError) || error.code !== 'E_UNSUPPORTED_ARCHITECTURE') throw error;
      degraded.push({ id, reason: error.message });
    }
  }
  ground.forEach((g, index) => { if (['roadway', 'sidewalk', 'curb', 'gutter'].includes(String(g.surface)) && !seen.has(index)) bad(`ground[${index}]`, 'Unowned street ground'); });
  return { owners, count: ground.length, remaining: ground.flatMap((_, index) => seen.has(index) ? [] : [index]), degraded };
}

/** Reads one authored parking reservation; a bay the box cannot build throws and its caller degrades it. */
function parkingBay(id: string, v: RecordValue, byOwner: Map<string, NativeOwner>, frontages: Map<string, NativeFrontage>, district: boolean): NativeParking {
  const ownerId = string(v.ownerId, `parking.${id}.ownerId`), owner = byOwner.get(ownerId), frontageId = string(v.frontageId, `parking.${id}.frontageId`), frontage = frontages.get(frontageId);
  const depth = number(v.depth, `parking.${id}.depth`);
  if (!owner || frontage?.ownerId !== ownerId || frontage.pavedWidth !== (district ? 4.2 : 6) || v.slotLength !== 6 || depth !== (district ? 2 : 2.5) || v.endRun !== 2
    || Math.abs(number(v.walkingClearance, `parking.${id}.walkingClearance`) - (frontage.pavedWidth - depth)) > 1e-8) bad(`parking.${id}`, 'Unsupported native parking reservation');
  const support = object(v.support, `parking.${id}.support`);
  const p: NativeParking = { id, ownerId, frontageId, start: number(v.start, `parking.${id}.start`), end: number(v.end, `parking.${id}.end`),
    support: { start: number(support.start, `parking.${id}.support.start`), end: number(support.end, `parking.${id}.support.end`) },
    slotCount: integer(v.slotCount, `parking.${id}.slotCount`), depth, footprint: ring(v.footprint, `parking.${id}.footprint`),
    slots: array(v.slots, `parking.${id}.slots`).map((r, i) => ring(r, `parking.${id}.slots[${i}]`)) };
  if (p.slotCount < 1 || p.slotCount > 3) bad(`parking.${id}`, 'Parking bay holds an unsupported slot count');
  if (p.support.start !== p.start - 2 || p.support.end !== p.end + 2
    || p.support.start < 0 || p.support.end > frontage.length || p.end - p.start !== p.slotCount * 6 + 4 || p.slots.length !== p.slotCount
    || p.slots.some(r => Math.abs(area(r.map(([x, z]) => [x - r[0]![0], z - r[0]![1]])) - 6 * p.depth) > 1e-6)
    || p.slots.some(slot => totalArea(difference([slot], [p.footprint])) > 1e-7)
    || totalArea(difference([p.footprint], owner.ground.filter(g => g.surface === 'roadway').map(g => g.ring))) > 1e-7) bad(`parking.${id}`, 'Parking footprint disagrees with authored ground');
  return p;
}
