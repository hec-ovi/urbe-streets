import type { NativeArchitecture, NativeGround } from '../../architecture/native-schema.ts';
import type { Ring, Vec2 } from '../../geometry/schema.ts';
import type { StreetPlacement } from '../../schema/street-kit.ts';
import { bounds, intersection, rectangle } from '../../geometry/polygons.ts';
import { triangles } from '../surfaces/Regions.ts';
import { SurfaceBatch } from '../surfaces/SurfaceBatch.ts';
import { pieceGeometry } from './PieceConstruction.ts';
import type { AuthoredUnit } from './KitCatalogue.ts';
import { UnitFrame } from './Frame.ts';
import { placement } from './UnitOverlays.ts';
import { PAINT_METRES } from '../markings/Paint.ts';
import { clean } from './Frame.ts';

/** The widths of whole stripe tiles: Atlas crossing bars and approach stop lines. */
export const STRIPE_WIDTHS = [0.3, 0.5] as const;
export const stripeId = (width: number) => `overlay/stripe/${width}m`;

/** Surfaces a leftover field can take: both carriageway finishes sample world XZ, so a scaled prism shows no stretch. */
export const INFILL_SURFACES = ['asphalt', 'district-hex', 'concrete'] as const;
export type InfillSurface = typeof INFILL_SURFACES[number];

/** Right prisms fit any saved source field without clipping an instance. */
export function infillPieces(): AuthoredUnit[] {
  const footprint: Ring = [[0, 0], [2, 0], [0, 2]];
  const pieces: AuthoredUnit[] = [];
  for (const surface of INFILL_SURFACES) {
    // Leftover carriageway reads as patched asphalt where the binding carries it.
    const id = `infill/${surface}`, drawn = surface === 'asphalt' ? 'asphalt-patched' : surface;
    const batch = new SurfaceBatch({ ownerId: id, groundIds: [id], roadTop: 0, wear: () => 0 });
    batch.polygon(drawn, [footprint], 0.2, p => p);
    for (const [i, a] of footprint.entries()) {
      const b = footprint[(i + 1) % footprint.length]!;
      batch.face(drawn, [[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], 0.2, b[1]], [a[0], 0.2, a[1]]], [[0, 0], [2, 0], [2, 0.2], [0, 0.2]]);
    }
    pieces.push({ geometry: pieceGeometry(id, [batch.finish()]), metadata: { id, kind: 'segment', classes: ['street'], zone: 'shared',
      variant: 'infill', length: 2, origin: 'run-start-at-road', footprint: [footprint] } });
  }
  // One turn of the paint mask long, so tiles laid end to end continue it, and the mask
  // runs in paint metres both ways: a stripe of any length is tiles, never one stretched quad.
  for (const width of STRIPE_WIDTHS) {
    const id = stripeId(width), batch = new SurfaceBatch({ ownerId: id, groundIds: [id], roadTop: 0, wear: () => 0 });
    const stripe = rectangle(0, 0, PAINT_METRES, width);
    batch.polygon('whitePaint', [stripe], 0.006, ([x, z]) => [x / PAINT_METRES, 0.155 + z / PAINT_METRES], false);
    pieces.push({ geometry: pieceGeometry(id, [batch.finish()]), metadata: { id, kind: 'overlay', classes: [], zone: 'shared',
      variant: 'stripe', length: PAINT_METRES, origin: 'anchor-at-road', footprint: [stripe] } });
  }
  return pieces;
}

