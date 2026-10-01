import type { NativeArchitecture, NativeOwner } from '../../architecture/native-schema.ts';
import type { Ring, Vec2 } from '../../geometry/schema.ts';
import { bounds } from '../../geometry/polygons.ts';
import { BoxIndex } from '../../geometry/BoxIndex.ts';
import { contains } from '../surfaces/Regions.ts';
import { parkingFinish } from './ParkingFit.ts';
import type { ParkingFinish } from './ParkingScene.ts';

/**
 * Which block a sidewalk point belongs to and the kerb finish it wears: a block keeps one finish
 * all round, so every kerb walk, arm side and far kerb on its sidewalk takes that block's own.
 */
export class KerbFinishes {
  private readonly fields: BoxIndex<{ ring: Ring; owner: NativeOwner }>;
  constructor(a: NativeArchitecture) {
    this.fields = new BoxIndex(a.owners.flatMap(owner => owner.ground.filter(g => g.surface === 'sidewalk').map(g => ({ ring: g.ring, owner }))),
      value => bounds(value.ring));
  }

  /** The owner whose sidewalk holds `point` and its finish, else the zone's own finish and no owner. */
  at(point: Vec2, zone: string): { finish: ParkingFinish; owner?: NativeOwner } {
    const owner = this.fields.near(bounds([point])).find(value => contains(value.ring, point))?.owner;
    return { finish: parkingFinish(owner, zone), ...(owner ? { owner } : {}) };
  }
}
