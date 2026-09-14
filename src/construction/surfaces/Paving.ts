import { invariant } from '../../errors.ts';
import type { NativeArchitecture, NativeFrontage, NativeOwner } from '../../architecture/native-schema.ts';
import type { Ring, Vec2 } from '../../geometry/schema.ts';
import { PanelStyle } from '../style/PanelStyle.ts';
import type { PanelPalette } from '../style/schema.ts';
import { clip, difference, intersection, totalArea } from './Regions.ts';
import { add, along, cross, direction, distance, dot, scale, sub } from './Frame.ts';
import { cornerCuts, type CornerCut } from './CornerCuts.ts';
import { CornerPaving } from './CornerPaving.ts';
import { panelLayout } from './PanelLayout.ts';
import { SurfaceBatch } from './SurfaceBatch.ts';
import type { SurfaceCut } from './schema.ts';

// Two independently authored 1 mm boundaries can differ by one diagonal grid step.
const boundaryJointEnclosure = Math.SQRT2 / 1000;

/** Original rectangular rows and corner fans, bounded by sole Atlas paving owners. */
export class Paving {
  private readonly architecture: Pick<NativeArchitecture, 'roads' | 'stationBays'>;
  private readonly seed: number;
  private readonly wear: (point: Vec2) => number;
  constructor(architecture: Pick<NativeArchitecture, 'roads' | 'stationBays'>, seed: number, wear: (point: Vec2) => number) { this.architecture = architecture; this.seed = seed; this.wear = wear; }

  build(owner: NativeOwner, batch: SurfaceBatch, openings: readonly SurfaceCut[], shafts: readonly Ring[]): number {
    const fields = owner.ground.filter(field => field.surface === 'sidewalk');
    if (!fields.length) return 0;
    const top = fields[0]!.top;
    if (fields.some(field => field.top !== top)) throw invariant('Paving owner has incompatible surface levels', { ownerId: owner.id });
    const domain = difference(fields.map(field => field.ring), [...shafts, ...openings.map(opening => opening.ring)]);
    batch.polygon('joint', domain, top - 0.007, point => point, true, true);
    const sample = (owner.interiors.length ? owner.interiors : fields.map(field => field.ring)).flat();
    const midpoint: Vec2 = [sample.reduce((sum, p) => sum + p[0], 0) / sample.length, sample.reduce((sum, p) => sum + p[1], 0) / sample.length];
    const palette = PanelStyle.palette(this.seed, owner.id, this.wear(midpoint));
    const planned: Ring[] = [];
    let panels = 0;
    if (owner.kind === 'station') {
      const result = this.stations(domain, owner, batch, top, palette); panels += result.panels; planned.push(...result.planned);
    } else if (owner.kind === 'underpass') {
      const fronts = owner.frontages.filter(frontage => frontage.edgeIds.some(id => this.architecture.roads.find(road => road.id === id)?.kind !== 'highway'));
      if (fronts.length !== 1) throw invariant('Underpass has no single grade-facing paving frame', { ownerId: owner.id });
      const source = fronts[0]!;
      const width = Math.max(...domain.flat().map(point => dot(sub(point, source.start), source.inward))) - 0.5;
      if (Math.abs(width * 2 - Math.round(width * 2)) > 1e-7) throw invariant('Underpass paving does not fit source half-metre rows', { ownerId: owner.id, width });
      const face = { ...source, pavedWidth: Math.round(width * 2) / 2 };
      const zone = this.zone(face, []); planned.push(zone); panels += this.rows(face, zone, domain, openings, batch, top, palette);
    } else {
      const cuts = cornerCuts(owner);
      for (const face of owner.frontages) {
        const zone = this.zone(face, cuts); if (zone.length < 3) throw invariant('Authored frontage cannot fit its source square cuts', { frontageId: face.id });
        planned.push(zone); panels += this.rows(face, zone, domain, openings, batch, top, palette);
      }
      const corners = new CornerPaving(batch, domain, top); corners.build(cuts, palette.base, palette.accent);
      panels += corners.panels; planned.push(...corners.planned);
      for (const corner of owner.corners) if (corner.kind === 'explicit') {
        if (corner.boundary.length !== 4) throw invariant('Explicit corner requires its rectangular source support', { cornerId: corner.id });
        const origin = corner.boundary[0]!, d = direction(origin, corner.boundary[1]!), n = direction(origin, corner.boundary[3]!);
        const width = distance(origin, corner.boundary[1]!), depth = distance(origin, corner.boundary[3]!);
        if (Math.abs(dot(d, n)) > 1e-8) throw invariant('Explicit corner frame is not square', { cornerId: corner.id });
        const part = intersection(domain, [corner.boundary]); planned.push(corner.boundary);
        for (let x = 0; x < width; x++) for (let z = 0; z < depth; z++) {
          const w = Math.min(1, width - x), h = Math.min(1, depth - z), at = add(origin, add(scale(d, x), scale(n, z)));
          if (this.cell(batch, palette.base, at, d, n, w, h, part, [], top)) panels++;
        }
      }
    }
    const unplanned = difference(domain, planned), missing = totalArea(unplanned);
    if (missing > 1e-6) throw invariant('Native panel layout leaves reserved paving without a design', { ownerId: owner.id, missing, region: unplanned[0] });
    return panels;
  }

