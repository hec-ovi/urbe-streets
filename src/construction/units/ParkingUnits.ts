import type { NativeArchitecture, NativeFrontage, NativeParking } from '../../architecture/native-schema.ts';
import { bounds, intersection, intersects, totalArea } from '../../geometry/polygons.ts';
import type { UnitRegion } from './UnitPlan.ts';

interface RunUnit { region: UnitRegion; order: number }

/**
 * One parking piece per authored slot: every 8 m unit carries one 6 m slot with
 * its 2 m end. A bay of N slots takes the N units its footprint covers most,
 * preferring units without a drain, and reaches along its own run when the
 * footprint covers fewer whole units than the bay holds slots.
 */
export class ParkingUnits {
  readonly regions = new Set<UnitRegion>();

  constructor(a: NativeArchitecture, regions: readonly UnitRegion[], drained: ReadonlySet<UnitRegion>) {
    const runs = new Map<string, RunUnit[]>();
    for (const [order, region] of regions.entries()) if (region.kind === 'segment' && region.length === 8) {
      const roadId = region.roads[0]!.id;
      runs.set(roadId, [...runs.get(roadId) ?? [], { region, order }]);
    }
    const frontages = new Map<string, NativeFrontage>(a.owners.flatMap(o => o.frontages.map(f => [f.id, f])));
    for (const owner of a.owners) for (const bay of owner.parking) {
      const edges = new Set(frontages.get(bay.frontageId)?.edgeIds ?? []);
      this.take(bay, [...edges].flatMap(id => runs.get(id) ?? []).sort((x, y) => x.order - y.order), drained);
    }
  }

  /** Claims one unit per slot on the bay's run, closest coverage first. */
  private take(bay: NativeParking, run: readonly RunUnit[], drained: ReadonlySet<UnitRegion>): void {
    const box = bounds(bay.footprint);
    const covered = run.flatMap((unit, position) => {
      if (!intersects(unit.region.box, box)) return [];
      const overlap = totalArea(intersection([bay.footprint], unit.region.mask));
      return overlap > 1e-9 ? [{ position, overlap, drained: drained.has(unit.region) }] : [];
    });
    covered.sort((x, y) => Number(x.drained) - Number(y.drained) || y.overlap - x.overlap || x.position - y.position);
    const taken: number[] = [];
    for (const unit of covered) {
      if (taken.length >= bay.slotCount) break;
      if (this.claim(run[unit.position]!)) taken.push(unit.position);
    }
    if (!taken.length) return;
    taken.sort((x, y) => x - y);
    let low = taken[0]!, high = taken.at(-1)!, count = taken.length;
    while (count < bay.slotCount && (high + 1 < run.length || low > 0)) {
      const next = high + 1 < run.length ? ++high : --low;
      if (this.claim(run[next]!)) count++;
    }
  }

  private claim(unit: RunUnit): boolean {
    if (this.regions.has(unit.region)) return false;
    this.regions.add(unit.region);
    return true;
  }
}
