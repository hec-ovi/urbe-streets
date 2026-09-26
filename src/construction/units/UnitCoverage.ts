import type { NativeArchitecture, NativeOwner, NativeGround } from '../../architecture/native-schema.ts';
import type { Ring } from '../../geometry/schema.ts';
import type { StreetOverhangReport, StreetPlacement } from '../../schema/street-kit.ts';
import { area, bounds, difference, intersection, intersects, totalArea, union } from '../../geometry/polygons.ts';
import { BoxIndex } from '../../geometry/BoxIndex.ts';
import { NativeCoverage } from '../../ground/NativeCoverage.ts';
import { invariant } from '../../errors.ts';
import type { AuthoredUnit } from './KitCatalogue.ts';
import { placementFootprint } from './PlacementGeometry.ts';

/** Intersections measure ownership only. Rendering and collision keep the whole footprint. */
export class UnitCoverage {
  readonly report: StreetOverhangReport = { accepted: [], boundaryArea: 0, fringeArea: 0, overlapArea: 0 };
  private readonly claims: Map<string, Ring[]>;
  private readonly surfaces: Ring[] = [];
  private readonly architecture: NativeArchitecture;
  private readonly ground: BoxIndex<NativeOwner>;
  private readonly shafts: BoxIndex<Ring>;
  private readonly occupied = new BoxIndex<Ring>();
  private readonly lanes = new BoxIndex<Ring>();
  private readonly raised = new Map<AuthoredUnit, Ring[]>();

  constructor(a: NativeArchitecture) {
    this.architecture = a;
    this.claims = new Map(a.owners.map(o => [o.id, []]));
    this.ground = new BoxIndex();
    for (const owner of a.owners) for (const g of owner.ground) this.ground.add(owner, bounds(g.ring));
    this.shafts = new BoxIndex(a.shafts.map(s => s.ring), bounds);
    for (const road of a.roads.filter(r => r.kind !== 'highway')) for (const lane of road.lanes) for (let i = 1; i < lane.path.length; i++) {
      const p = lane.path[i - 1]!, q = lane.path[i]!, length = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const n = [-(q[1] - p[1]) / length * lane.width / 2, (q[0] - p[0]) / length * lane.width / 2];
      const ring: Ring = [[p[0] - n[0]!, p[1] - n[1]!], [q[0] - n[0]!, q[1] - n[1]!], [q[0] + n[0]!, q[1] + n[1]!], [p[0] + n[0]!, p[1] + n[1]!]];
      this.lanes.add(ring, bounds(ring));
    }
  }

  /** A whole instance must fit the original roles, heights and unclaimed land. */
  fits(piece: AuthoredUnit, p: StreetPlacement): boolean {
    const footprint = placementFootprint(piece.metadata, p), box = bounds(footprint.flat());
    if (totalArea(intersection(footprint, this.occupied.near(box))) > 1e-7) return false;
    const ground = [...new Set(this.ground.near(box))].flatMap(o => o.ground);
    if (totalArea(difference(footprint, ground.map(g => g.ring))) > 1e-7) return false;
    if (totalArea(intersection(footprint, this.shafts.near(box))) > 1e-7) return false;
    for (const field of piece.fields ?? []) {
      const rings = placementFootprint({ footprint: [field.ring] }, p);
      const top = p.position[1] + field.top * (p.scale?.[1] ?? 1);
      const matching = ground.filter(g => g.surface === field.surface && Math.abs(g.top - top) < 1e-7).map(g => g.ring);
      if (totalArea(difference(rings, matching)) > 1e-7) return false;
    }
    return true;
  }

  remaining(g: NativeGround): Ring[] {
    return difference([g.ring], [...this.occupied.near(bounds(g.ring)), ...this.shafts.near(bounds(g.ring))]);
  }

