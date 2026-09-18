import type { NativePieceData } from '../../assets/native-schema.ts';
import type { StreetClass, StreetKitPiece, StreetProfile } from '../../schema/street-kit.ts';
import type { Vec3 } from '../../geometry/schema.ts';
import type { FurnitureOptions } from '../hardware/schema.ts';
import { createHardware } from '../hardware/index.ts';
import { SurfaceBatch } from '../surfaces/SurfaceBatch.ts';
import { invariant } from '../../errors.ts';
import { constructPiece, pieceGeometry } from './PieceConstruction.ts';
import { CatalogueScene } from './CatalogueScene.ts';
import { ProfileCatalogue } from './ProfileCatalogue.ts';

export interface AuthoredUnit { geometry: NativePieceData; metadata: Omit<StreetKitPiece, 'file' | 'size' | 'bounds' | 'surfaces' | 'triangles' | 'bytes' | 'sha256' | 'hasCollision'> }

/** A closed inventory built entirely from the published Atlas profiles. */
export class KitCatalogue {
  readonly pieces: AuthoredUnit[] = [];
  readonly profiles = new ProfileCatalogue().profiles;
  panels = 0;

  constructor() {
    for (const profile of this.profiles) for (const [variant, length] of [['plain', 8], ['parking', 8], ['closure', 4], ['closure', 2], ['drain', 8]] as const) {
      const built = constructPiece(new CatalogueScene().segment(profile, length, variant));
      const id = `${profile.streetClass}/${profile.id}/${length}m-${variant}`;
      this.panels += built.panels;
      this.pieces.push({ geometry: { ...built.geometry, id }, metadata: { id, kind: 'segment', classes: [profile.streetClass], zone: profile.zone,
        variant, length, origin: 'run-start-at-road', footprint: built.footprint, profileId: profile.id } });
    }
    const classes: StreetClass[] = ['alley', 'road', 'street'];
    for (const zone of ['ordinary', 'luxury', 'industrial']) for (const [i, first] of classes.entries()) for (const second of classes.slice(i)) {
      const configurations = this.profiles.filter(p => p.zone === zone && [first, second].includes(p.streetClass))
        .flatMap(a => this.profiles.filter(b => b.zone === zone && [a.streetClass, b.streetClass].sort().join('+') === [first, second].join('+')).map(b => [a, b] as const));
      for (const kind of ['junction-arm', 'junction-center'] as const) {
        const id = `junction/${first}+${second}/${zone}/${kind === 'junction-arm' ? 'arm' : 'center'}`;
        const parts = configurations.map(([a, b]) => {
          const key = `${a.id.split('/')[1]}+${b.id.split('/')[1]}`;
          const built = constructPiece(new CatalogueScene().junction(a, b, kind === 'junction-center'));
          if (kind === 'junction-center' && zone !== 'ordinary') for (const mesh of built.geometry.meshes) {
            if (mesh.surface === 'asphalt' || mesh.surface === 'district-hex') mesh.surface = `district-junction-${zone === 'luxury' ? 'blue' : 'yellow'}`;
          }
          this.panels += built.panels;
          return { key, built };
        });
        const metadata: AuthoredUnit['metadata'] = { id, kind, classes: [first, second], zone, variant: 'plain', length: 0, origin: 'junction-at-road',
          footprint: parts[0]!.built.footprint, configurations: parts.map(p => ({ id: p.key, footprint: p.built.footprint })) };
        const meshes = parts.flatMap(p => p.built.geometry.meshes.map(m => ({ ...m, id: `${p.key}/${m.id}` })));
        const geometry: NativePieceData = { id, origin: [0, 0, 0], meshes, bounds: {
          min: [0, 1, 2].map(axis => Math.min(...parts.map(p => p.built.geometry.bounds.min[axis]!))) as unknown as Vec3,
          max: [0, 1, 2].map(axis => Math.max(...parts.map(p => p.built.geometry.bounds.max[axis]!))) as unknown as Vec3 } };
        this.pieces.push({ geometry, metadata });
      }
    }
    const props: FurnitureOptions[] = [
      ...(['inlet', 'cable'] as const).map(kind => ({ kind, length: 2, depth: 0.7, style: 0, damaged: false })),
      { kind: 'marquee', length: 2, depth: 0.5, style: 0, damaged: false },
      { kind: 'tree-grate', length: 1.8, depth: 1.8, style: 0, damaged: false },
      ...[2, 4].flatMap(length => Array.from({ length: 6 }, (_, style) => ({ kind: 'guard' as const, length, depth: 0.4, style, damaged: false }))),
      ...Array.from({ length: 3 }, (_, style) => ({ kind: 'inlet' as const, length: 2, depth: 0.5, style, damaged: false })),
      ...[2, 4].flatMap(length => Array.from({ length: 3 }, (_, style) => ({ kind: 'channel' as const, length, depth: 1, style, damaged: false }))),
      ...[14.6, 18].map(length => ({ kind: 'access' as const, length, depth: 0.6, style: 0, damaged: false })),
    ];
    for (const options of props) this.prop(options);
    this.pieces.sort((a, b) => a.metadata.id.localeCompare(b.metadata.id, 'en'));
    if (this.pieces.length > 200) throw invariant('Street catalogue exceeds piece budget', { pieces: this.pieces.length, limit: 200 });
  }

  static segment(profile: StreetProfile, length: number, variant: string): string {
    return `${profile.streetClass}/${profile.id}/${length}m-${variant}`;
  }

  static prop(options: FurnitureOptions): string {
    return `prop/${options.kind}/${options.length}m-${options.depth}m-${options.style}`;
  }

  private prop(options: FurnitureOptions): void {
    const id = KitCatalogue.prop(options), model = createHardware(options);
    const batch = new SurfaceBatch({ ownerId: 'prop', groundIds: ['prop'], roadTop: 0, wear: () => 0 });
    try {
      for (const part of model.parts) batch.geometry(part.material, part.geometry, { origin: [0, 0, 0], inward: [0, 1] });
      this.pieces.push({ geometry: pieceGeometry(id, [batch.finish()]), metadata: { id, kind: 'prop', classes: [], zone: 'shared', variant: options.kind,
        length: options.length, origin: 'anchor-at-road', footprint: [] } });
    } finally { model.dispose(); }
  }
}
