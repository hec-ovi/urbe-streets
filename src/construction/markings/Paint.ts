import type { Ring, Vec2 } from '../../geometry/schema.ts';
import { area, difference, intersection, totalArea } from '../surfaces/Regions.ts';
import { dot, sub } from '../surfaces/Frame.ts';
import { random } from '../style/random.ts';
import { SurfaceBatch } from '../surfaces/SurfaceBatch.ts';
import type { RoadFrame } from './schema.ts';
export const at = (frame: RoadFrame, station: number, offset = 0): Vec2 => [frame.start[0] + frame.d[0] * station + frame.n[0] * offset, frame.start[1] + frame.d[1] * station + frame.n[1] * offset];

/** Source paint dimensions and scan phase, clipped only to its retained road owner. */
export class Paint {
  private readonly batch: SurfaceBatch;
  private readonly domain: Ring[];
  private readonly seed: number;
  constructor(batch: SurfaceBatch, domain: Ring[], seed: number) { this.batch = batch; this.domain = domain; this.seed = seed; }
  polygon(surface: string, ring: Ring, height: number, uv: (point: Vec2) => Vec2): void {
    const source = [area(ring) < 0 ? [...ring].reverse() : ring];
    const part = difference(source, this.domain).length === 0 ? source : intersection(source, this.domain);
    if (totalArea(part) > 1e-12) this.batch.polygon(surface, part, height, uv, false);
  }
  strip(frame: RoadFrame, start: number, end: number, offset: number, width: number, surface: string): void {
    if (end <= start) return;
    const origin = at(frame, start, offset - width / 2), phase = random(this.seed, `${frame.road.id}:${start}:${offset}:paint`) * 17;
    this.polygon(surface, [origin, at(frame, end, offset - width / 2), at(frame, end, offset + width / 2), at(frame, start, offset + width / 2)], frame.top + 0.006,
      p => [dot(sub(p, origin), frame.d) / 2.7 + phase, 0.155 + dot(sub(p, origin), frame.n) / width * 0.69]);
  }
  bar(frame: RoadFrame, station: number, first: number, last: number, width: number, surface: string): void {
    if (last <= first) return;
    const origin = at(frame, station, first);
    this.polygon(surface, [origin, at(frame, station + width, first), at(frame, station + width, last), at(frame, station, last)], frame.top + 0.007,
      p => [dot(sub(p, origin), frame.n) / 2.7 + station * 0.17, 0.155 + dot(sub(p, origin), frame.d) / width * 0.69]);
  }
}
