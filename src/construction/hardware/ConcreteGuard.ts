import { Parts } from './Parts.ts';
import { castPrism } from './CastPrism.ts';
import type { FurnitureOptions } from './schema.ts';

export function concreteGuard(p: Parts, o: FurnitureOptions): void {
  const chips = o.damaged ? 6 : 3;
  let segment = 0;
  for (let start = -o.length / 2; start < o.length / 2; start += 2) {
    const width = Math.min(2, o.length / 2 - start) - 0.008,
      x = start + (width + 0.008) / 2,
      seed = o.style * 97 + segment++ * 13;
    if (o.style === 1) {
      p.add(
        'concrete',
        castPrism(
          [
            [0.48, 0.2],
            [1.07, 0.2],
            [1.07, 0.28],
            [1.05, 0.29],
            [1.05, 0.96],
            [0.99, 1.05],
            [0.56, 1.05],
            [0.5, 0.96],
            [0.5, 0.29],
            [0.48, 0.28],
          ],
          width,
          x,
          seed,
          chips,
        ),
      );
      continue;
    }
    p.add(
      'concrete',
      castPrism(
        [
          [0.5, 0.2],
          [1.15, 0.2],
          [1.1, 0.4],
          [0.96, 0.7],
          [0.94, 1.26],
          [0.71, 1.26],
          [0.69, 0.7],
          [0.55, 0.4],
        ],
        width,
        x,
        seed,
        chips,
      ),
    );
    p.add(
      'paintedConcrete',
      castPrism(
        [
          [0.533, 0.24],
          [0.558, 0.24],
          [0.71, 0.7],
          [0.73, 1.21],
          [0.704, 1.21],
          [0.684, 0.7],
        ],
        width - 0.15,
        x,
        seed + 1,
        0,
      ),
    );
    for (const [k, edge] of [-width / 2 + 0.07, width / 2 - 0.07].entries())
      p.add(
        'concrete',
        castPrism(
          [
            [0.52, 0.2],
            [1.1, 0.2],
            [1.1, 1.22],
            [1.07, 1.25],
            [0.55, 1.25],
            [0.52, 1.22],
          ],
          0.12,
          x + edge,
          seed + 2 + k,
          1,
        ),
      );
    p.box('darkMetal', width * 0.65, 0.2, 0.13, x, 1.07, 0.6);
    p.box('perforated', width * 0.57, 0.105, 0.014, x, 1.07, 0.528);
    for (const edge of [-0.45, 0.45])
      p.box('metal', 0.06, 0.18, 0.09, x + edge, 0.88, 0.61);
  }
}
