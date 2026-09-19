import type { NativeGround } from '../../architecture/native-schema.ts';
import type { Ring } from '../../geometry/schema.ts';
import { difference, rectangle, union } from '../../geometry/polygons.ts';

export interface ParkingField { surface: NativeGround['surface']; rings: Ring[] }

/** Local X follows the frontage; local Z points from the road into the block. */
export function parkingFields(length: number, variant: string): ParkingField[] {
  const slot = variant === 'parking-slot', start = variant === 'parking-start', end = variant === 'parking-end';
  let floor: Ring[] = [], gutter: Ring[], curb: Ring[];
  if (slot) {
    floor = [rectangle(0, 0, length, 2)];
    gutter = [rectangle(0, 2, length, 0.5)]; curb = [rectangle(0, 2.5, length, 0.2)];
  } else if (start || end) {
    const orient = (r: Ring): Ring => end ? r.map(([x, z]) => [length - x, z] as [number, number]).reverse() : r;
    floor = [orient(rectangle(2, 0, 2, 2))];
    gutter = [orient([[0, 0], [2, 0], [2, 2], [4, 2], [4, 2.5], [1.5, 2.5], [1.5, 0.5], [0, 0.5]])];
    curb = [orient([[0, 0.5], [1.5, 0.5], [1.5, 2.5], [4, 2.5], [4, 2.7], [1.3, 2.7], [1.3, 0.7], [0, 0.7]])];
  } else {
    gutter = [rectangle(0, 0, length, 0.5)]; curb = [rectangle(0, 0.5, length, 0.2)];
  }
  return [{ surface: 'roadway', rings: floor }, { surface: 'gutter', rings: gutter }, { surface: 'curb', rings: curb },
    { surface: 'sidewalk', rings: difference([rectangle(0, 0, length, 4.9)], union([...floor, ...gutter, ...curb])) }];
}
