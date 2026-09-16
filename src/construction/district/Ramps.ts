import type { NativeArchitecture, NativeFrontage, NativeOwner } from '../../architecture/native-schema.ts';
import type { Ring, Vec2 } from '../../geometry/schema.ts';
import { intersection, totalArea } from '../surfaces/Regions.ts';
import { along, dot, sub } from '../surfaces/Frame.ts';
import { SurfaceBatch } from '../surfaces/SurfaceBatch.ts';
import type { SurfaceCut } from '../surfaces/schema.ts';

interface Ramp { face: NativeFrontage; start: number; end: number; cut: SurfaceCut; domain: Ring[] }

export class CrossingRamps {
  private readonly architecture: NativeArchitecture;
  constructor(architecture: NativeArchitecture) { this.architecture = architecture; }

  plan(owner: NativeOwner): Ramp[] {
    const domain = owner.ground.filter(field => field.surface !== 'roadway').map(field => field.ring);
    const result: Ramp[] = [];
    for (const face of owner.frontages) for (const approach of this.architecture.approaches) {
      if (!face.edgeIds.includes(approach.edgeId) || owner.kind === 'median') continue;
      const d: Vec2 = [face.inward[1], -face.inward[0]];
      const stations = approach.field.map(p => dot(sub(p, face.start), d));
      const start = Math.max(0, Math.min(...stations)), end = Math.min(face.length, Math.max(...stations));
      if (end - start < 2.8) continue;
      const depth = face.curbWidth + face.gutterWidth + 1;
      const ring: Ring = [along(face, start), along(face, end), along(face, end, depth), along(face, start, depth)];
      const received = intersection(domain, [ring]);
      if (totalArea(received) < (end - start) * depth - 1e-6) continue;
      result.push({ face, start, end, domain: received,
        cut: { id: `ramp:${face.id}:${approach.id}`, kind: 'ramp', frontageId: face.id, start, end, setback: 0, depth, ring } });
    }
    return result;
  }

  draw(ramps: Ramp[], batch: SurfaceBatch): void {
    for (const ramp of ramps) {
      const { face, start, end } = ramp, rim = face.curbWidth + face.gutterWidth;
      for (const [a, b] of [[0, rim], [rim, rim + 1]]) {
        const ring: Ring = [along(face, start, a!), along(face, end, a!), along(face, end, b!), along(face, start, b!)];
        batch.polygon('district-hex', intersection(ramp.domain, [ring]), p => face.roadTop
          + (face.pavedTop - face.roadTop) * Math.min(1, Math.max(0, dot(sub(p, face.start), face.inward) / rim)), p => p, true, true);
      }
    }
  }
}
