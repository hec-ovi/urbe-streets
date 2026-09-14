import { dot, sub } from '../surfaces/Frame.ts';
import { random } from '../style/random.ts';
import { Paint, at } from './Paint.ts';
import type { RoadFrame } from './schema.ts';
import type { Ring } from '../../geometry/schema.ts';
export class Crosswalk {
  private readonly paint: Paint;
  private readonly seed: number;
  constructor(paint: Paint, seed: number) { this.paint = paint; this.seed = seed; }

  /** Avenues carry bordered yellow crossings; smaller streets carry plain white bars. */
  bordered(road: RoadFrame): boolean {
    return road.road.lanes.length === 4;
  }

  /** Metres the crossing occupies along the road. */
  depth(road: RoadFrame): number {
    return this.bordered(road) ? 2.8 : 3.2;
  }

  build(road: RoadFrame, start: number, junction: number): void {
    const p = at(road, junction),
      half = road.road.width / 2;
    if (!this.bordered(road)) {
      // Plain white bars, road direction, curb to curb.
      const edge = half - 0.45,
        count = Math.max(2, Math.round((edge * 2 + 0.55) / 1.1)),
        pitch = (edge * 2) / count;
      for (let i = 0; i < count; i++)
        this.paint.strip(
          road,
          start + 0.2,
          start + 3,
          -edge + (i + 0.5) * pitch,
          0.55,
          'whitePaint',
        );
      return;
    }
    const material = 'yellowPaint';
    const d = road.d;
    const walk =
      Math.abs(d[0]) > Math.abs(d[1]) ===
      random(this.seed, `${p[0].toFixed(2)}:${p[1].toFixed(2)}:walk`) > 0.5;
    const edge = half - 0.85,
      count = Math.max(2, Math.floor((edge * 2) / 0.42)),
      pitch = (edge * 2) / count;
    for (let i = 0; i < count; i++) {
      const offset = -edge + (i + 0.5) * pitch;
      for (let row = 0; row < 3; row++)
        this.paint.strip(
          road,
          start + 0.17 + row * 0.82,
          start + 0.93 + row * 0.82,
          offset,
          pitch * 0.52,
          material,
        );
    }
    for (const s of [start, start + 2.64])
      this.paint.bar(road, s, -half + 0.08, half - 0.08, 0.16, material);
    for (const side of [-1, 1]) {
      this.paint.strip(
        road,
        start + 0.16,
        start + 2.64,
        side * (half - 0.09),
        0.12,
        material,
      );
      const origin = at(
        road,
        start + 0.2,
        side * (half - 0.74),
      );
      const points: Ring = [
        origin,
        at(road, start + 2.6, side * (half - 0.74)),
        at(road, start + 2.6, side * (half - 0.2)),
        at(road, start + 0.2, side * (half - 0.2)),
      ];
      const crop = walk
        ? [0.016, 0.212, 0.982, 0.75] as const
        : [0.018, 0.201, 0.983, 0.806] as const;
      this.paint.polygon(
        walk ? 'crosswalkWalk' : 'crosswalkWait',
        points,
        road.top + 0.009,
        (v) => {
          const u = dot(sub(v, origin), d) / 2.4,
            t = ((v[0] - origin[0]) * -d[1] + (v[1] - origin[1]) * d[0]) / 0.54;
          return [
            crop[0] + (side < 0 ? 1 - u : u) * (crop[2] - crop[0]),
            1 - crop[3] + (side < 0 ? 1 + t : 1 - t) * (crop[3] - crop[1]),
          ];
        },
      );
    }
  }
}
