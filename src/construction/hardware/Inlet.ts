import { Faces, type Point } from './Faces.ts';
import { Parts } from './Parts.ts';
import type { FurnitureMaterials, FurnitureOptions } from './schema.ts';

/**
 * Curb inlet as one steel unit. Local Z 0..0.3 is the gutter and 0.3..0.5 the curb band;
 * Y 0 is the road, -0.02 the gutter floor and 0.2 the curb top.
 */
export function inlet(p: Parts, o: FurnitureOptions): void {
  if (o.depth > 0.5 + 1e-9) { districtInlet(p, o); return; }
  const half = o.length / 2;
  const gutter = o.depth - 0.2;
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
    back = gutter - 0.03,
    plate = [-0.048, -0.028] as const;
  block('metal', [-half, half], [-0.06, -0.02], [0, front]);
  for (const side of [-1, 1])
    block('metal', [side * grate, side * half], [-0.06, -0.02], [front, back]);
  block('metal', [-half, half], [-0.06, 0.02], [back, gutter]);

  // Grate plate: solid borders and a centre rib around two rows of 3 cm slots.
  const rows: [number, number][] = [
    [front + 0.025, gutter / 2],
    [gutter / 2 + 0.02, back - 0.025],
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
  block('darkMetal', [-half, half], [-0.06, 0.02], [gutter, o.depth]);
  for (const side of [-1, 1])
    block('metal', [side * cheek, side * half], [0.02, 0.2], [gutter, o.depth]);
  block('metal', [-cheek, cheek], [0.13, 0.2], [gutter, o.depth]);
  block('darkMetal', [-cheek, cheek], [0.02, 0.13], [o.depth - 0.03, o.depth]);
  for (let x = -cheek + 0.16; x < cheek - 0.05; x += 0.16)
    block('metal', [x - 0.015, x + 0.015], [0.02, 0.13], [gutter, gutter + 0.03]);
}

/**
 * District drain station, one model per station. The source pit stays below the gutter; on top a
 * flush cast grate follows the 6 cm gutter crown (dark frame, metal bars around 3 x 5 rounded slots
 * over a dark liner) and a pale concrete insert replaces the curb over 1.6 m, reaching 10 cm into
 * the gutter with four triangular throats facing the road.
 */
function districtInlet(p: Parts, o: FurnitureOptions): void {
  const half = o.length / 2, gutter = o.depth - 0.2, crown = (z: number) => 0.06 * z / gutter;
  const block = (material: keyof FurnitureMaterials, [x0, x1]: readonly [number, number], [y0, y1]: readonly [number, number], [z0, z1]: readonly [number, number]) =>
    p.box(material, Math.abs(x1 - x0), y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const pit = half - 0.05, front = 0.05, back = gutter - 0.03, plate = -0.048;
  block('darkMetal', [-pit, pit], [-0.2, -0.19], [front, back]);
  for (const z of [[front, front + 0.01], [back - 0.01, back]] as const) block('darkMetal', [-pit, pit], [-0.19, plate], z);
  for (const side of [-1, 1]) block('darkMetal', [side * pit, side * (pit - 0.01)], [-0.19, plate], [front, back]);

  const UP: Point = [0, 1, 0], ROAD: Point = [0, 0, -1], CURB: Point = [0, 0, 1];
  const dark = new Faces(), bars = new Faces(), concrete = new Faces();
  // Grate 1.5 x 0.32 m against the insert; frame band 3 cm, heights above the crown in metres.
  const grate = { x: 0.75, z0: gutter - 0.42, z1: gutter - 0.1, band: 0.03 }, lift = { liner: 0.0015, bars: 0.005, frame: 0.009, embed: -0.004 };
  const rect = (x: number, z0: number, z1: number, dy: number): Point[] => [[-x, crown(z0) + dy, z0], [x, crown(z0) + dy, z0], [x, crown(z1) + dy, z1], [-x, crown(z1) + dy, z1]];
  const onCrown = (dy: number) => ([x, z]: [number, number]): Point => [x, crown(z) + dy, z];
  const inner = { x: grate.x - grate.band, z0: grate.z0 + grate.band, z1: grate.z1 - grate.band };
  dark.shape(rect(grate.x, grate.z0, grate.z1, lift.frame), [rect(inner.x, inner.z0, inner.z1, lift.frame)], UP, [0, 2]);
  const wall = (a: Point, b: Point, y0: number, y1: number, outward: Point) =>
    dark.polygon([[a[0], a[1] + y0, a[2]], [b[0], b[1] + y0, b[2]], [b[0], b[1] + y1, b[2]], [a[0], a[1] + y1, a[2]]], outward);
  const base = (x: number, z: number): Point => [x, crown(z), z];
  wall(base(-grate.x, grate.z0), base(grate.x, grate.z0), lift.embed, lift.frame, ROAD);
  for (const s of [-1, 1]) wall(base(s * grate.x, grate.z0), base(s * grate.x, grate.z1), lift.embed, lift.frame, [s, 0, 0]);
  wall(base(-inner.x, inner.z0), base(inner.x, inner.z0), lift.bars, lift.frame, CURB);
  wall(base(-inner.x, inner.z1), base(inner.x, inner.z1), lift.bars, lift.frame, ROAD);
  for (const s of [-1, 1]) wall(base(s * inner.x, inner.z0), base(s * inner.x, inner.z1), lift.bars, lift.frame, [-s, 0, 0]);
  dark.polygon(rect(inner.x, inner.z0, inner.z1, lift.liner), UP);
  // Five slots along the curb in three rows, 0.22 x 0.05 m with round ends.
  const slot = { length: 0.22, width: 0.05, columns: 5, rows: 3 };
  const gapX = (2 * inner.x - slot.columns * slot.length) / (slot.columns + 1), gapZ = (inner.z1 - inner.z0 - slot.rows * slot.width) / (slot.rows + 1);
  const holes: [number, number][][] = [];
  for (let row = 0; row < slot.rows; row++) for (let column = 0; column < slot.columns; column++) {
    const x = -inner.x + gapX + slot.length / 2 + column * (slot.length + gapX), z = inner.z0 + gapZ + slot.width / 2 + row * (slot.width + gapZ);
    const radius = slot.width / 2, reach = slot.length / 2 - radius, hole: [number, number][] = [];
    for (const end of [1, -1]) for (let k = 0; k <= 3; k++) {
      const angle = (end < 0 ? Math.PI : 0) + (Math.PI / 3) * k - Math.PI / 2;
      hole.push([x + end * reach + radius * Math.cos(angle), z + radius * Math.sin(angle)]);
    }
    holes.push(hole);
  }
  const contour: [number, number][] = [[-inner.x, inner.z0], [inner.x, inner.z0], [inner.x, inner.z1], [-inner.x, inner.z1]];
  bars.shape(contour.map(onCrown(lift.bars)), holes.map(h => h.map(onCrown(lift.bars))), UP, [0, 2]);

  // Curb insert: vertical face into a 45 degree chamfer, top 5 mm over the curb, ends down to the gutter.
  const insert = { x: 0.8, z0: grate.z1, z1: o.depth + 0.005, face: 0.17, top: 0.205, back: 0.195 };
  const chamfer = insert.z0 + insert.top - insert.face, low = crown(insert.z0) + lift.embed;
  const throat = { half: 0.1, base: 0.062, height: 0.09, depth: gutter - 0.01, centres: [-0.54, -0.18, 0.18, 0.54] };
  const opening = (x: number, z: number): [Point, Point, Point] => [[x - throat.half, throat.base, z], [x + throat.half, throat.base, z], [x, throat.base + throat.height, z]];
  concrete.shape([[-insert.x, low, insert.z0], [insert.x, low, insert.z0], [insert.x, insert.face, insert.z0], [-insert.x, insert.face, insert.z0]],
    throat.centres.map(x => opening(x, insert.z0)), ROAD, [0, 1]);
  concrete.polygon([[-insert.x, insert.face, insert.z0], [insert.x, insert.face, insert.z0], [insert.x, insert.top, chamfer], [-insert.x, insert.top, chamfer]], [0, 1, -1]);
  concrete.polygon([[-insert.x, insert.top, chamfer], [insert.x, insert.top, chamfer], [insert.x, insert.top, insert.z1], [-insert.x, insert.top, insert.z1]], UP);
  concrete.polygon([[-insert.x, insert.back, insert.z1], [insert.x, insert.back, insert.z1], [insert.x, insert.top, insert.z1], [-insert.x, insert.top, insert.z1]], CURB);
  for (const s of [-1, 1]) concrete.shape(([[insert.z0, low], [insert.z0, insert.face], [chamfer, insert.top], [insert.z1, insert.top], [insert.z1, insert.back],
    [gutter, insert.back], [gutter, crown(gutter) + lift.embed]] as [number, number][]).map(([z, y]) => [s * insert.x, y, z] as Point), [], [s, 0, 0], [2, 1]);
  for (const x of throat.centres) {
    const [a, b, c] = opening(x, insert.z0), [d, e, f] = opening(x, throat.depth);
    concrete.polygon([a, b, e, d], UP);
    concrete.polygon([a, d, f, c], [1, -0.3, 0]);
    concrete.polygon([b, c, f, e], [-1, -0.3, 0]);
    dark.polygon([d, e, f], ROAD);
  }
  p.add('darkMetal', dark.geometry());
  p.add('metal', bars.geometry());
  p.add('concrete', concrete.geometry());
}
