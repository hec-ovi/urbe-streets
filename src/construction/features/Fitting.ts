import type { NativeArchitecture, NativeOwner } from '../../architecture/native-schema.ts';
import type { Ring, Vec2 } from '../../geometry/schema.ts';
import { difference, intersection, totalArea } from '../../geometry/polygons.ts';
import { contains } from '../surfaces/Regions.ts';
import { BoundaryIndex } from '../surfaces/BoundaryIndex.ts';

export class Fitting {
  private readonly architecture: NativeArchitecture;
  private readonly road: BoundaryIndex;
  private readonly curb: BoundaryIndex;
  constructor(architecture: NativeArchitecture) {
    this.architecture = architecture;
    const fields = architecture.owners.flatMap(owner => owner.ground);
    this.road = new BoundaryIndex(fields.filter(field => field.surface === 'roadway').map(field => field.ring));
    this.curb = new BoundaryIndex(fields.filter(field => field.surface === 'curb').map(field => field.ring));
  }
  rejection(owner: NativeOwner, footprint: Ring, kind: 'guard' | 'inlet' | 'channel'): string | null {
    const land = owner.ground.filter(field => kind === 'inlet' || field.surface === 'sidewalk' || (kind === 'guard' && field.surface === 'curb')).map(field => field.ring);
    if (totalArea(difference([footprint], land)) > 1e-7) return 'Footprint leaves its authored receiving land';
    const protectedLand = [...this.architecture.shafts.map(shaft => shaft.ring), ...this.architecture.stationBays.map(bay => bay.footprint),
      ...this.architecture.approaches.flatMap(approach => [approach.field, ...approach.landings])];
    if (totalArea(intersection([footprint], protectedLand)) > 1e-7) return 'Footprint enters protected crossing or station land';
    for (const obstacle of this.architecture.obstaclePoints) if (this.distance(footprint, obstacle.position) < obstacle.clearance - 1e-7) return `Footprint conflicts with ${obstacle.id}`;
    return null;
  }
  inletInterfaces(front: Ring): boolean {
    const a = front[0]!, b = front[1]!, backA = front[3]!, backB = front[2]!;
    const curbA: Vec2 = [a[0] + (backA[0] - a[0]) * 0.6, a[1] + (backA[1] - a[1]) * 0.6];
    const curbB: Vec2 = [b[0] + (backB[0] - b[0]) * 0.6, b[1] + (backB[1] - b[1]) * 0.6];
    return [a, b].every(p => this.road.distance(p) < 1e-7) && [curbA, curbB].every(p => this.curb.distance(p) < 1e-7);
  }
  private distance(ring: Ring, point: Vec2): number {
    if (contains(ring, point)) return 0;
    let nearest = Infinity;
    ring.forEach((a, i) => {
      const b = ring[(i + 1) % ring.length]!, dx = b[0] - a[0], dz = b[1] - a[1], squared = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / squared));
      nearest = Math.min(nearest, Math.hypot(point[0] - a[0] - dx * t, point[1] - a[1] - dz * t));
    });
    return nearest;
  }
}
