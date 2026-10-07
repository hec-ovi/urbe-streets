import type { NativeArchitecture } from '../../architecture/native-schema.ts';
import type { Ring, Vec2 } from '../../geometry/schema.ts';
import type { StreetPlacement, StreetProfile } from '../../schema/street-kit.ts';
import { area, bounds, difference, intersection, rectangle, totalArea } from '../../geometry/polygons.ts';
import { BoxIndex } from '../../geometry/BoxIndex.ts';
import { clean, UnitFrame } from './Frame.ts';
import { coreId } from './ParkingScene.ts';
import { placement } from './UnitOverlays.ts';
import { KitCatalogue } from './KitCatalogue.ts';

/**
 * The ground beneath elevated highways: each structure's centreline, from ramp foot to ramp foot, swept
 * across its deck width. Everything there is the deck's court; beyond a ramp foot the highway runs at grade.
 */
export class Decks {
  readonly footprint: Ring[] = [];
  private readonly index = new BoxIndex<Ring>();

  constructor(a: NativeArchitecture) {
    for (const deck of a.decks ?? []) for (let i = 1; i < deck.path.length; i++) {
      const p = deck.path[i - 1]!, q = deck.path[i]!, length = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (length < 1e-9) continue;
      const frame = new UnitFrame(p, [(q[0] - p[0]) / length, (q[1] - p[1]) / length]);
      const ring = rectangle(0, -deck.width / 2, length, deck.width).map(frame.world);
      this.footprint.push(ring); this.index.add(ring, bounds(ring));
    }
  }

  /** The area of `rings` beneath a deck. */
  beneath(rings: Ring[]): number {
    return rings.length ? totalArea(intersection(rings, this.index.near(bounds(rings.flat())))) : 0;
  }

  /** Whether a point lies inside a deck's footprint: its millimetre neighbourhood is beneath a deck, path vertices included. */
  covers(p: Vec2): boolean { return this.beneath([rectangle(p[0] - 0.001, p[1] - 0.001, 0.002, 0.002)]) > 0.002 ** 2 - 1e-12; }

  /** Rings parted at the deck edges: the part beneath a deck and the part beyond it, each nonempty. */
  split(rings: Ring[]): Ring[][] {
    const near = rings.length ? this.index.near(bounds(rings.flat())) : [];
    if (!near.length || this.beneath(rings) < 1e-9) return [rings];
    return [intersection(rings, near), difference(rings, near)].filter(part => totalArea(part) > 1e-9);
  }

  /** Whether a triangle lies mostly beneath a deck. */
  holds(triangle: Ring): boolean { return this.beneath([triangle]) > Math.abs(area(triangle)) / 2; }

  /** The merged stations of a frame's X axis between 0 and `length` that lie beneath a deck. */
  spans(frame: UnitFrame, length: number): [number, number][] {
    const a = frame.world([0, 0]), b = frame.world([length, 0]);
    const found: [number, number][] = [];
    for (const ring of this.index.near(bounds([a, b]))) {
      // Cyrus-Beck against the convex, counter clockwise deck rectangle; a line along its edge stays outside.
      let enter = 0, exit = 1, inside = true;
      for (const [i, p] of ring.entries()) {
        const q = ring[(i + 1) % ring.length]!, n: Vec2 = [q[1] - p[1], -(q[0] - p[0])];
        const scale = Math.hypot(n[0], n[1]), offset = (n[0] * (a[0] - p[0]) + n[1] * (a[1] - p[1])) / scale;
        const rate = (n[0] * (b[0] - a[0]) + n[1] * (b[1] - a[1])) / scale;
        if (Math.abs(rate) < 1e-12) { if (offset > -1e-7) { inside = false; break; } continue; }
        const t = -offset / rate;
        if (rate < 0) enter = Math.max(enter, t); else exit = Math.min(exit, t);
      }
      if (!inside) continue;
      if (exit * length - enter * length > 1e-7) found.push([clean(enter * length), clean(exit * length)]);
    }
    found.sort((x, y) => x[0] - y[0]);
    const merged: [number, number][] = [];
    for (const span of found) {
      const last = merged.at(-1);
      if (last && span[0] <= last[1] + 1e-7) last[1] = Math.max(last[1], span[1]); else merged.push([...span]);
    }
    return merged;
  }

  /**
   * A highway's grade corridor from `from` to `to` along a frame: the court beneath its deck in 8 m units while
   * whole, then 2 m, and an unpainted road core of the same width at grade beyond a ramp foot in 2 m units, since
   * the delegated highway lanes carry their own paint. Each stretch ends in one fraction scaled along X.
   */
  corridor(frame: UnitFrame, from: number, to: number, base: StreetProfile, ownerIds = ['roadway']): StreetPlacement[] {
    const covered = this.spans(new UnitFrame(frame.world([from, 0]), frame.d, frame.position[1]), clean(to - from)).map(([s, e]): [number, number] => [s + from, e + from]);
    const cuts = [...new Set([from, to, ...covered.flat()].map(clean))].filter(s => s >= from && s <= to).sort((x, y) => x - y);
    const out: StreetPlacement[] = [];
    for (let i = 1; i < cuts.length; i++) {
      const start = cuts[i - 1]!, end = cuts[i]!, middle = (start + end) / 2;
      const court = covered.some(([s, e]) => middle > s && middle < e);
      for (let station = start; end - station > 1e-7;) {
        const remaining = clean(end - station), length = court && remaining >= 8 - 1e-7 ? 8 : 2;
        const p = placement(court ? KitCatalogue.under(base, length) : coreId(base, true), new UnitFrame(frame.world([station, 0]), frame.d, frame.position[1]), ownerIds);
        if (remaining < length - 1e-7) p.scale = [remaining / 2, 1, 1];
        out.push(p); station = clean(station + Math.min(length, remaining));
      }
    }
    return out;
  }
}