export function* sourceInfill(a: NativeArchitecture, remaining: (g: NativeGround) => Ring[],
  surface: (g: NativeGround, triangle: Ring) => InfillSurface): Generator<{ placement: StreetPlacement; ground: NativeGround }> {
  for (const owner of a.owners) for (const ground of owner.ground) {
    const rings = remaining(ground), box = bounds(rings.flat());
    const xs = [...new Set(rings.flat().map(p => p[0]))].sort((a, b) => a - b);
    // Vertical strips preserve the source's rectangular and 45 degree corners.
    const fitted = xs.slice(1).flatMap((x, i) => triangles(intersection(rings,
      [rectangle(xs[i]!, box.min[1], x - xs[i]!, box.max[1] - box.min[1])])));
    for (const tri of fitted) {
      const piece = `infill/${surface(ground, tri)}`;
      const place = (origin: Vec2, axis: Vec2, width: number, depth: number): StreetPlacement => {
        const built = placement(piece, new UnitFrame(origin, axis, ground.bottom), [owner.id]);
        // The two altitude halves share this exact origin; rounding it opens a seam.
        built.position = [origin[0], ground.bottom, origin[1]];
        built.scale = [width / 2, (ground.top - ground.bottom) / 0.2, depth / 2];
        return built;
      };
      const right = tri.findIndex((p, i) => {
        const q = tri[(i + 1) % 3]!, r = tri[(i + 2) % 3]!;
        return Math.abs((q[0] - p[0]) * (r[0] - p[0]) + (q[1] - p[1]) * (r[1] - p[1])) < 1e-8;
      });
      if (right >= 0) {
        const p = tri[right]!, q = tri[(right + 1) % 3]!, r = tri[(right + 2) % 3]!;
        const width = Math.hypot(q[0] - p[0], q[1] - p[1]), depth = Math.hypot(r[0] - p[0], r[1] - p[1]);
        yield { placement: place(p, [(q[0] - p[0]) / width, (q[1] - p[1]) / width], width, depth), ground };
        continue;
      }
      // The altitude to the longest side lies inside that side, giving two right triangles.
      let longest = 0;
      const length = (i: number) => Math.hypot(tri[(i + 1) % 3]![0] - tri[i]![0], tri[(i + 1) % 3]![1] - tri[i]![1]);
      for (let i = 1; i < 3; i++) if (length(i) > length(longest)) longest = i;
      const p = tri[longest]!, q = tri[(longest + 1) % 3]!, r = tri[(longest + 2) % 3]!, span = length(longest);
      const d: Vec2 = [(q[0] - p[0]) / span, (q[1] - p[1]) / span], n: Vec2 = [-d[1], d[0]];
      const along = (r[0] - p[0]) * d[0] + (r[1] - p[1]) * d[1];
      const height = (r[0] - p[0]) * n[0] + (r[1] - p[1]) * n[1];
      const foot: Vec2 = [p[0] + along * d[0], p[1] + along * d[1]];
      for (const [axis, width, depth] of [[n, height, along], [d, span - along, height]] as const) {
        if (width * depth < 1e-9) continue;
        yield { placement: place(foot, axis, width, depth), ground };
      }
    }
  }
}

/**
 * A painted rectangle from `origin` along `along` for `length` metres and across `across` for
 * `width`, as whole stripe tiles of the nearest width: as many as its length holds tiles near one
 * paint turn long, each scaled to an equal share, so the mask keeps its metre scale.
 */
export function stripeTiles(origin: Vec2, along: Vec2, length: number, across: Vec2, width: number): StreetPlacement[] {
  const nominal = STRIPE_WIDTHS.reduce((best, w) => Math.abs(w - width) < Math.abs(best - width) ? w : best);
  const count = Math.max(1, Math.round(length / PAINT_METRES)), step = length / count;
  // A tile's local Z is the frame's left of its X; an across pointing the other way starts the tile from the far edge.
  const left = across[0] * -along[1] + across[1] * along[0] > 0;
  const start: Vec2 = left ? origin : [origin[0] + across[0] * width, origin[1] + across[1] * width];
  const tiles: StreetPlacement[] = [];
  for (let i = 0; i < count; i++) {
    const p = placement(stripeId(nominal), new UnitFrame([start[0] + along[0] * step * i, start[1] + along[1] * step * i], along), ['roadway']);
    p.scale = [clean(step / PAINT_METRES), 1, clean(width / nominal)];
    tiles.push(p);
  }
  return tiles;
}

/** Atlas stripe polygons retain their exact authored stations. */
export function crossingPlacements(a: NativeArchitecture): StreetPlacement[] {
  const result = (a.markings ?? []).flatMap(ring => {
    const box = bounds(ring), dx = box.max[0] - box.min[0], dz = box.max[1] - box.min[1];
    return dx >= dz ? stripeTiles(box.min, [1, 0], dx, [0, 1], dz) : stripeTiles(box.min, [0, 1], dz, [1, 0], dx);
  });
  for (const approach of a.approaches) {
    const road = a.roads.find(r => r.id === approach.edgeId)!;
    const first = road.path[0]!, last = road.path.at(-1)!, length = Math.hypot(last[0] - first[0], last[1] - first[1]);
    const frame = new UnitFrame(first, [(last[0] - first[0]) / length, (last[1] - first[1]) / length]);
    const field = bounds(approach.field.map(frame.local));
    for (const lane of road.lanes.filter(l => (l.direction === 'forward' ? road.to : road.from) === approach.nodeId)) {
      const station = lane.direction === 'forward' ? field.min[0] - 1.3 : field.max[0] + 1;
      // A stop line runs across its lane, 0.3 m deep along the road.
      const n: Vec2 = [-frame.d[1], frame.d[0]];
      result.push(...stripeTiles(frame.world([station, lane.offset - lane.width / 2 + 0.05]), n, lane.width - 0.1, frame.d, 0.3));
    }
  }
  return result;
}
