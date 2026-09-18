import type { Ring, Vec2 } from '../../geometry/schema.ts';
import type { StreetKitPiece, StreetPlacement } from '../../schema/street-kit.ts';
import { clean } from './Frame.ts';

/** Complete piece footprint under the same transform as its rendered geometry. */
export function placementFootprint(piece: Pick<StreetKitPiece, 'footprint'>, placement: StreetPlacement): Ring[] {
  const c = Math.cos(placement.rotationY), s = Math.sin(placement.rotationY);
  return piece.footprint.map(r => r.map(([x, z]): Vec2 => {
    x *= placement.scale?.[0] ?? 1; z *= placement.scale?.[2] ?? 1;
    return [clean(placement.position[0] + c * x + s * z), clean(placement.position[2] - s * x + c * z)];
  }));
}
