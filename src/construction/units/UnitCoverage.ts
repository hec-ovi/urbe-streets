import type { NativeArchitecture, NativeOwner } from '../../architecture/native-schema.ts';
import type { Ring } from '../../geometry/schema.ts';
import type { StreetOverhangReport, StreetPlacement } from '../../schema/street-kit.ts';
import { bounds, difference, intersection, intersects, totalArea, union } from '../../geometry/polygons.ts';
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

  constructor(a: NativeArchitecture) {
    this.architecture = a;
    this.claims = new Map(a.owners.map(o => [o.id, []]));
    this.ground = new BoxIndex();
    for (const owner of a.owners) for (const g of owner.ground) this.ground.add(owner, bounds(g.ring));
    this.shafts = new BoxIndex(a.shafts.map(s => s.ring), bounds);
  }

  add(piece: AuthoredUnit, p: StreetPlacement, index: number, receiving?: Ring[]): void {
    const a = this.architecture, footprint = placementFootprint(piece.metadata, p), box = bounds(footprint.flat());
    const physical = piece.geometry.meshes.some(m => m.collision);
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
    if (piece.metadata.kind !== 'prop' && physical) this.surfaces.push(...footprint);
  }

  finish(mappedWidths: Ring[]): ReturnType<NativeCoverage['finish']> {
    const coverage = new NativeCoverage(this.architecture), mapped = new BoxIndex(mappedWidths, bounds);
    for (const owner of this.architecture.owners) coverage.add(owner, [{ ownerId: owner.id, rings: this.claims.get(owner.id)! }], mapped);
    this.report.overlapArea = Math.max(0, totalArea(this.surfaces) - totalArea(union(this.surfaces)));
    const ground = coverage.finish();
    ground.cover.outsideArea = totalArea(difference(union(this.surfaces), this.architecture.owners.flatMap(o => o.ground.map(g => g.ring))));
    return ground;
  }
}
