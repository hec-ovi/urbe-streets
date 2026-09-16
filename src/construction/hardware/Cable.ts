import { Parts } from './Parts.ts';
import { tube } from './Tube.ts';
import type { FurnitureOptions } from './schema.ts';

/** Exposed cable bundle and curb sockets on a shallow metal tray. */
export function cable(p: Parts, o: FurnitureOptions): void {
  const half = o.length / 2, rear = o.depth - 0.2;
  p.box('darkMetal', o.length, 0.025, rear, 0, 0.018, rear / 2);
  for (const z of [0.025, rear - 0.025]) p.box('metal', o.length, 0.035, 0.04, 0, 0.035, z);
  for (const x of [-half + 0.2, half - 0.2]) {
    p.box('metal', 0.34, 0.16, 0.08, x, 0.115, rear);
    p.box('darkMetal', 0.28, 0.11, 0.035, x, 0.115, rear - 0.045);
  }
  for (let i = 0; i < 5; i++) {
    const lane = 0.08 + i * 0.045, end = 0.2 + (i - 2) * 0.045;
    p.add(i === 2 ? 'ochre' : 'plastic', tube([
      [-half + end, 0.11, rear], [-half + end, 0.065, rear - 0.09], [-half + 0.5, 0.055, lane],
      [0, 0.07 + i * 0.002, lane + 0.035], [half - 0.5, 0.055, lane],
      [half - end, 0.065, rear - 0.09], [half - end, 0.11, rear],
    ], 0.013));
  }
  for (const x of [-half + 0.65, half - 0.65]) p.box('metal', 0.06, 0.055, rear - 0.05, x, 0.065, rear / 2);
}
