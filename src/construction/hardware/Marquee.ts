import { Faces, unit, type Point } from './Faces.ts';
import { Parts } from './Parts.ts';
import type { FurnitureOptions } from './schema.ts';

/** Both run parts are authored for the 0.5 m district gutter: Z 0 at its road edge, 0.5 at the curb face. */
export const marqueeDepth = 0.5;

/** The gutter crown under the run rises 6 cm to the curb; bodies sit 5 mm into it. */
const bottom = (z: number) => 0.12 * z - 0.005;
const SEAM = 0.005, RAIL = 0.035;
/** LED field: one inclined quad from the road-side rail to the curb-side rail. */
const FIELD = { z0: 0.165, z1: 0.395, y0: 0.115, y1: 0.172 };
const field = (z: number) => FIELD.y0 + (z - FIELD.z0) * (FIELD.y1 - FIELD.y0) / (FIELD.z1 - FIELD.z0);
/** Dark floor of the 1 cm seam between neighbouring frames, below the field and rails. */
const floor = (z: number) => 0.1 + (z - 0.135) * (0.158 - 0.1) / (0.43 - 0.135);
const X: Point = [1, 0, 0], UP: Point = [0, 1, 0], ROAD: Point = [0, 0, -1], CURB: Point = [0, 0, 1];
const at = (x: number, [z, y]: [number, number]): Point => [x, y, z];

/**
 * One run segment, centred on X: a stepped channel toward the road, an amber frame whose rails
 * stand 5 to 6 mm proud of the LED field, and a grey lip against the curb face. Frames stop 5 mm
 * short of each end, so neighbours show a 1 cm dark seam; channel steps, the riser under the seam
 * floor and the lip run the full length, so the seam is closed from the road.
 */
export function marqueeSegment(p: Parts, o: FurnitureOptions): void {
  const h = o.length / 2, e = h - SEAM, f = e - RAIL;
  const channel = new Faces();
  const profile: [number, number][] = [[0, bottom(0)], [0, 0.03], [0.065, 0.03], [0.065, 0.06], [0.135, 0.06], [0.135, floor(0.135)],
    [0.43, floor(0.43)], [0.43, bottom(0.43)]];
  for (const [a, b, outward] of [[0, 1, ROAD], [1, 2, UP], [2, 3, ROAD], [3, 4, UP], [4, 5, ROAD], [5, 6, UP]] as const)
    channel.polygon([at(-h, profile[a]!), at(h, profile[a]!), at(h, profile[b]!), at(-h, profile[b]!)], outward);
  for (const s of [-1, 1]) channel.shape(profile.map(q => at(s * h, q)), [], [s, 0, 0], [2, 1]);
  p.add('marquee-channel', channel.geometry());

  const frame = new Faces();
  const box = (x0: number, x1: number, z0: number, z1: number, y0: [number, number], y1: [number, number], sides: Point[]) => {
    const corner = (x: number, z: number, y: [number, number]) => [x, y[0] + (z - z0) / (z1 - z0) * (y[1] - y[0]), z] as Point;
    const faces: Record<string, [Point[], Point]> = {
      top: [[corner(x0, z0, y1), corner(x1, z0, y1), corner(x1, z1, y1), corner(x0, z1, y1)], UP],
      road: [[corner(x0, z0, y0), corner(x1, z0, y0), corner(x1, z0, y1), corner(x0, z0, y1)], ROAD],
      curb: [[corner(x0, z1, y0), corner(x1, z1, y0), corner(x1, z1, y1), corner(x0, z1, y1)], CURB],
      low: [[corner(x0, z0, y0), corner(x0, z1, y0), corner(x0, z1, y1), corner(x0, z0, y1)], [-1, 0, 0]],
      high: [[corner(x1, z0, y0), corner(x1, z1, y0), corner(x1, z1, y1), corner(x1, z0, y1)], X],
    };
    for (const side of sides) { const [points, outward] = Object.values(faces).find(([, n]) => n.every((v, i) => v === side[i]))!; frame.polygon(points, outward); }
  };
  box(-e, e, 0.13, FIELD.z0, [0.06, floor(FIELD.z0)], [0.12, 0.12], [UP, ROAD, CURB, [-1, 0, 0], X]);
  box(-e, e, FIELD.z1, 0.43, [floor(FIELD.z1), floor(0.43)], [0.178, 0.178], [UP, ROAD, [-1, 0, 0], X]);
  for (const s of [-1, 1]) {
    const [x0, x1] = s < 0 ? [-e, -f] : [f, e];
    // End rails keep the long rails' heights, 5 mm proud of the field at the road and 6 mm at the curb.
    box(x0, x1, FIELD.z0, FIELD.z1, [floor(FIELD.z0), floor(FIELD.z1)], [0.12, 0.178], [UP, [s, 0, 0]]);
    frame.polygon([[s * f, field(FIELD.z0), FIELD.z0], [s * f, 0.12, FIELD.z0], [s * f, 0.178, FIELD.z1], [s * f, field(FIELD.z1), FIELD.z1]], [-s, 0, 0]);
  }
  p.add('marquee-frame', frame.geometry());

  // UV in metres for the binding's LED matrix: u 0 to 2f from left to right seen from the road
  // (local +X to -X), v 0 to 0.23 from the road-side rail to the curb-side rail.
  const led = new Faces(), corners: Point[] = [[f, field(FIELD.z0), FIELD.z0], [-f, field(FIELD.z0), FIELD.z0], [-f, field(FIELD.z1), FIELD.z1], [f, field(FIELD.z1), FIELD.z1]];
  led.polygon(corners, UP, undefined, corners.map(([x, , z]) => [f - x, z - FIELD.z0]));
  p.add('marquee-led', led.geometry());

  const lip = new Faces(), top = 0.185;
  lip.polygon([[-h, top, 0.43], [h, top, 0.43], [h, top, 0.5], [-h, top, 0.5]], UP);
  lip.polygon([[-h, floor(0.43), 0.43], [h, floor(0.43), 0.43], [h, top, 0.43], [-h, top, 0.43]], ROAD);
  for (const s of [-1, 1]) lip.polygon([[s * h, bottom(0.43), 0.43], [s * h, bottom(0.5), 0.5], [s * h, top, 0.5], [s * h, top, 0.43]], [s, 0, 0]);
  p.add('marquee-lip', lip.geometry());
}

