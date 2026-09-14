import type { Ring, Vec2 } from '../../geometry/schema.ts';
import { area, difference, inset, intersection } from './Regions.ts';
import { add, sub, scale, distance } from './Frame.ts';
import type { CornerCut } from './CornerCuts.ts';
import { SurfaceBatch } from './SurfaceBatch.ts';
const gap = 0.003, strip = 0.2, step = 2, span = 1.5;
const wound = (ring: Ring): Ring => area(ring) < 0 ? [...ring].reverse() : ring;
const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** Original corner fan, depth cuts and accent strips over the retained paving domain. */
export class CornerPaving {
  readonly planned: Ring[] = [];
  panels = 0;
  private readonly batch: SurfaceBatch;
  private readonly domain: readonly Ring[];
  private readonly top: number;
  constructor(batch: SurfaceBatch, domain: readonly Ring[], top: number) { this.batch = batch; this.domain = domain; this.top = top; }
  build(cuts: CornerCut[], panel: string, accent: string): void {
    for (const { corner, hub, feet } of cuts) {
      const edge = [feet[0], ...corner.arc, feet[1]];
      const strips = [this.strip(hub, feet[0], corner.arc[1]!, accent), this.strip(hub, feet[1], corner.arc[corner.arc.length - 2]!, accent)];
      this.fan(hub, edge, panel, strips);
    }
  }
  private strip(hub: Vec2, foot: Vec2, inside: Vec2, material: string): Ring {
    const length = distance(hub, foot), out = scale(sub(foot, hub), 1 / length), across: Vec2 = [-out[1], out[0]];
    const toward = (inside[0] - foot[0]) * across[0] + (inside[1] - foot[1]) * across[1] > 0 ? 1 : -1;
    const shift = scale(across, strip * toward), reach = Math.ceil(length + 1);
    const band = (from: number, to: number): Ring => { const a = add(hub, scale(out, from)), b = add(hub, scale(out, to)); return wound([a, b, add(b, shift), add(a, shift)]); };
    for (let m = 0; m < reach; m++) {
      const piece = band(m, m + 1); this.planned.push(piece);
      this.lay(material, inset(piece, gap), [], p => [clamp((p[0] - hub[0]) * out[0] + (p[1] - hub[1]) * out[1] - m),
        clamp(((p[0] - hub[0]) * across[0] + (p[1] - hub[1]) * across[1]) * toward / strip)]);
    }
    return band(0, reach);
  }
  private fan(hub: Vec2, edge: Vec2[], material: string, holes: Ring[]): void {
    const lengths = edge.slice(1).map((p, i) => distance(edge[i]!, p)), total = lengths.reduce((a, b) => a + b, 0), count = Math.max(1, Math.round(total / span));
    const rays = Array.from({ length: count + 1 }, (_, k) => {
      let s = total * k / count, i = 0;
      while (i < lengths.length - 1 && s > lengths[i]!) s -= lengths[i++]!;
      const t = lengths[i] ? Math.min(1, s / lengths[i]!) : 0, p = add(edge[i]!, scale(sub(edge[i + 1]!, edge[i]!), t)), reach = distance(hub, p);
      return { d: scale(sub(p, hub), 1 / reach), curb: reach - 0.5 };
    });
    type Ray = typeof rays[number];
    const at = (ray: Ray, radius: number) => add(hub, scale(ray.d, Math.max(0, radius)));
    for (let k = 0; k < count; k++) {
      const a = rays[k]!, b = rays[k + 1]!;
      for (let j = 0; Math.max(a.curb, b.curb) - j * step > 0; j++) {
        const outer = (ray: Ray) => ray.curb - j * step + (j ? 0 : 2.5), inner = (ray: Ray) => ray.curb - (j + 1) * step;
        const raw = [at(a, inner(a)), at(a, outer(a)), at(b, outer(b)), at(b, inner(b))];
        const piece = raw.filter((p, i) => distance(p, raw[(i + 1) % raw.length]!) > 1e-7);
        if (piece.length < 3) continue;
        const intended = wound(piece); this.planned.push(...difference([intended], holes));
        this.lay(material, inset(intended, gap), holes, p => {
          const v = sub(p, hub), side = (d: Vec2) => v[0] * d[1] - v[1] * d[0];
          const u = side(a.d) / (side(a.d) - side(b.d) || 1), depth = a.curb + (b.curb - a.curb) * u - distance(p, hub);
          return [clamp(u), clamp(depth / step - j)];
        });
      }
    }
  }
  private lay(surface: string, piece: Ring, holes: readonly Ring[], uv: (point: Vec2) => Vec2): void {
    if (piece.length < 3) return;
    const fragments = difference(intersection(this.domain, [piece]), holes);
    if (!fragments.length) return;
    this.batch.polygon(surface, fragments, this.top, uv); this.panels++;
  }
}
