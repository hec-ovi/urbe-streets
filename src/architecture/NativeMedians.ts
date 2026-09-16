import { bad, number, point, records, ring, string } from './values.ts';
import { validateMedianGeometry } from './MedianGeometry.ts';
import type { NativeMedian, NativeOwner, NativeRoad } from './native-schema.ts';

export function nativeMedians(input: unknown, owners: NativeOwner[], roads: NativeRoad[]): NativeMedian[] {
  const rows = input === undefined ? [] : records(input, 'construction.medians');
  const ids = new Set<string>();
  const medians = rows.map(value => {
    const id = string(value.id, 'median.id'), edgeId = string(value.edgeId, 'median.edgeId');
    const owner = owners.find(owner => owner.id === id), road = roads.find(road => road.id === edgeId);
    if (ids.has(id) || owner?.kind !== 'median' || !road || road.medianWidth !== value.width
      || owner.frontages.some(frontage => frontage.edgeIds.length !== 1 || frontage.edgeIds[0] !== edgeId)
      || value.width !== 3.4 || value.pavedWidth !== 2 || value.curbWidth !== 0.2 || value.gutterWidth !== 0.5) bad('construction.medians', 'Invalid median owner or dimensions');
    ids.add(id);
    const start = number(value.start, 'median.start'), end = number(value.end, 'median.end');
    if (start < 0 || end - start < 8) bad('construction.medians', 'Invalid median stations');
    const ornaments = records(value.ornaments, 'median.ornaments').map(item => {
      if (item.kind !== 'tree' && item.kind !== 'pole') bad('median.ornaments', 'Unknown median ornament');
      return { kind: item.kind, position: point(item.position, 'median.ornament.position') } as NativeMedian['ornaments'][number];
    });
    const median = { id, edgeId, start, end, footprint: ring(value.footprint, 'median.footprint'), paving: ring(value.paving, 'median.paving'), ornaments };
    validateMedianGeometry(median, owner, road);
    return median;
  });
  if (medians.length !== owners.filter(owner => owner.kind === 'median').length) bad('construction.medians', 'Missing median source records');
  return medians;
}
