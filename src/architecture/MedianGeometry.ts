import { difference, totalArea } from '../geometry/polygons.ts';
import type { Ring, Vec2 } from '../geometry/schema.ts';
import type { NativeMedian, NativeOwner, NativeRoad } from './native-schema.ts';
import { bad } from './values.ts';

/** The declared island occupies its road stations and the same land as its physical owner. */
export function validateMedianGeometry(median: NativeMedian, owner: NativeOwner, road: NativeRoad): void {
  const origin = road.path[0]!, end = road.path.at(-1)!;
  const length = Math.hypot(end[0] - origin[0], end[1] - origin[1]);
  if (length === 0 || median.end > length + 1e-8) bad('median.stations', 'Median extends beyond its road');
  const direction: Vec2 = [(end[0] - origin[0]) / length, (end[1] - origin[1]) / length];
  const project = ([x, z]: Vec2): Vec2 => [(x - origin[0]) * direction[0] + (z - origin[1]) * direction[1],
    -(x - origin[0]) * direction[1] + (z - origin[1]) * direction[0]];
  const path = road.path.map(project);
  if (path.some(([along, lateral], index) => Math.abs(lateral) > 1e-8 || index > 0 && along < path[index - 1]![0])) bad('median.edgeId', 'Median requires a straight directed road');
  const fits = (polygon: Ring, start: number, end: number, halfWidth: number): boolean => {
    const points = polygon.map(project), along = points.map(p => p[0]), lateral = points.map(p => p[1]);
    return Math.abs(Math.min(...along) - start) < 1e-7 && Math.abs(Math.max(...along) - end) < 1e-7
      && Math.abs(Math.min(...lateral) + halfWidth) < 1e-7 && Math.abs(Math.max(...lateral) - halfWidth) < 1e-7;
  };
  if (!fits(median.footprint, median.start, median.end, 1.7) || !fits(median.paving, median.start + 0.7, median.end - 0.7, 1)) {
    bad('median.stations', 'Median polygons disagree with their road stations or widths');
  }
  const sameLand = (polygon: Ring, ground: Ring[]): boolean =>
    totalArea(difference([polygon], ground)) <= 1e-7 && totalArea(difference(ground, [polygon])) <= 1e-7;
  if (owner.ground.some(field => field.surface === 'roadway' || field.top !== (field.surface === 'gutter' ? 0 : 0.2))
    || !sameLand(median.footprint, owner.ground.map(field => field.ring))
    || !sameLand(median.paving, owner.ground.filter(field => field.surface === 'sidewalk').map(field => field.ring))) {
    bad('median.footprint', 'Median polygons disagree with their physical ground owner');
  }
  if (median.ornaments.some(item => !contains(median.paving, item.position))) bad('median.ornaments', 'Median ornament is outside its paving');
}

function contains(polygon: Ring, [x, z]: Vec2): boolean {
  let inside = false;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!;
    if ((x - a[0]) * (b[1] - a[1]) === (z - a[1]) * (b[0] - a[0])
      && x >= Math.min(a[0], b[0]) && x <= Math.max(a[0], b[0]) && z >= Math.min(a[1], b[1]) && z <= Math.max(a[1], b[1])) return true;
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
