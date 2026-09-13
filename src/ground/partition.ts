import { invariant, unsatisfiable } from '../errors.ts';
import { bounds, difference, intersection, intersects, totalArea, union } from '../geometry/polygons.ts';
import type { Architecture } from '../architecture/schema.ts';
import type { GroundOwner, StreetManifest } from '../schema/result.ts';

/** Full physical prisms retain one owner. Vertically stacked parts keep separate roles. */
export function buildGround(a: Architecture): StreetManifest['ground'] {
  const owners: GroundOwner[] = a.surfaces.filter(s => s.role !== 'marking').map(s => ({
    id: s.id, sourceIds: s.sourceIds, role: s.role === 'panel' ? 'paved' : s.role === 'guardrail' ? 'support' : s.role as GroundOwner['role'],
    ring: s.polygon, bottom: s.bottom, top: s.top,
  }));
  const buckets = new Map<string, number[]>(), boxes = owners.map(o => bounds(o.ring));
  owners.forEach((owner, i) => {
    const box = boxes[i]!, seen = new Set<number>();
    for (let x = Math.floor(box.min[0] / 8); x < Math.ceil(box.max[0] / 8); x++)
      for (let z = Math.floor(box.min[1] / 8); z < Math.ceil(box.max[1] / 8); z++) {
        const key = `${x}:${z}`, previous = buckets.get(key) ?? [];
        for (const j of previous) {
          if (seen.has(j)) continue;
          seen.add(j);
          const other = owners[j]!;
          if (Math.max(owner.bottom, other.bottom) >= Math.min(owner.top, other.top) || !intersects(box, boxes[j]!)) continue;
          if (totalArea(intersection([owner.ring], [other.ring])) > 1e-8) throw invariant('Constructed solids overlap', { ownerIds: [other.id, owner.id], sourceIds: [...other.sourceIds, ...owner.sourceIds] });
        }
        previous.push(i); buckets.set(key, previous);
      }
  });
  const cover = union(owners.filter(o => o.role !== 'support').map(o => o.ring)), reserved = union(a.reserved);
  const missing = totalArea(difference(reserved, cover)), escaped = totalArea(difference(cover, reserved));
  if (missing > 1e-7 || escaped > 1e-7) throw invariant('Physical construction does not cover its planning land', { missingArea: missing, escapedArea: escaped });
  const physical = union(owners.map(o => o.ring));
  if (totalArea(difference(physical, reserved)) > 1e-7) throw unsatisfiable('Hardware escapes street land');
  const blocked = totalArea(intersection(physical, a.exclusions));
  if (blocked > 1e-7) throw unsatisfiable('Street construction enters excluded parcel land', { area: blocked });
  return { owners, cover: { reservedArea: totalArea(reserved), coveredArea: totalArea(cover), difference: missing + escaped } };
}
