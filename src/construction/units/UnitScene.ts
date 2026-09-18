import type { NativeArchitecture, NativeFrontage, NativeGround, NativeOwner, NativeRoad } from '../../architecture/native-schema.ts';
import type { Ring, Vec2 } from '../../geometry/schema.ts';
import { bounds, difference, intersection, intersects, rectangle, totalArea, union } from '../../geometry/polygons.ts';
import { along, direction, distance, dot, sub } from '../surfaces/Frame.ts';
import type { DistrictFeature } from '../district/schema.ts';
import type { UnitRegion } from './UnitPlan.ts';
import type { UnitFeature } from './UnitFeatures.ts';
import { canonical, clean } from './Frame.ts';

export type UnitDetail = Pick<DistrictFeature, 'cut' | 'panel'>;
export interface SceneInput { architecture: NativeArchitecture; edgeOwners: NativeOwner[]; details: Map<string, UnitDetail[]>; variant: string; wear: (p: Vec2) => number }

/** Crops source reservations before triangulation; canonical local inputs share one authored piece. */
export function unitScene(a: NativeArchitecture, region: UnitRegion, features: UnitFeature[], worldWear: (p: Vec2) => number): SceneInput {
  const { frame, mask } = region, maskBox = bounds(mask.flat());
  const localRings = (rings: Ring[]) => canonical(rings.map(r => r.map(frame.local)));
  const selected = a.owners.flatMap(owner => {
    const fields = owner.ground.filter(g => intersects(bounds(g.ring), maskBox));
    const groups = new Map<string, NativeGround[]>();
    for (const g of fields) { const k = `${g.surface}:${g.bottom}:${g.top}`; groups.set(k, [...groups.get(k) ?? [], g]); }
    const ground: NativeGround[] = [];
    for (const source of groups.values()) {
      const clipped = localRings(difference(intersection(union(source.map(g => g.ring)), mask), a.shafts.map(s => s.ring)));
      for (const ring of clipped) ground.push({ ...source[0]!, ring, id: '', ownerId: '', sourceIndex: 0 });
    }
    ground.sort((x, y) => JSON.stringify([x.surface, x.ring]).localeCompare(JSON.stringify([y.surface, y.ring]), 'en'));
    if (!ground.length) return [];
    return [{ owner, ground }];
  }).sort((x, y) => JSON.stringify([x.owner.kind, x.owner.finish, x.ground]).localeCompare(JSON.stringify([y.owner.kind, y.owner.finish, y.ground]), 'en'));

  const roadIds = new Map(region.roads.map((r, i) => [r.id, `r${i}`]));
  const nearbyApproaches = region.roads.map(r => a.approaches.filter(p => {
    if (p.edgeId !== r.id) return false;
    if (region.kind !== 'segment') {
      const node = distance(r.path[0]!, [frame.position[0], frame.position[2]]) < 1e-6 ? r.from : r.to;
      return p.nodeId === node;
    }
    return intersects(bounds([...p.field, ...p.landings.flat()]), {
      min: [maskBox.min[0] - 8 + 1e-6, maskBox.min[1] - 8 + 1e-6], max: [maskBox.max[0] + 8 - 1e-6, maskBox.max[1] + 8 - 1e-6] });
  }));
  const roads: NativeRoad[] = region.roads.map((r, index) => {
    const d = direction(r.path[0]!, r.path.at(-1)!), length = distance(r.path[0]!, r.path.at(-1)!);
    const stations = mask.flat().map(p => dot(sub(p, r.path[0]!), d));
    const nearby = nearbyApproaches[index]!;
    let start = Math.min(length, nearby.length ? Math.max(0, Math.min(...stations) - 32) : Math.max(0, Math.min(...stations)));
    let end = Math.max(start, nearby.length ? Math.min(length, Math.max(...stations) + 32) : Math.min(length, Math.max(...stations)));
    if (region.kind !== 'segment') {
      const first = distance(r.path[0]!, [frame.position[0], frame.position[2]]) < 1e-6;
      start = first ? 0 : Math.max(0, length - 64); end = first ? Math.min(length, 64) : length;
    }
    const at = (s: number, offset = 0): Vec2 => frame.local([r.path[0]![0] + d[0] * s - d[1] * offset, r.path[0]![1] + d[1] * s + d[0] * offset]);
    const id = `r${index}`;
    const firstApproach = a.approaches.find(p => p.edgeId === r.id && p.nodeId === r.from);
    const clearStart = firstApproach ? Math.max(...firstApproach.field.map(p => dot(sub(p, r.path[0]!), d))) : 0;
    const dashOrigin = clean(((clearStart - start) % 8 + 8) % 8);
    return { ...r, dashOrigin, id, from: `${id}:from`, to: `${id}:to`, path: [at(start), at(end)], runId: id, runStart: 0, runForward: true,
      lanes: r.lanes.map((l, i) => ({ ...l, id: `${id}:v${i}`, path: [at(start, l.offset), at(end, l.offset)] })) };
  });
  const owners: NativeOwner[] = [], details = new Map<string, UnitDetail[]>();
  for (const [index, { owner, ground }] of selected.entries()) {
    const id = a.format === 'district' ? `o${index}` : owner.id, worldDomain = ground.map(g => g.ring.map(frame.world));
    const selectedFaces = owner.frontages.filter(f => {
      const rim = f.pavedWidth + f.curbWidth + f.gutterWidth;
      const strip = [along(f, 0), along(f, f.length), along(f, f.length, rim), along(f, 0, rim)];
      return totalArea(intersection(worldDomain, [strip])) > 1e-9;
    });
    const sourceFaces = a.format === 'district' ? selectedFaces.length ? selectedFaces : owner.frontages.slice(0, 1) : owner.frontages;
    const faceMap = new Map<string, { face: NativeFrontage; offset: number }>();
    for (const [i, f] of sourceFaces.entries()) {
      const d: Vec2 = [f.inward[1], -f.inward[0]], stations = worldDomain.flat().map(p => dot(sub(p, f.start), d));
      const start = a.format === 'district' ? Math.max(0, Math.min(f.length, Math.floor(Math.min(...stations) / 2) * 2)) : 0;
      const end = a.format === 'district' ? Math.max(start, Math.min(f.length, Math.ceil(Math.max(...stations) / 2) * 2)) : f.length;
      faceMap.set(f.id, { face: { ...f, id: a.format === 'district' ? `${id}:f${i}` : f.id, ownerId: id, edgeIds: f.edgeIds.flatMap(e => roadIds.has(e) ? [roadIds.get(e)!] : []),
        start: frame.local(along(f, start)), end: frame.local(along(f, end)), inward: frame.vector(f.inward), length: clean(end - start), moduleStationOffset: 0, cornerIds: [null, null] }, offset: start });
    }
    const frontages = [...faceMap.values()].map(f => f.face);
    const local: NativeOwner = { ...owner, id, ground: ground.map((g, i) => ({ ...g, id: `${id}:g${i}`, ownerId: id })), interiors: a.format === 'district' ? [] : owner.interiors.map(r => r.map(frame.local)), excludedParcelIds: [], guards: [], frontages,
      corners: owner.corners.filter(c => a.format !== 'district' || intersects(bounds(c.kind === 'arc' ? [...c.arc, c.center] : c.boundary), maskBox)).map((c, i) => ({ ...c, id: `${id}:c${i}`, ownerId: id,
        frontageIds: c.frontageIds.flatMap(f => faceMap.has(f) ? [faceMap.get(f)!.face.id] : []),
        ...(c.kind === 'arc' ? { center: frame.local(c.center), arc: c.arc.map(frame.local) } : { boundary: c.boundary.map(frame.local) }) })),
      parking: owner.parking.flatMap((p, i) => {
        const f = faceMap.get(p.frontageId); if (!f) return [];
        const part = localRings(intersection([p.footprint], mask)); if (totalArea(part) < 1e-9) return [];
        return part.map((footprint, j) => ({ ...p, id: `${id}:p${i}:${j}`, ownerId: id, frontageId: f.face.id, start: clean(p.start - f.offset), end: clean(p.end - f.offset),
          support: { start: clean(p.support.start - f.offset), end: clean(p.support.end - f.offset) }, footprint, slots: [] }));
      }) };
    owners.push(local);
    details.set(id, features.flatMap(f => {
      if (f.descriptor.ownerId !== owner.id || !f.cut) return [];
      const face = faceMap.get(f.cut.frontageId); if (!face) return [];
      if (totalArea(intersection([f.cut.ring, ...(f.panel ? [f.panel] : [])], mask)) <= 1e-9) return [];
      return [{ cut: { ...f.cut, id: '', frontageId: face.face.id, start: clean(f.cut.start - face.offset), end: clean(f.cut.end - face.offset), ring: f.cut.ring.map(frame.local) },
        ...(f.panel ? { panel: f.panel.map(frame.local) } : {}) } satisfies UnitDetail];
    }));
  }
  const approaches = region.roads.flatMap((r, i) => nearbyApproaches[i]!.map(p => {
    const local = roads[i]!, d = direction(local.path[0]!, local.path.at(-1)!);
    const field = p.field.map(frame.local), stations = field.map(v => dot(sub(v, local.path[0]!), d));
    return { ...p, id: `${local.id}:${p.nodeId === r.from ? 'from' : 'to'}`, nodeId: p.nodeId === r.from ? local.from : local.to,
      edgeId: local.id, station: [clean(Math.min(...stations)), clean(Math.max(...stations))] as Vec2, distance: clean(stations.reduce((a, b) => a + b, 0) / stations.length),
      field, landings: p.landings.map(ring => ring.map(frame.local)) };
  }));
  // All arms meeting the local junction share a node identity for its central finish.
  if (region.kind !== 'segment') for (const p of approaches) p.nodeId = 'junction';
  if (region.kind !== 'segment') for (const [i, r] of roads.entries()) {
    const source = region.roads[i]!;
    if (distance(source.path[0]!, [frame.position[0], frame.position[2]]) < 1e-6) r.from = 'junction';
    else r.to = 'junction';
  }
  const laneIds = new Map(region.roads.flatMap((r, i) => r.lanes.map((l, k) => [l.id, roads[i]!.lanes[k]!.id])));
  const turns = a.turns.flatMap(t => {
    const fromLaneId = laneIds.get(t.fromLaneId), toLaneId = laneIds.get(t.toLaneId) ?? `exit:${t.kind}`;
    if (!fromLaneId) return [];
    const sourceRoad = region.roads.find(r => r.lanes.some(l => l.id === t.fromLaneId))!;
    const road = roads[region.roads.indexOf(sourceRoad)]!;
    return [{ ...t, nodeId: sourceRoad.from === t.nodeId ? road.from : road.to, fromLaneId, toLaneId }];
  });
  const localBounds = bounds(owners.flatMap(o => o.ground.flatMap(g => g.ring)));
  const architecture: NativeArchitecture = { ...a, owners, roads, approaches, turns, bounds: localBounds,
    boundary: rectangle(localBounds.min[0], localBounds.min[1], localBounds.max[0] - localBounds.min[0], localBounds.max[1] - localBounds.min[1]),
    shafts: [], stationBays: a.stationBays.map(b => ({ ...b, footprint: b.footprint.map(frame.local), shaft: b.shaft.map(frame.local), approach: b.approach.map(frame.local) })),
    medians: selected.flatMap(({ owner }, i) => a.medians?.filter(m => m.id === owner.id).map(m => ({ ...m, id: `o${i}`, edgeId: roadIds.get(m.edgeId)!, footprint: [], paving: [], ornaments: [] })) ?? []),
    protections: [], obstaclePoints: [], exclusions: [] };
  const variant = [...(owners.some(o => o.parking.length) ? ['parking'] : []), ...([...details.values()].some(d => d.length) ? ['drain'] : [])].join('-') || 'plain';

  const halo = { min: [maskBox.min[0] - 1, maskBox.min[1] - 1] as Vec2, max: [maskBox.max[0] + 1, maskBox.max[1] + 1] as Vec2 };
  const edgeOwners = a.owners.map(o => ({ ...o, ground: o.ground.filter(g => intersects(bounds(g.ring), halo)).map(g => ({ ...g, ring: g.ring.map(frame.local) })) }));
  return { architecture, edgeOwners, details, variant, wear: p => worldWear(frame.world(p)) };
}