  add(piece: AuthoredUnit, p: StreetPlacement, index: number, receiving?: Ring[], source?: NativeGround): void {
    const a = this.architecture, footprint = placementFootprint(piece.metadata, p), box = bounds(footprint.flat());
    const physical = piece.geometry.meshes.some(m => m.collision);
    if (physical) {
      if (source) {
        const top = p.position[1] + piece.geometry.bounds.max[1] * (p.scale?.[1] ?? 1);
        if (Math.abs(top - source.top) > 1e-7 || totalArea(difference(footprint, [source.ring])) > 1e-6)
          throw invariant('Infill leaves its saved surface or level', { piece: p.piece, sourceIndex: source.sourceIndex });
      } else if (piece.metadata.kind !== 'prop' && !this.fits(piece, p)) throw invariant('Street instance conflicts with its receiving surface roles', { piece: p.piece, placement: index });
      if (piece.metadata.kind !== 'prop' && totalArea(intersection(footprint, this.occupied.near(box))) > 1e-6)
        throw invariant('Physical street surfaces overlap', { piece: p.piece, placement: index });
      this.checkLanes(piece, p, index);
    }
    if (physical && totalArea(intersection(footprint, this.shafts.near(box))) > 1e-7)
      throw invariant('Transformed street piece enters a station shaft', { piece: p.piece, placement: index });
    const owners = [...new Set(this.ground.near(box))].filter(o => o.ground.some(g => intersects(box, bounds(g.ring))));
    const covered = owners.flatMap(o => {
      const part = intersection(footprint, o.ground.map(g => g.ring));
      if (totalArea(part) <= 1e-9) return [];
      if (piece.metadata.kind !== 'prop' && physical) this.claims.get(o.id)!.push(...part);
      return [o.id];
    });
    if (covered.length) { p.ownerIds = covered; if (!covered.includes(p.ownerId)) p.ownerId = covered[0]!; }
    const expected = receiving ?? owners.flatMap(o => o.ground.map(g => g.ring));
    const excess = difference(footprint, expected);
    const boundaryArea = totalArea(difference(excess, [a.boundary]));
    const fringeArea = totalArea(intersection(excess, [a.boundary]));
    if (boundaryArea + fringeArea > 1e-7) {
      this.report.accepted.push({ placement: index, piece: p.piece, boundaryArea, fringeArea });
      this.report.boundaryArea += boundaryArea; this.report.fringeArea += fringeArea;
    }
    if (piece.metadata.kind !== 'prop' && physical) for (const ring of footprint) { this.surfaces.push(ring); this.occupied.add(ring, bounds(ring)); }
  }

  finish(mappedWidths: Ring[]): ReturnType<NativeCoverage['finish']> {
    const coverage = new NativeCoverage(this.architecture), mapped = new BoxIndex(mappedWidths, bounds);
    for (const owner of this.architecture.owners) coverage.add(owner, [{ ownerId: owner.id, rings: this.claims.get(owner.id)! }], mapped);
    const complete = union(this.surfaces);
    // Integer area on the boolean grid avoids cancellation across thousands of instances.
    this.report.overlapArea = Math.round(Math.max(0, Number(exactArea2(this.surfaces) - exactArea2(complete)) / 2e16) * 1e6) / 1e6;
    if (this.report.overlapArea > 0) throw invariant('Physical street surfaces overlap', { overlapArea: this.report.overlapArea });
    const ground = coverage.finish();
    ground.cover.outsideArea = totalArea(difference(complete, this.architecture.owners.flatMap(o => o.ground.map(g => g.ring))));
    return ground;
  }

  private checkLanes(piece: AuthoredUnit, p: StreetPlacement, index: number): void {
    // Cache only at the canonical height; infill has its receiving height in its transform.
    let raised = this.raised.get(piece);
    if (!raised || p.position[1] !== 0 || p.scale?.[1] !== undefined && p.scale[1] !== 1) {
      const triangles: Ring[] = [];
      for (const mesh of piece.geometry.meshes.filter(m => m.collision)) for (let i = 0; i < mesh.positions.length; i += 9) {
        if (![1, 4, 7].some(k => p.position[1] + mesh.positions[i + k]! * (p.scale?.[1] ?? 1) > 0.05 + 1e-7)) continue;
        const ring: Ring = [0, 3, 6].map(k => [mesh.positions[i + k]!, mesh.positions[i + k + 2]!] as const);
        if (Math.abs(area(ring)) > 1e-9) triangles.push(area(ring) < 0 ? [...ring].reverse() : ring);
      }
      raised = union(triangles);
      if (p.position[1] === 0 && (p.scale?.[1] ?? 1) === 1) this.raised.set(piece, raised);
    }
    const world = placementFootprint({ footprint: raised }, p);
    const overlap = totalArea(intersection(world, this.lanes.near(bounds(world.flat()))));
    if (overlap > 1e-6) throw invariant('Raised street surface enters a level-zero driving lane', { piece: p.piece, placement: index, area: overlap });
  }
}

function exactArea2(rings: readonly Ring[]): bigint {
  let sum = 0n;
  for (const ring of rings) for (const [i, p] of ring.entries()) {
    const q = ring[(i + 1) % ring.length]!;
    sum += BigInt(Math.round(p[0] * 1e8)) * BigInt(Math.round(q[1] * 1e8))
      - BigInt(Math.round(q[0] * 1e8)) * BigInt(Math.round(p[1] * 1e8));
  }
  return sum;
}
