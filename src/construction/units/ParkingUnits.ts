import type { NativeArchitecture, NativeOwner, NativeParking } from '../../architecture/native-schema.ts';
import type { Vec2 } from '../../geometry/schema.ts';
import type { StreetPlacement } from '../../schema/street-kit.ts';
import { clean, UnitFrame } from './Frame.ts';
import type { UnitRegion } from './UnitPlan.ts';
import { coreId, sideId } from './ParkingScene.ts';
import { fitParking, parkingFinish, type ParkingFit } from './ParkingFit.ts';
import type { ProfileCatalogue } from './ProfileCatalogue.ts';
import { placement } from './UnitOverlays.ts';

/** Road cores retain their paint phase. Independent kerbs follow exact bay stations. */
export class ParkingUnits {
  readonly regions = new Map<UnitRegion, StreetPlacement[]>();
  readonly placements: StreetPlacement[] = [];
  readonly bays = new Set<NativeParking>();

  constructor(a: NativeArchitecture, regions: readonly UnitRegion[], profiles: ProfileCatalogue) {
    const byRoad = new Map<string, ParkingFit[]>();
    const owners = new Map<string, { owner: NativeOwner; inward: Vec2 }[]>();
    for (const owner of a.owners) for (const face of owner.frontages) for (const id of face.edgeIds) {
      const sides = owners.get(id) ?? []; sides.push({ owner, inward: face.inward }); owners.set(id, sides);
    }
    for (const fit of fitParking(a, regions, profiles)) {
      const { bay, frame, finish, owner } = fit;
      this.bays.add(bay);
      const road = byRoad.get(fit.road.id) ?? []; road.push(fit); byRoad.set(fit.road.id, road);
      const pieces: [string, number][] = [['parking-start', bay.support.start],
        ...Array.from({ length: bay.slotCount }, (_, i): [string, number] => ['parking-slot', bay.start + 2 + i * 6]),
        ['parking-end', bay.end - 2]];
      for (const [variant, station] of pieces) this.placements.push(placement(sideId(finish, variant),
        new UnitFrame(frame.world([station, 0]), frame.d, frame.position[1]), [owner.id]));
    }
    for (const region of regions) {
      if (region.kind !== 'segment') continue;
      const road = region.roads[0]!, profile = profiles.select(road);
      const nearby = (byRoad.get(road.id) ?? []).map(f => {
        const points = [f.frame.world([f.bay.support.start, 0]), f.frame.world([f.bay.support.end, 0])].map(region.frame.local);
        return { start: Math.min(...points.map(p => p[0])), end: Math.max(...points.map(p => p[0])), side: Math.sign(points[0]![1]) };
      }).filter(f => f.end > 1e-7 && f.start < region.length - 1e-7);
      if (!nearby.length) continue;
      const core = placement(coreId(profile, region.length < 8), region.frame, ['roadway']);
      if (region.length < 8 && region.length !== 2) core.scale = [region.length / 2, 1, 1];
      const output = [core];
      for (const sign of [-1, 1]) {
        const n: Vec2 = [-region.frame.d[1] * sign, region.frame.d[0] * sign];
        const owner = owners.get(road.id)?.find(f => f.inward[0] * n[0] + f.inward[1] * n[1] > 0.99)?.owner;
        const finish = parkingFinish(owner, profile.zone);
        const cuts = nearby.filter(f => f.side === sign).sort((a, b) => a.start - b.start);
        let station = 0;
        for (const cut of cuts) {
          this.walk(output, region, sign, profile.width / 2, station, Math.max(0, cut.start), finish, owner);
          station = Math.min(region.length, cut.end);
        }
        this.walk(output, region, sign, profile.width / 2, station, region.length, finish, owner);
      }
      this.regions.set(region, output);
    }
  }

  private walk(out: StreetPlacement[], region: UnitRegion, sign: number, half: number, start: number, end: number, finish: string, owner?: NativeOwner): void {
    let station = start;
    while (end - station > 1e-7) {
      const remaining = clean(end - station), length = remaining >= 8 ? 8 : Math.min(2, remaining);
      const frame = new UnitFrame(region.frame.world([sign > 0 ? station : station + length, sign * half]),
        [region.frame.d[0] * sign, region.frame.d[1] * sign]);
      const p = placement(sideId(finish, length === 8 ? 'walk' : 'walk-closure'), frame, [owner?.id ?? 'roadway']);
      if (length < 2) p.scale = [length / 2, 1, 1];
      out.push(p); station = clean(station + length);
    }
  }
}
