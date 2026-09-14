import { Parts } from './Parts.ts';
import type { FurnitureOptions } from './schema.ts';

export function drainage(p: Parts, o: FurnitureOptions): void {
  const w = o.length;
  if (o.kind === 'access') {
    const depth = o.depth;
    p.box('darkMetal', w, 0.07, depth, 0, 0.015, 0);
    for (const z of [-depth / 2 + 0.025, depth / 2 - 0.025])
      p.box('ochre', w, 0.045, 0.05, 0, 0.055, z);
    for (let x = -w / 2; x < w / 2; x += 0.5) {
      const span = Math.min(0.5, w / 2 - x);
      p.box(
        'perforated',
        span - 0.02,
        0.025,
        depth - 0.12,
        x + span / 2,
        0.055,
        0,
      );
      p.box('metal', 0.025, 0.035, depth - 0.08, x + 0.015, 0.055, 0);
    }
    return;
  }
  const depth = o.depth;
  const z0 = 0;
  const y = 0.175;
  p.box('darkMetal', w, 0.07, depth, 0, y - 0.075, z0 + depth / 2);
  for (const x of [-w / 2 + 0.04, w / 2 - 0.04])
    p.box('metal', 0.08, 0.05, depth, x, y, z0 + depth / 2);
  for (const z of [z0 + 0.04, z0 + depth - 0.04])
    p.box('metal', w, 0.06, 0.08, 0, y, z);
  for (let x = -w / 2 + 1; x < w / 2 - 0.1; x += 1)
    p.box('metal', 0.04, 0.05, depth, x, y, z0 + depth / 2);
  for (let x = -w / 2 + 0.15; x < w / 2 - 0.1; x += 0.1)
    p.box('metal', 0.025, 0.04, depth - 0.12, x, y, z0 + depth / 2);
  for (let z = z0 + 0.2; z < z0 + depth - 0.1; z += 0.36)
    p.box('metal', w - 0.12, 0.035, 0.035, 0, y - 0.012, z);
}