/** Cap styles: the start cap closes a run at local -X, the end cap at local +X. */
export const capSides = { start: 0, end: 1 } as const;

/**
 * Solid cap closing one end of a run, centred on X. Section from the road: a vertical face at
 * Z 0.065, a 1 cm round into an 18.4 degree slope that reaches the lip height at Z 0.44, a flat
 * top with a 1.25 cm round on its back edge, and the curb face behind. The outer curb-side
 * corner (local -X for style 0, the run's start; +X for style 1, its end) is cut at 45 degrees
 * in plan over the last 6 cm; the inner end stays square and flush with the first segment. Every
 * outer edge is rounded 1.2 cm by one smooth-shaded bevel. The two styles mirror each other in X.
 */
export function marqueeCap(p: Parts, o: FurnitureOptions): void {
  const w = o.length / 2, r = 0.012, cut = 0.44, top = 0.185, outside = o.style === capSides.end ? 1 : -1;
  const half = (s: number, z: number) => w - (s === outside ? Math.max(0, z - cut) : 0);
  const slope = Math.atan2(top - 0.06, cut - 0.065), t = 0.01 * Math.tan((Math.PI / 2 - slope) / 2), back = 0.0125;
  const q: [number, number][] = [[0.065, bottom(0.065)], [0.065, 0.06 - t], [0.065 + t * Math.cos(slope), 0.06 + t * Math.sin(slope)],
    [cut, top], [0.5 - back, top], [0.5, top - back]];
  const front = ROAD, incline = unit([0, Math.cos(slope), -Math.sin(slope)]), up = UP, rear = CURB;
  const faces = new Faces();
  const outer = (s: number, i: number) => at(s * (half(s, q[i]![0]) - r), q[i]!);
  const sweep: [number, number, Point, Point][] = [[0, 1, front, front], [1, 2, front, incline], [2, 3, incline, incline], [3, 4, up, up], [4, 5, up, rear]];
  for (const [a, b, na, nb] of sweep) faces.polygon([outer(-1, a), outer(1, a), outer(1, b), outer(-1, b)], unit([0, na[1] + nb[1], na[2] + nb[2]]),
    na === nb ? undefined : [na, na, nb, nb]);

  // Bevel ring to the end faces, inset by r from the outline in the section plane.
  const lean = Math.tan(slope), offset: [number, number] = [0.065 + r * Math.sin(slope), 0.06 - r * Math.cos(slope)];
  const onSlope = (y: number) => offset[0] + (y - offset[1]) / lean;
  const inner: Record<string, [number, number]> = {
    base: [0.065 + r, bottom(0.065 + r)], front: [0.065 + r, offset[1] + (0.065 + r - offset[0]) * lean],
    ridge: [onSlope(top - r), top - r], back: [0.5 - r, top - r], curb: [0.5, top - r], foot: [0.5, bottom(0.5)], fold: [cut, bottom(cut)],
  };
  for (const s of [-1, 1]) {
    const I = (k: string) => at(s * half(s, inner[k]![0]), inner[k]!), O = (i: number) => outer(s, i), corner = s === outside;
    const end: Point = [s, 0, 0], diagonal = corner ? unit([s, 0, 1]) : end, crease = corner ? unit([s + diagonal[0], 0, diagonal[2]]) : end;
    const ring: [Point[], Point[]][] = [
      [[O(0), O(1), I('front'), I('base')], [front, front, end, end]],
      [[O(1), O(2), I('front')], [front, incline, end]],
      [[O(2), O(3), I('ridge'), I('front')], [incline, incline, crease, end]],
      [[O(3), O(4), I('back'), I('ridge')], [up, up, diagonal, crease]],
      [[O(4), O(5), I('curb'), I('back')], [up, rear, diagonal, diagonal]],
    ];
    for (const [points, normals] of ring) faces.polygon(points, unit(normals.reduce((a, n) => [a[0] + n[0], a[1] + n[1], a[2] + n[2]], [0, 0, 0] as Point)), normals);
    if (corner) {
      faces.polygon([I('base'), I('front'), I('ridge'), I('fold')], end);
      faces.polygon([I('fold'), I('ridge'), I('back'), I('curb'), I('foot')], diagonal);
    } else faces.polygon([I('base'), I('front'), I('ridge'), I('back'), I('curb'), I('foot')], end);
  }
  p.add('marquee-cap', faces.geometry());
}
