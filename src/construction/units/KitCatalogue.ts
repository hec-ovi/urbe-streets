import type { NativePieceData } from '../../assets/native-schema.ts';
import type { StreetKitPiece, StreetProfile } from '../../schema/street-kit.ts';
import type { FurnitureOptions } from '../hardware/schema.ts';
import { createHardware } from '../hardware/index.ts';
import { capSides, marqueeDepth } from '../hardware/Marquee.ts';
import settings from '../district/settings.json' with { type: 'json' };
import { SurfaceBatch } from '../surfaces/SurfaceBatch.ts';
import { invariant } from '../../errors.ts';
import { constructPiece, pieceGeometry } from './PieceConstruction.ts';
import { CatalogueScene } from './CatalogueScene.ts';
import { overlayPieces } from './OverlayPieces.ts';
import { pieceFootprint } from './PieceFootprint.ts';
import { ProfileCatalogue } from './ProfileCatalogue.ts';
import { coreId, parkingFinishes, parkingSide } from './ParkingScene.ts';

export interface AuthoredUnit { geometry: NativePieceData; metadata: Omit<StreetKitPiece, 'file' | 'size' | 'bounds' | 'surfaces' | 'triangles' | 'bytes' | 'sha256' | 'hasCollision'> }

/** A closed inventory built entirely from the published Atlas profiles. */
export class KitCatalogue {
  readonly pieces: AuthoredUnit[] = [];
  readonly profiles = new ProfileCatalogue().profiles;
  panels = 0;

  constructor() {
    for (const profile of this.profiles) for (const [variant, length] of [['plain', 8], ['closure', 4], ['closure', 2]] as const) {
      const built = constructPiece(new CatalogueScene().segment(profile, length, variant));
      const id = `${profile.streetClass}/${profile.id}/${length}m-${variant}`;
      this.panels += built.panels;
      this.pieces.push({ geometry: { ...built.geometry, id }, metadata: { id, kind: 'segment', classes: [profile.streetClass], zone: profile.zone,
        variant, length, origin: 'run-start-at-road', footprint: built.footprint, profileId: profile.id } });
    }
    for (const profile of this.profiles.filter(p => p.width && !p.medianWidth)) for (const closure of [false, true]) {
      const scene = new CatalogueScene().segment(profile, closure ? 2 : 8, closure ? 'closure' : 'plain');
      scene.architecture.owners = scene.architecture.owners.filter(o => o.kind === 'roadway');
      const built = constructPiece(scene), id = coreId(profile, closure);
      this.pieces.push({ geometry: { ...built.geometry, id }, metadata: { id, kind: 'segment', classes: [profile.streetClass], zone: profile.zone,
        variant: closure ? 'core-closure' : 'core', length: closure ? 2 : 8, origin: 'run-start-at-road', footprint: built.footprint, profileId: profile.id } });
    }
    for (const finish of parkingFinishes) {
      const zone = finish.split('-')[0], profile = this.profiles.find(p => p.zone === zone && p.width === 7)!;
      for (const variant of ['walk', 'walk-closure', 'parking-slot', 'parking-start', 'parking-end']) {
        const piece = parkingSide(profile, finish, variant);
        this.panels += piece.panels; this.pieces.push(piece);
      }
    }
    for (const primary of this.profiles) for (const terminal of [false, true]) {
      const built = constructPiece(new CatalogueScene().junction(primary, { ...primary, width: 0 }, false, terminal));
      const id = KitCatalogue.arm(primary, terminal);
      this.panels += built.panels;
      this.pieces.push({ geometry: { ...built.geometry, id }, metadata: { id, kind: 'junction-arm', classes: [primary.streetClass],
        zone: primary.zone, variant: terminal ? 'return' : 'plain', length: 0, origin: 'junction-at-road', footprint: built.footprint } });
    }
    for (const zone of ['ordinary', 'luxury', 'industrial']) {
      const profiles = this.profiles.filter(p => p.zone === zone);
      for (const [i, primary] of profiles.entries()) for (const cross of profiles.slice(i)) {
        const built = constructPiece(new CatalogueScene().junction(primary, cross, true));
        if (zone !== 'ordinary') for (const mesh of built.geometry.meshes) {
          if (mesh.surface === 'asphalt' || mesh.surface === 'district-hex') mesh.surface = `district-junction-${zone === 'luxury' ? 'blue' : 'yellow'}`;
        }
        const id = KitCatalogue.center(primary, cross);
        this.panels += built.panels;
        this.pieces.push({ geometry: { ...built.geometry, id }, metadata: { id, kind: 'junction-center', classes: [primary.streetClass, cross.streetClass],
          zone, variant: 'plain', length: 0, origin: 'junction-at-road', footprint: built.footprint } });
      }
    }
    this.pieces.push(...overlayPieces());
    const run = settings.marquee;
    const props: FurnitureOptions[] = [
      ...(['inlet', 'cable'] as const).map(kind => ({ kind, length: 2, depth: 0.7, style: 0, damaged: false })),
      ...[...new Set(run.segments.flat())].map(length => ({ kind: 'marquee' as const, length, depth: marqueeDepth, style: 0, damaged: false })),
      ...Object.values(capSides).map(style => ({ kind: 'marquee-cap' as const, length: run.cap, depth: marqueeDepth, style, damaged: false })),
      { kind: 'tree-grate', length: 1.8, depth: 1.8, style: 0, damaged: false },
      ...[2, 4].flatMap(length => Array.from({ length: 6 }, (_, style) => ({ kind: 'guard' as const, length, depth: 0.4, style, damaged: false }))),
      ...Array.from({ length: 3 }, (_, style) => ({ kind: 'inlet' as const, length: 2, depth: 0.5, style, damaged: false })),
      ...[2, 4].flatMap(length => Array.from({ length: 3 }, (_, style) => ({ kind: 'channel' as const, length, depth: 1, style, damaged: false }))),
      ...[14.6, 18].map(length => ({ kind: 'access' as const, length, depth: 0.6, style: 0, damaged: false })),
    ];
    for (const options of props) this.prop(options);
    this.pieces.sort((a, b) => a.metadata.id.localeCompare(b.metadata.id, 'en'));
    if (this.pieces.length > 200) throw invariant('Street catalogue exceeds piece budget', { pieces: this.pieces.length, limit: 200, excessPieces: this.pieces.length - 200, variants: this.pieces.map(p => p.metadata.id) });
  }

