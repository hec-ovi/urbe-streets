import type { NativeArchitecture, NativeOwner } from '../../architecture/native-schema.ts';

export function palette(owner: NativeOwner, architecture: NativeArchitecture) {
  const median = architecture.medians?.find(value => value.id === owner.id);
  const style = median ? architecture.roads.find(road => road.id === median.edgeId)?.districtStyle : undefined;
  const luxury = owner.finish?.startsWith('luxury-') || style === 'luxury';
  const color = owner.finish === 'industrial-yellow' || style === 'industrial' ? 'yellow'
    : owner.finish === 'luxury-red' || owner.kind === 'median' && !luxury ? 'red' : 'blue';
  const authored = luxury || owner.finish === 'industrial-yellow' || owner.kind === 'median';
  return {
    luxury, blue: luxury && color === 'blue',
    large: luxury ? `district-panel-${color}` : 'ordinary',
    small: luxury ? 'district-panel-dark' : 'ordinary',
    curb: authored ? `district-curb-${color}` : 'curb',
    gutter: authored ? `district-gutter-${color}` : 'gutter',
    separator: authored ? `district-curb-${color}` : 'basalt',
  };
}
