import type { Vec2 } from '../../geometry/schema.ts';
import { random } from '../style/random.ts';
import { dot, sub } from '../surfaces/Frame.ts';
import { Paint, at } from './Paint.ts';
import type { RoadFrame } from './schema.ts';

export function artifacts(paint: Paint, frame: RoadFrame, start: number, end: number, seed: number, wearAt: (point: Vec2) => number): void {
  for (let s = start + 3; s < end - 3; s += 6) {
    const key = `${frame.road.id}:${s}:artifact`, r = random(seed, key), wear = wearAt(at(frame, s));
    const offset = (random(seed, `${key}:offset`) - 0.5) * (frame.road.width - 4);
    const add = (surface: string, length: number, width: number, order: number) => {
      const origin = at(frame, s - length / 2, offset);
      paint.polygon(surface, [at(frame,s-length/2,offset-width/2),at(frame,s+length/2,offset-width/2),at(frame,s+length/2,offset+width/2),at(frame,s-length/2,offset+width/2)], frame.top + 0.007 + order * 0.001,
        p => [dot(sub(p,origin),frame.d)/length,0.5-dot(sub(p,origin),frame.n)/width]);
    };
    if (r < wear * 0.8) add(['asphalt-damage','asphalt-fracture','asphalt-repair'][Math.floor(random(seed,`${key}:crack-variant`)*3)]!, 2+2*random(seed,`${key}:crack-size`),2.3,2);
    if (random(seed,`${key}:oil`) < wear * 0.17) add('oil-patch',2.7,1.8,4);
  }
}
