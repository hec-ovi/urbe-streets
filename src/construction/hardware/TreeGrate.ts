import { Parts } from './Parts.ts';
import type { FurnitureOptions } from './schema.ts';

/** Framed square grate with a round opening for the independently placed tree. */
export function treeGrate(p: Parts, o: FurnitureOptions): void {
  const x = o.length / 2, z = o.depth / 2, rim = 0.1, inner = z - rim, hole = 0.23;
  p.box('darkMetal', o.length - rim, 0.015, o.depth - rim, 0, 0.205, 0);
  for (const sign of [-1, 1]) {
    p.box('ochre', o.length, 0.06, rim, 0, 0.23, sign * (z - rim / 2));
    p.box('ochre', rim, 0.06, o.depth - rim * 2, sign * (x - rim / 2), 0.23, 0);
  }
  for (let at = -x + rim + 0.06; at < x - rim; at += 0.12) {
    const cut = Math.abs(at) < hole ? Math.sqrt(hole * hole - at * at) : 0;
    const spans = cut ? [[-inner, -cut], [cut, inner]] : [[-inner, inner]];
    for (const [a, b] of spans) p.box('metal', 0.025, 0.035, b! - a!, at, 0.23, (a! + b!) / 2);
  }
  for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12, b = (i + 1) * Math.PI / 12;
    p.beam('metal', [Math.cos(a) * hole, 0.24, Math.sin(a) * hole], [Math.cos(b) * hole, 0.24, Math.sin(b) * hole], 0.015);
  }
}
