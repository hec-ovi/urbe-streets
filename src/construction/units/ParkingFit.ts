import type { NativeArchitecture, NativeOwner, NativeParking, NativeRoad } from '../../architecture/native-schema.ts';
import type { Ring } from '../../geometry/schema.ts';
import { difference, intersection, rectangle, totalArea, union } from '../../geometry/polygons.ts';
import { UnitFrame } from './Frame.ts';
import type { UnitRegion } from './UnitPlan.ts';
import { parkingFields } from './ParkingFields.ts';
import type { ProfileCatalogue } from './ProfileCatalogue.ts';
import { parkingFinishes, type ParkingFinish } from './ParkingScene.ts';

export interface ParkingFit {
  bay: NativeParking; owner: NativeOwner; road: NativeRoad; frame: UnitFrame; finish: ParkingFinish;
}
const sameArea = (a: Ring[], b: Ring[]) => totalArea(difference(a, b)) + totalArea(difference(b, a)) < 1e-7;
export function parkingFinish(owner: NativeOwner | undefined, zone: string): ParkingFinish {
  return parkingFinishes.find(f => f === owner?.finish) ?? (zone === 'luxury' ? 'luxury-blue' : zone === 'industrial' ? 'industrial-yellow' : 'ordinary');
}

/** A catalogue fit preserves the saved footprint and every slot, or reports the bay. */
export function fitParking(a: NativeArchitecture, regions: readonly UnitRegion[], profiles: ProfileCatalogue): ParkingFit[] {
  const fitted: ParkingFit[] = [];
  const roads = new Map(a.roads.map(r => [r.id, r]));
  const byRoad = new Map<string, UnitRegion[]>();
  for (const region of regions) if (region.kind === 'segment') {
    const id = region.roads[0]!.id;
    const run = byRoad.get(id) ?? []; run.push(region); byRoad.set(id, run);
  }
  for (const owner of a.owners) for (const bay of owner.parking) {
    const face = owner.frontages.find(f => f.id === bay.frontageId)!;
    const frame = new UnitFrame(face.start, [face.inward[1], -face.inward[0]], face.roadTop);
    const road = face.edgeIds.map(id => roads.get(id)).find(r => r !== undefined);
    const reject = (reason: string) => { a.degraded.push({ id: bay.id, reason }); };
    if (!road || road.kind === 'alley' || road.kind === 'highway' || road.medianWidth || a.format !== 'district') {
      reject('Parking has no supported undivided district road'); continue;
    }
    if (profiles.select(road).width !== road.width) { reject('Parking road width has no exact catalogue profile'); continue; }
    const runs = byRoad.get(road.id) ?? [];
    const support = rectangle(bay.support.start, 0, bay.support.end - bay.support.start, 4.9).map(frame.world);
    const expected = rectangle(bay.start, 0, bay.end - bay.start, 2).map(frame.world);
    const slots = bay.slots.every((s, i) => sameArea([s], [rectangle(bay.start + 2 + i * 6, 0, 6, 2).map(frame.world)]));
    if (!sameArea([bay.footprint], [expected]) || !slots) { reject('Parking does not match the rectangular bay and 6 m slot catalogue'); continue; }
    const fields = [['parking-start', bay.support.start, 4], ['parking-slot', bay.start + 2, bay.slotCount * 6],
      ['parking-end', bay.end - 2, 4]] as const;
    const expectedFields = fields.flatMap(([variant, station, length]) => parkingFields(length, variant).map(f => ({
      surface: f.surface, rings: f.rings.map(r => r.map(([x, z]) => frame.world([x + station, z])))
    })));
    if (['roadway', 'gutter', 'curb', 'sidewalk'].some(surface => !sameArea(
      union(expectedFields.filter(f => f.surface === surface).flatMap(f => f.rings)),
      intersection(owner.ground.filter(g => g.surface === surface).map(g => g.ring), [support])))) {
      reject('Parking kerb and walking bands disagree with authored ground'); continue;
    }
    const roadFrame = new UnitFrame(road.path[0]!, runs[0]?.frame.d);
    if (Math.abs(Math.abs(roadFrame.local(face.start)[1]) - road.width / 2) > 1e-7
      || totalArea(difference([support], union(runs.flatMap(r => r.mask)))) > 1e-7) {
      reject('Parking support does not fit its straight road and kerb'); continue;
    }
    if (fitted.some(p => p.road.id === road.id && totalArea(intersection([support], [rectangle(p.bay.support.start, 0, p.bay.support.end - p.bay.support.start, 4.9).map(p.frame.world)])) > 1e-7)) {
      reject('Parking supports overlap'); continue;
    }
    fitted.push({ bay, owner, road, frame, finish: parkingFinish(owner, road.districtStyle ?? 'ordinary') });
  }
  return fitted;
}
