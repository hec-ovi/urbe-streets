import { createHash } from 'node:crypto';
import type { NativeArchitecture } from '../../architecture/native-schema.ts';
import type { NativePieceData } from '../../assets/native-schema.ts';
import type { Ring, Vec3 } from '../../geometry/schema.ts';
import type { StreetKitPiece, StreetPlacement } from '../../schema/street-kit.ts';
import { bounds, difference, intersection, intersects, totalArea, union } from '../../geometry/polygons.ts';
import { NativeCoverage } from '../../ground/NativeCoverage.ts';
import { WearField } from '../style/WearField.ts';
import { invariant } from '../../errors.ts';
import { nameKit } from './KitIds.ts';
import { UnitPlan } from './UnitPlan.ts';
import { unitDecals } from './UnitDecals.ts';
import { UnitFeatures } from './UnitFeatures.ts';
import { unitScene } from './UnitScene.ts';
import { constructPiece, pieceGeometry } from './PieceConstruction.ts';
import { pieceIdentity } from './PieceIdentity.ts';
import { UnitFrame } from './Frame.ts';

export interface AuthoredUnit { geometry: NativePieceData; metadata: Omit<StreetKitPiece, 'file' | 'size' | 'bounds' | 'surfaces' | 'triangles' | 'bytes' | 'sha256' | 'hasCollision'> }

export class StreetUnits {
  readonly pieces: AuthoredUnit[] = [];
  readonly placements: StreetPlacement[] = [];
  readonly plan: UnitPlan;
  readonly wear: WearField;
  readonly features: UnitFeatures;
  readonly ground: ReturnType<NativeCoverage['finish']>;
  panels = 0;

  constructor(a: NativeArchitecture, seed: number, amount: number) {
    this.plan = new UnitPlan(a);
    const plainClosures = this.plan.regions.filter(r => r.kind === 'segment' && r.length < 2).flatMap(r => r.mask);
    this.wear = new WearField({ seed, amount, bounds: a.bounds, streets: Math.max(1, new Set(a.roads.filter(r => r.kind !== 'highway').map(r => r.runId)).size) });
    this.features = new UnitFeatures(a, seed, p => this.wear.sample(p), plainClosures);
    const authored = new Map<string, AuthoredUnit>(), claims = new Map(a.owners.map(o => [o.id, [] as Ring[]]));
    for (const region of this.plan.regions) {
      const scene = unitScene(a, region, this.features.items, p => this.wear.sample(p));
      if (!scene.architecture.owners.length) continue;
      const built = constructPiece(scene, seed);
      const suffix = pieceIdentity(built.geometry);
      const prefix = region.kind === 'segment' ? `${region.classes[0]}/${region.zone}/${region.length}m-${scene.variant}`
          : `junction/${region.classes.join('+')}/${region.zone}/${region.kind === 'junction-center' ? 'center' : 'arm'}`;
      const id = `${prefix}/${suffix}`;
      let piece: AuthoredUnit = { geometry: { ...built.geometry, id }, metadata: { id, kind: region.kind, classes: region.classes, zone: region.zone,
          variant: scene.variant, length: region.length, origin: region.kind === 'segment' ? 'run-start-at-road' : 'junction-at-road', footprint: built.footprint } };
      this.panels += built.panels;
      const existing = authored.get(id);
      if (existing) piece = existing; else { authored.set(id, piece); this.pieces.push(piece); }
      const cover = piece.metadata.footprint.map(r => r.map(region.frame.world)), box = bounds(cover.flat());
      const owners = a.owners.filter(o => o.ground.some(g => intersects(bounds(g.ring), box))).flatMap(o => {
        const part = intersection(cover, o.ground.map(g => g.ring));
        if (totalArea(part) <= 1e-9) return [];
        claims.get(o.id)!.push(...part); return [o.id];
      });
      const expected = difference(intersection(a.owners.flatMap(o => o.ground.map(g => g.ring)), region.mask), a.shafts.map(s => s.ring));
      if (totalArea(difference(expected, cover)) > 1e-7 || totalArea(difference(cover, expected)) > 1e-7) throw invariant('Unit geometry does not cover its placement', { piece: piece.metadata.id,
        missing: totalArea(difference(expected, cover)), outside: totalArea(difference(cover, expected)) });
      this.place(piece.metadata.id, region.frame, owners);
    }
    const props = new Map<string, AuthoredUnit>();
    for (const f of this.features.items) {
      const key = JSON.stringify([f.options, f.message]);
      let piece = props.get(key);
      if (!piece) {
      const suffix = createHash('sha256').update(key).digest('hex'), id = `prop/${f.options.kind}/${suffix}`;
        piece = { geometry: pieceGeometry(id, [this.features.draw(f)]), metadata: { id, kind: 'prop', classes: [], zone: 'shared', variant: f.options.kind,
          length: f.options.length, origin: 'anchor-at-road', footprint: [] } };
        props.set(key, piece); this.pieces.push(piece);
      }
      this.place(piece.metadata.id, f.frame, [f.descriptor.ownerId], f.descriptor.id);
    }
    const decals = new Map<string, AuthoredUnit>();
    for (const decal of unitDecals(a, seed, p => this.wear.sample(p), plainClosures)) {
      const id = `marking/${decal.surface}/${pieceIdentity(decal.geometry)}`;
      if (!decals.has(id)) {
        const piece: AuthoredUnit = { geometry: { ...decal.geometry, id }, metadata: { id, kind: 'marking', classes: [], zone: 'shared', variant: decal.surface,
          length: 1, origin: 'anchor-at-road', footprint: [] } };
        decals.set(id, piece); this.pieces.push(piece);
      }
      this.place(id, decal.frame, decal.owners, undefined, decal.scale);
    }
    const coverage = new NativeCoverage(a);
    for (const owner of a.owners) {
      const rings = claims.get(owner.id)!;
      const overlap = totalArea(rings) - totalArea(union(rings));
      if (overlap > 1e-6) throw invariant('Street placements overlap receiving ground', { ownerId: owner.id, overlap });
      coverage.add(owner, [{ ownerId: owner.id, rings }]);
    }
    this.ground = coverage.finish();
    nameKit(this.pieces, this.placements);
  }
  private place(piece: string, frame: UnitFrame, ownerIds: string[], featureId?: string, scale?: Vec3): void {
    this.placements.push({ piece, position: frame.position, rotationY: frame.rotationY, cell: [Math.floor(frame.position[0] / 128), Math.floor(frame.position[2] / 128)],
      ownerId: ownerIds.includes('roadway') ? 'roadway' : ownerIds[0]!, ownerIds, ...(featureId ? { featureId } : {}), ...(scale ? { scale } : {}) });
  }
}
