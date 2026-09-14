import { Parts } from './Parts.ts';
import { tube } from './Tube.ts';
import type { FurnitureOptions } from './schema.ts';

export function portableGuard(p: Parts, o: FurnitureOptions): void {
  const half = o.length / 2 - 0.07,
    radius = 0.028,
    plane = 0.75,
    // Each post ends at the crown of its foot, so the joint is centred.
    crown = 0.36,
    ground = 0.2 + radius - 0.005;
  const path = [
    [-half, crown, plane],
    [-half, 1.22, plane],
    [-half + 0.1, 1.32, plane],
    [half - 0.1, 1.32, plane],
    [half, 1.22, plane],
    [half, crown, plane],
  ];
  p.add('ochre', tube(path, radius));
  p.beam('ochre', [-half, 0.42, plane], [half, 0.42, plane], 0.025);
  for (let x = -half + 0.25; x < half - 0.1; x += 0.28)
    p.beam('ochre', [x, 0.43, plane], [x, 1.29, plane], 0.013);
  for (const x of [-half, half])
    p.add(
      'ochre',
      tube(
        Array.from({ length: 13 }, (_, k) => {
          const t = (k / 12) * Math.PI;
          return [
            x,
            ground + (crown - ground) * Math.sin(t),
            plane + 0.3 * Math.cos(t),
          ];
        }),
        radius,
      ),
    );
  p.box('ochre', o.length - 0.15, 0.26, 0.05, 0, 0.8, 0.7);
  for (let x = -half + 0.2; x < half - 0.1; x += 0.55)
    p.box('darkMetal', 0.26, 0.26, 0.008, x, 0.8, 0.67);
  for (const x of [-half + 0.12, half - 0.12])
    for (const y of [0.7, 0.9]) p.box('metal', 0.02, 0.02, 0.012, x, y, 0.663);
}