  static segment(profile: StreetProfile, length: number, variant: string): string {
    return `${profile.streetClass}/${profile.id}/${length}m-${variant}`;
  }

  static arm(profile: StreetProfile, terminal = false): string { return `junction/${profile.id}/${terminal ? 'return' : 'arm'}`; }

  static center(primary: StreetProfile, cross: StreetProfile): string {
    return `junction/${primary.zone}/${primary.id.split('/')[1]}+${cross.id.split('/')[1]}/center`;
  }

  static prop(options: FurnitureOptions): string {
    if (options.kind === 'marquee') return `prop/marquee-run/segment-${options.length}m`;
    if (options.kind === 'marquee-cap') return `prop/marquee-run/cap-${options.style === capSides.end ? 'end' : 'start'}`;
    return `prop/${options.kind}/${options.length}m-${options.depth}m-${options.style}`;
  }

  private prop(options: FurnitureOptions): void {
    const id = KitCatalogue.prop(options), model = createHardware(options);
    const batch = new SurfaceBatch({ ownerId: 'prop', groundIds: ['prop'], roadTop: 0, wear: () => 0 });
    try {
      for (const part of model.parts) batch.geometry(part.material, part.geometry, { origin: [0, 0, 0], inward: [0, 1] });
      const geometry = pieceGeometry(id, [batch.finish()]);
      this.pieces.push({ geometry, metadata: { id, kind: 'prop', classes: [], zone: 'shared', variant: options.kind,
        length: options.length, origin: 'anchor-at-road', footprint: pieceFootprint(geometry) } });
    } finally { model.dispose(); }
  }
}
