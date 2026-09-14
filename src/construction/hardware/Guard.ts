import { Parts } from './Parts.ts';
import { tube } from './Tube.ts';
import { concreteGuard } from './ConcreteGuard.ts';
import { industrialGuard } from './IndustrialGuard.ts';
import { portableGuard } from './PortableGuard.ts';
import type { FurnitureOptions } from './schema.ts';

export function guard(p: Parts, o: FurnitureOptions): void {
  if (o.style === 1 || o.style === 5) return concreteGuard(p, o);
  if (o.style === 2) return industrialGuard(p, o);
  if (o.style === 4) return portableGuard(p, o);
  if (o.style === 3) {
    for (const x of [-o.length / 2 + 0.2, o.length / 2 - 0.2]) {
      p.beam('ochre', [x, 0.2, 0.72], [x, 0.26, 0.72], 0.17);
      p.beam('darkMetal', [x, 0.26, 0.72], [x, 1.16, 0.72], 0.1);
      p.beam('ochre', [x, 1, 0.72], [x, 1.13, 0.72], 0.105);
      p.beam('darkMetal', [x, 1.13, 0.72], [x, 1.19, 0.72], 0.115);
    }
    return;
  }
  const material = 'green';
  const half = o.length / 2 - 0.045,
    low = 0.45,
    high = 1.15,
    bend = 0.13;
  const points: number[][] = [];
  const corners: [number, number, number][] = [
    [half - bend, high - bend, 0],
    [-half + bend, high - bend, 90],
    [-half + bend, low + bend, 180],
    [half - bend, low + bend, 270],
  ];
  for (const [x, y, degrees] of corners)
    for (let step = 0; step <= 4; step++) {
      const angle = ((degrees + step * 22.5) * Math.PI) / 180;
      points.push([
        x + Math.cos(angle) * bend,
        y + Math.sin(angle) * bend,
        0.72,
      ]);
    }
  p.add(material, tube(points, 0.04, true));
  for (const x of [-half + 0.32, half - 0.32]) {
    p.box('darkMetal', 0.23, 0.03, 0.24, x, 0.215, 0.72);
    p.box(material, 0.07, 0.9, 0.075, x, 0.68, 0.72);
    for (const y of [low, high]) p.box(material, 0.13, 0.11, 0.11, x, y, 0.72);
    for (const dx of [-0.075, 0.075])
      p.box('metal', 0.035, 0.012, 0.035, x + dx, 0.236, 0.78);
  }
}
