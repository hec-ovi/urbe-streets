import { Parts } from './Parts.ts';
import type { FurnitureMaterials, FurnitureOptions } from './schema.ts';

/**
 * Curb inlet as one steel unit. Local Z 0..0.3 is the gutter and 0.3..0.5 the curb band;
 * Y 0 is the road, -0.02 the gutter floor and 0.2 the curb top.
 */
export function inlet(p: Parts, o: FurnitureOptions): void {
  const half = o.length / 2;
  const block = (
    material: keyof FurnitureMaterials,
    [x0, x1]: readonly [number, number],
    [y0, y1]: readonly [number, number],
    [z0, z1]: readonly [number, number],
  ) =>
    p.box(
      material,
      Math.abs(x1 - x0),
      y1 - y0,
      z1 - z0,
      (x0 + x1) / 2,
      (y0 + y1) / 2,
      (z0 + z1) / 2,
    );

  // Pan frame flush with the gutter floor; its sill rises to the ledge in front of the mouth.
  const grate = half - 0.05,
    front = 0.05,
    back = 0.27,
    plate = [-0.048, -0.028] as const;
  block('metal', [-half, half], [-0.06, -0.02], [0, front]);
  for (const side of [-1, 1])
    block('metal', [side * grate, side * half], [-0.06, -0.02], [front, back]);
  block('metal', [-half, half], [-0.06, 0.02], [back, 0.3]);

  // Grate plate: solid borders and a centre rib around two rows of 3 cm slots.
  const rows: [number, number][] = [
    [front + 0.025, 0.15],
    [0.17, back - 0.025],
  ];
  for (const z of [
    [front, rows[0]![0]],
    [rows[0]![1], rows[1]![0]],
    [rows[1]![1], back],
  ] as const)
    block('metal', [-grate, grate], plate, z);
  const pitch = 0.065,
    slot = 0.03,
    count = Math.floor((2 * grate - 0.08) / pitch);
  const edges = [-grate];
  for (let i = 0; i < count; i++) {
    const center = (i - (count - 1) / 2) * pitch;
    edges.push(center - slot / 2, center + slot / 2);
  }
  edges.push(grate);
  for (const z of rows)
    for (let i = 0; i < edges.length; i += 2)
      block('metal', [edges[i]!, edges[i + 1]!], plate, z);

  // Closed pit below the slots.
  block('darkMetal', [-grate, grate], [-0.2, -0.19], [front, back]);
  for (const z of [
    [front, front + 0.01],
    [back - 0.01, back],
  ] as const)
    block('darkMetal', [-grate, grate], [-0.19, plate[0]], z);
  for (const side of [-1, 1])
    block('darkMetal', [side * grate, side * (grate - 0.01)], [-0.19, plate[0]], [front, back]);

  // Housing in the curb band: cheeks, lintel and a barred mouth over a dark cavity.
  const cheek = half - 0.1;
  block('darkMetal', [-half, half], [-0.06, 0.02], [0.3, 0.5]);
  for (const side of [-1, 1])
    block('metal', [side * cheek, side * half], [0.02, 0.2], [0.3, 0.5]);
  block('metal', [-cheek, cheek], [0.13, 0.2], [0.3, 0.5]);
  block('darkMetal', [-cheek, cheek], [0.02, 0.13], [0.47, 0.5]);
  for (let x = -cheek + 0.16; x < cheek - 0.05; x += 0.16)
    block('metal', [x - 0.015, x + 0.015], [0.02, 0.13], [0.3, 0.33]);
}
