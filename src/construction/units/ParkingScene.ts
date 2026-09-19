import type { NativeOwner } from '../../architecture/native-schema.ts';
import type { StreetProfile } from '../../schema/street-kit.ts';
import { bounds, rectangle } from '../../geometry/polygons.ts';
import { SurfaceBatch } from '../surfaces/SurfaceBatch.ts';
import { CatalogueScene } from './CatalogueScene.ts';
import { constructPiece, pieceGeometry } from './PieceConstruction.ts';
import type { AuthoredUnit } from './KitCatalogue.ts';
import { parkingFields } from './ParkingFields.ts';

export const parkingFinishes = ['ordinary', 'luxury-blue', 'luxury-red', 'industrial-yellow'] as const;
export type ParkingFinish = typeof parkingFinishes[number];
export const sideId = (finish: string, variant: string) => `kerb/${finish}/${variant}`;
export const coreId = (profile: StreetProfile, closure: boolean) => `${profile.streetClass}/${profile.id}/${closure ? '2m-core-closure' : '8m-core'}`;

/** Shared kerb strips have the same receiving fields as an Atlas rectangular notch. */
export function parkingSide(profile: StreetProfile, finish: ParkingFinish, variant: string): AuthoredUnit & { panels: number } {
  const length = variant === 'walk' ? 8 : variant === 'walk-closure' ? 2 : variant === 'parking-slot' ? 6 : 4;
  const scene = new CatalogueScene().segment(profile, length, 'closure'), a = scene.architecture;
  const owner = a.owners.find(o => o.frontages[0]?.inward[1] === 1)!;
  owner.finish = finish;
  const face = owner.frontages[0]!;
  face.start = [0, 0]; face.end = [length, 0];
  const slot = variant === 'parking-slot', start = variant === 'parking-start', end = variant === 'parking-end';
  const fields = parkingFields(length, variant);
  const floor = fields.find(f => f.surface === 'roadway')!.rings;
  owner.ground = fields.flatMap(({ surface, rings }) => rings.map((ring, i) => ({ id: `${surface}:${i}`, ownerId: owner.id, sourceIndex: 0,
    surface, ring, top: surface === 'curb' || surface === 'sidewalk' ? 0.2 : 0, bottom: -0.2 })));
  owner.parking = floor.map(footprint => ({ id: 'parking', ownerId: owner.id, frontageId: face.id,
    start: start ? 2 : 0, end: end ? 2 : length, support: { start: 0, end: length }, slotCount: slot ? 1 : 0, depth: 2, footprint, slots: [] }));
  const context: NativeOwner = { ...owner, id: 'context', frontages: [], parking: [], ground: [{ id: 'road', ownerId: 'context', sourceIndex: 0,
    surface: 'roadway', ring: rectangle(-1, -2, length + 2, 2), bottom: -0.2, top: 0 }] };
  a.owners = [owner]; a.bounds = bounds(rectangle(0, 0, length, 4.9)); a.boundary = rectangle(0, 0, length, 4.9);
  const built = constructPiece({ ...scene, edgeOwners: [owner, context], paint: false });
  if (slot || end) {
    const batch = new SurfaceBatch({ ownerId: owner.id, groundIds: ['parking'], roadTop: 0, wear: () => 0 });
    batch.polygon('whitePaint', [rectangle(0, 0.1, 0.12, 1.8)], 0.006, p => p, false);
    built.geometry.meshes.push(...pieceGeometry('slot-line', [batch.finish()]).meshes);
  }
  const id = sideId(finish, variant);
  return { panels: built.panels, geometry: { ...built.geometry, id }, metadata: { id, kind: 'segment', classes: ['street', 'road'], zone: profile.zone,
    variant, length, origin: 'run-start-at-road', footprint: built.footprint } };
}
