import type { Vec2 } from '../../geometry/schema.ts';
import { random } from '../style/random.ts';
import { dot, sub } from '../surfaces/Frame.ts';
import { Paint, at } from './Paint.ts';
import type { RoadFrame } from './schema.ts';

export interface RoadArtifact { surface: string; station: number; offset: number; length: number; width: number; height: number }

export function artifactPlan(frame: RoadFrame, start: number, end: number, seed: number, wearAt: (point: Vec2) => number): RoadArtifact[] {
  const result: RoadArtifact[] = [];
  for (let s = start + 3; s < end - 3; s += 6) {
    const key = `${frame.road.id}:${s}:artifact`, r = random(seed, key), wear = wearAt(at(frame, s));
    const offset = (random(seed, `${key}:offset`) - 0.5) * (frame.road.width - 4);
    if (r < wear * 0.8) result.push({ surface: ['asphalt-damage', 'asphalt-fracture', 'asphalt-repair'][Math.floor(random(seed, `${key}:crack-variant`) * 3)]!,
      station: s, offset, length: 2 + 2 * random(seed, `${key}:crack-size`), width: 2.3, height: frame.top + 0.009 });
    if (random(seed, `${key}:oil`) < wear * 0.17) result.push({ surface: 'oil-patch', station: s, offset, length: 2.7, width: 1.8, height: frame.top + 0.011 });
  }
  return result;
}

export function artifacts(paint: Paint, frame: RoadFrame, start: number, end: number, seed: number, wearAt: (point: Vec2) => number): void {
  for (const { surface, station: s, offset, length, width, height } of artifactPlan(frame, start, end, seed, wearAt)) {
    const origin = at(frame, s - length / 2, offset);
    paint.polygon(surface, [at(frame, s - length / 2, offset - width / 2), at(frame, s + length / 2, offset - width / 2),
      at(frame, s + length / 2, offset + width / 2), at(frame, s - length / 2, offset + width / 2)], height,
      p => [dot(sub(p, origin), frame.d) / length, 0.5 - dot(sub(p, origin), frame.n) / width]);
  }
}
