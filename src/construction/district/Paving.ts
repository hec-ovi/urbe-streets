import type { NativeArchitecture, NativeOwner } from '../../architecture/native-schema.ts';
import type { Ring, Vec2 } from '../../geometry/schema.ts';
import { area, clip, difference, inset, intersection, totalArea } from '../surfaces/Regions.ts';
import { rectangle } from '../../geometry/polygons.ts';
import { invariant } from '../../errors.ts';
import { along, dot, sub } from '../surfaces/Frame.ts';
import { SurfaceBatch } from '../surfaces/SurfaceBatch.ts';
import { palette } from './Palette.ts';
import type { DistrictFeature } from './schema.ts';
import settings from './settings.json' with { type: 'json' };

/** One material/layout module across every side, with source-centered curved rows. */
export class DistrictPaving {
  private readonly architecture: NativeArchitecture;
  constructor(architecture: NativeArchitecture) { this.architecture = architecture; }

  build(owner: NativeOwner, batch: SurfaceBatch, details: DistrictFeature[], ramps: Ring[] = []): number {
    const fields = owner.ground.filter(field => field.surface === 'sidewalk');
    if (!fields.length) return 0;
    const top = fields[0]!.top, colors = palette(owner, this.architecture);
    const domain = difference(fields.map(field => field.ring), [...this.architecture.shafts.map(shaft => shaft.ring), ...ramps]);
    batch.polygon('joint', domain, top - 0.007, p => p, true, true);
    const plates = details.flatMap(detail => detail.panel ? [detail.panel] : []);
    const planned: Ring[] = [];
    let panels = 0;
    const lay = (surface: string, shape: Ring, uv: (point: Vec2) => Vec2, fitted?: Ring) => {
      planned.push(shape);
      const body = difference(intersection(domain, [fitted ?? inset(shape, settings.joint / 2)]), plates);
      if (totalArea(body) <= 1e-10) return;
      batch.polygon(surface, body, top, uv); panels++;
    };
    if (owner.kind === 'median') batch.polygon('district-hex', domain, top, p => p);
    else if (owner.kind === 'station') batch.polygon(colors.small, domain, top, p => p);
    else {
      for (const face of owner.frontages) {
        if (owner.kind === 'underpass' && face.edgeIds.every(id => this.architecture.roads.find(road => road.id === id)?.kind === 'highway')) continue;
        const rim = face.curbWidth + face.gutterWidth;
        const rows = [{ depth: rim, width: 1, length: 1, surface: colors.small },
          { depth: rim + 1, width: 1, length: 1, surface: colors.small },
          { depth: rim + 2, width: 2, length: 2, surface: colors.large },
          { depth: rim + 4, width: 0.2, length: 2, surface: colors.separator }];
        const d: Vec2 = [face.inward[1], -face.inward[0]];
        for (const row of rows) for (let station = 0; station < face.length - 1e-8; station += row.length) {
          const end = Math.min(face.length, station + row.length), origin = along(face, station, row.depth);
          lay(row.surface, [origin, along(face, end, row.depth), along(face, end, row.depth + row.width), along(face, station, row.depth + row.width)],
            p => [dot(sub(p, origin), d) / row.length, dot(sub(p, origin), face.inward) / row.width]);
        }
      }
      for (const corner of owner.corners) {
        if (corner.kind === 'explicit') { lay(colors.small, corner.boundary, p => p); continue; }
        const center = corner.center, radius = corner.radius - 0.7;
        const at = (index: number, r: number): Vec2 => {
          const p = corner.arc[index]!, length = Math.hypot(p[0] - center[0], p[1] - center[1]);
          return [center[0] + (p[0] - center[0]) * r / length, center[1] + (p[1] - center[1]) * r / length];
        };
        for (const [inner, outer, surface, step] of [[0, 0.2, colors.separator, 12], [0.2, radius - 2, colors.large, 4],
          [radius - 2, radius - 1, colors.small, 2], [radius - 1, radius, colors.small, 2]] as const) {
          for (let start = 0; start < corner.arc.length - 1; start += step) {
            const end = Math.min(corner.arc.length - 1, start + step);
            const indices = Array.from({ length: end - start + 1 }, (_, i) => start + i);
            let shape = [...indices.map(i => at(i, outer)), ...(inner ? indices.reverse().map(i => at(i, inner)) : [center])];
            if (area(shape) < 0) shape = shape.reverse();
            const half = settings.joint / 2, order = Array.from({ length: end - start + 1 }, (_, i) => start + i);
            let body: Ring = [...order.map(i => at(i, outer - half)), ...(inner ? [...order].reverse().map(i => at(i, inner + half)) : [center])];
            body = clip(clip(body, center, at(start, 1), half), at(end, 1), center, half);
            lay(surface, shape, p => [(p[0] - center[0]) / 2, (p[1] - center[1]) / 2], body);
          }
        }
      }
      const remainder = difference(domain, planned);
      if (totalArea(remainder) > 1e-6) {
        if (owner.kind === 'block') throw invariant('District paving leaves an unplanned field', { ownerId: owner.id, missing: totalArea(remainder) });
        for (const ring of remainder) {
          const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]);
          for (let x = Math.floor(Math.min(...xs)); x < Math.max(...xs); x++) for (let z = Math.floor(Math.min(...zs)); z < Math.max(...zs); z++) {
            const part = intersection([ring], [inset(rectangle(x, z, 1, 1), settings.joint / 2)]);
            if (totalArea(part) > 1e-10) { batch.polygon(colors.small, part, top, p => [p[0] - x, p[1] - z]); panels++; }
          }
        }
      }
    }
    for (const plate of plates) batch.polygon('tread', intersection(domain, [inset(plate, settings.joint / 2)]), top, p => {
      const a = plate[0]!, x = sub(plate[1]!, a), z = sub(plate[3]!, a);
      return [dot(sub(p, a), x) / dot(x, x), dot(sub(p, a), z) / dot(z, z)];
    });
    return panels;
  }
}
