import { Parts } from './Parts.ts';
import { prism } from './Prism.ts';
import type { FurnitureOptions } from './schema.ts';

export function industrialGuard(p: Parts, o: FurnitureOptions): void {
  const half = o.length / 2 - 0.04;
  p.add(
    'ochre',
    prism(
      [
        [-half, 0.2],
        [-half + 0.15, 0.2],
        [-half + 0.15, 0.98],
        [-half + 0.35, 1.16],
        [half - 0.35, 1.16],
        [half - 0.15, 0.98],
        [half - 0.15, 0.2],
        [half, 0.2],
        [half, 1.04],
        [half - 0.3, 1.3],
        [-half + 0.3, 1.3],
        [-half, 1.04],
      ],
      0.18,
      'z',
      0.74,
    ),
  );
  p.box('metal', o.length - 0.75, 0.045, 0.025, 0, 1.215, 0.638);
  if (o.length >= 3) p.box('ochre', 0.13, 0.99, 0.18, 0, 0.695, 0.74);
  for (const sign of [-1, 1]) {
    const x = sign * (half - 0.075);
    p.box('darkMetal', 0.18, 0.035, 0.27, x, 0.218, 0.74);
    p.add(
      'ochre',
      prism(
        [
          [sign * (half - 0.5), 1.16],
          [sign * (half - 0.15), 1.16],
          [sign * (half - 0.15), 0.76],
        ],
        0.2,
        'z',
        0.74,
      ),
    );
    for (const y of [0.27, 0.94, 1.1])
      p.box('metal', 0.028, 0.028, 0.016, x, y, 0.637);
  }
}
