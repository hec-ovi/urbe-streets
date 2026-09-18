import type { Ring, Vec2 } from '../../geometry/schema.ts';
import type { StreetKitPiece, StreetPlacement } from '../../schema/street-kit.ts';
import { intersection } from '../../geometry/polygons.ts';
import { clean } from './Frame.ts';

/** The same selection and clipping order applies to rendering and collision. */
export function placementFootprint(piece: Pick<StreetKitPiece, 'footprint' | 'configurations'>, placement: StreetPlacement): Ring[] {
  const source = placement.configuration ? piece.configurations!.find(c => c.id === placement.configuration)!.footprint : piece.footprint;
  const local = source.map(r => r.map(([x, z]): Vec2 => [clean((x + (placement.offset?.[0] ?? 0)) * (placement.scale?.[0] ?? 1)),
    clean((z + (placement.offset?.[1] ?? 0)) * (placement.scale?.[2] ?? 1))]));
  const received = placement.clip ? intersection(local, placement.clip) : local;
  const c = Math.cos(placement.rotationY), s = Math.sin(placement.rotationY);
  return received.map(r => r.map(([x, z]): Vec2 => [clean(placement.position[0] + c * x + s * z), clean(placement.position[2] - s * x + c * z)]));
}