  private zone(face: NativeFrontage, cuts: CornerCut[]): Ring {
    const d: Vec2 = [face.inward[1], -face.inward[0]], relevant = cuts.filter(cut => cut.corner.frontageIds.includes(face.id));
    let start = face.start, end = face.end;
    for (const cut of relevant) { if (cut.corner.frontageIds[0] === face.id) end = cut.feet[0]; else start = cut.feet[1]; }
    let zone: Ring = [add(start, scale(face.inward, 0.5 - boundaryJointEnclosure)), add(end, scale(face.inward, 0.5 - boundaryJointEnclosure)),
      add(end, scale(face.inward, face.pavedWidth + 0.5 + boundaryJointEnclosure)), add(start, scale(face.inward, face.pavedWidth + 0.5 + boundaryJointEnclosure))];
    if (dot(sub(end, start), d) <= 0) return [];
    for (const cut of relevant) {
      const side = cut.corner.frontageIds[0] === face.id ? 0 : 1;
      if (distance(cut.at, cut.hub) <= 1e-6) continue;
      zone = cross(direction(cut.at, cut.hub), sub(cut.feet[side], cut.at)) >= 0
        ? clip(zone, cut.at, cut.hub) : clip(zone, cut.hub, cut.at);
    }
    return zone;
  }

  private rows(face: NativeFrontage, zone: Ring, domain: readonly Ring[], openings: readonly SurfaceCut[], batch: SurfaceBatch, top: number, palette: PanelPalette): number {
    const field = intersection(domain, [zone]), d: Vec2 = [face.inward[1], -face.inward[0]], n = face.inward;
    const landings = openings.filter(opening => opening.kind === 'inlet' && opening.frontageId === face.id).map(opening =>
      [along(face, opening.start, 0.5), along(face, opening.end, 0.5), along(face, opening.end, 1.5), along(face, opening.start, 1.5)] as Ring);
    let count = 0;
    for (const cell of panelLayout(face, PanelStyle.rows(face.pavedWidth, this.seed, face.id), openings)) {
      const origin = along(face, cell.start, cell.depth);
      if (this.cell(batch, palette[cell.finish], origin, d, n, cell.length, cell.width, cell.landing ? domain : field, cell.landing ? [] : landings, top)) count++;
    }
    return count;
  }

  private cell(batch: SurfaceBatch, surface: string, origin: Vec2, d: Vec2, n: Vec2, width: number, depth: number, domain: readonly Ring[], holes: readonly Ring[], top: number): boolean {
    const at = (x: number, z: number) => add(origin, add(scale(d, x), scale(n, z)));
    const tile = [at(0.003, 0.003), at(width - 0.003, 0.003), at(width - 0.003, depth - 0.003), at(0.003, depth - 0.003)];
    const body = difference(intersection(domain, [tile]), holes);
    if (totalArea(body) <= 1e-12) return false;
    batch.polygon(surface, body, top, p => [dot(sub(p, origin), d) / width, dot(sub(p, origin), n) / depth]);
    return true;
  }

  private stations(domain: Ring[], owner: NativeOwner, batch: SurfaceBatch, top: number, palette: PanelPalette): { planned: Ring[]; panels: number } {
    let remaining = domain, panels = 0;
    const planned: Ring[] = [];
    for (const bay of this.architecture.stationBays) {
      const part = intersection(remaining, [bay.footprint]); if (totalArea(part) <= 1e-12) continue;
      const reference = bay.approach[0]!, n = direction(reference, bay.approach.at(-1)!), d: Vec2 = [n[1], -n[0]];
      const a = bay.footprint.map(p => dot(sub(p, reference), d)), b = bay.footprint.map(p => dot(sub(p, reference), n));
      const lo = Math.min(...a), hi = Math.max(...a), width = Math.max(...b);
      if (Math.abs(width * 2 - Math.round(width * 2)) > 1e-7) throw invariant('Station receiving field requires a half-metre source row width', { bayId: bay.id });
      const start = add(reference, add(scale(d, lo), scale(n, -0.5)));
      const face: NativeFrontage = { id: bay.id, ownerId: owner.id, edgeIds: [bay.edgeId], start, end: add(start, scale(d, hi - lo)), inward: n,
        length: hi - lo, moduleStationOffset: 0, pavedWidth: Math.round(width * 2) / 2, roadTop: top - 0.2, pavedTop: top, curbWidth: 0.2, gutterWidth: 0.3, cornerIds: [null, null] };
      const zone = this.zone(face, []); panels += this.rows(face, zone, part, [], batch, top, palette);
      planned.push(bay.footprint); remaining = difference(remaining, [bay.footprint]);
    }
    if (totalArea(remaining) > 1e-7) throw invariant('Station paving has no original entrance-bay authority', { ownerId: owner.id });
    return { planned, panels };
  }
}
