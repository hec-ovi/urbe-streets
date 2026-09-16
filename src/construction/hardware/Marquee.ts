import { Parts } from './Parts.ts';
import { prism } from './Prism.ts';
import type { FurnitureOptions } from './schema.ts';

/** Low framed ramp; its illuminated face follows the sloping top. */
export function marquee(p: Parts, o: FurnitureOptions): void {
  const profile: [number, number][] = [[0.02, 0.015], [o.depth - 0.02, 0.015], [o.depth - 0.02, 0.195], [0.02, 0.035]];
  p.add('darkMetal', prism(profile, o.length, 'x'));
  for (const x of [-o.length / 2 + 0.025, o.length / 2 - 0.025]) p.add('metal', prism(profile, 0.05, 'x', x));
  p.box('metal', o.length, 0.035, 0.04, 0, 0.03, 0.02);
  p.box('metal', o.length, 0.025, 0.04, 0, 0.19, o.depth - 0.02);
}
