import type { NativeArchitecture, NativeFrontage, NativeOwner } from '../../architecture/native-schema.ts';
import type { Ring, Vec2 } from '../../geometry/schema.ts';
import { bounds } from '../../geometry/polygons.ts';
import { difference, intersection, totalArea } from '../surfaces/Regions.ts';
import { along, dot, sub } from '../surfaces/Frame.ts';
import { SurfaceBatch } from '../surfaces/SurfaceBatch.ts';
import { createHardware, type FurnitureModel, type FurnitureOptions } from '../hardware/index.ts';
import { palette } from './Palette.ts';
import { marqueeGlyphs } from './Glyphs.ts';
import type { DistrictFeature } from './schema.ts';
import settings from './settings.json' with { type: 'json' };
import { invariant } from '../../errors.ts';

/** Whole pieces on shared two-metre stations, with source clearance checks. */
export class DistrictDetails {
  readonly features: DistrictFeature[] = [];
  private readonly models = new Map<string, FurnitureModel>();
  private readonly architecture: NativeArchitecture;
  private readonly excluded: Ring[];

  constructor(architecture: NativeArchitecture) {
    this.architecture = architecture;
    this.excluded = [...architecture.approaches.flatMap(approach => [approach.field, ...approach.landings]),
      ...architecture.stationBays.map(bay => bay.footprint), ...architecture.shafts.map(shaft => shaft.ring)];
    for (const owner of architecture.owners) {
      if (owner.kind === 'median') {
        const median = architecture.medians?.find(value => value.id === owner.id), face = owner.frontages[0]!;
        for (const ornament of median?.ornaments ?? []) if (ornament.kind === 'tree') {
          const station = dot(sub(ornament.position, face.start), [face.inward[1], -face.inward[0]]) - 0.9;
          this.add(owner, face, 'tree-grate', station, 1.8, 1.8, dot(sub(ornament.position, face.start), face.inward));
        }
      }
      if (owner.kind !== 'block' && owner.kind !== 'perimeter') continue;
      const colors = palette(owner, architecture);
      for (const face of owner.frontages) {
        if (face.edgeIds.every(id => architecture.roads.find(road => road.id === id)?.kind === 'highway')) continue;
        const rim = face.curbWidth + face.gutterWidth;
        for (const [kind, interval, depth] of [['inlet', settings.drainInterval, rim],
          ['marquee', settings.marqueeInterval, face.gutterWidth], ['cable', settings.cableInterval, rim]] as const) {
          if (kind !== 'inlet' && !colors.luxury) continue;
          for (let station = kind === 'inlet' ? 8 : kind === 'marquee' ? 16 : 28; station + 2 <= face.length - settings.endClearance; station += interval) {
            if (owner.parking.some(bay => bay.frontageId === face.id && station + 2 > bay.support.start && station < bay.support.end)) continue;
            this.add(owner, face, kind, station, 2, depth, 0);
          }
        }
      }
      for (const bay of owner.parking) {
        if (!colors.luxury) continue;
        const face = owner.frontages.find(value => value.id === bay.frontageId)!;
        for (let slot = 0; slot < bay.slotCount; slot++) this.add(owner, face, 'marquee', bay.start + 4 + slot * 6, 2, face.gutterWidth, bay.depth);
      }
      for (const guard of owner.guards) {
        const n = ([[0, 1], [-1, 0], [0, -1], [1, 0]] as Vec2[])[guard.turn]!;
        const face = owner.frontages.find(face => face.inward.every((value, axis) => Math.abs(value - n[axis]!) < 1e-8)
          && Math.abs(dot(sub(guard.origin, face.start), n) - face.curbWidth - face.gutterWidth) < 1e-6);
        if (!face) throw invariant('District guard has no source frontage', { ownerId: owner.id, moduleId: guard.moduleId });
        const station = dot(sub(guard.origin, face.start), [n[1], -n[0]]);
        for (let i = 0; i < guard.count; i++) this.add(owner, face, 'guard', station + i * guard.step, 2, 0.4, face.curbWidth + face.gutterWidth);
      }
    }
  }

  draw(owner: NativeOwner, batch: SurfaceBatch): void {
    for (const [index, feature] of this.features.filter(feature => feature.owner.id === owner.id).entries()) {
      const point = along(feature.face, feature.station + feature.descriptor.length / 2, feature.setback);
      for (const part of feature.model.parts) batch.geometry(part.material, part.geometry,
        { origin: [point[0], feature.face.roadTop, point[1]], inward: feature.face.inward });
      if (feature.cut) batch.polygon('darkMetal', [feature.cut.ring], feature.face.roadTop - 0.195, p => p, true, true);
      if (feature.kind === 'marquee') marqueeGlyphs(feature, batch, settings.messages[index % settings.messages.length]!);
    }
  }

  dispose(): void { this.models.forEach(model => model.dispose()); this.models.clear(); }

  private add(owner: NativeOwner, face: NativeFrontage, kind: DistrictFeature['kind'], station: number, length: number, depth: number, setback: number): void {
    const key = `${kind}:${length}:${depth}`;
    let model = this.models.get(key);
    if (!model) { model = createHardware({ kind, length, depth, style: 0, damaged: false } satisfies FurnitureOptions); this.models.set(key, model); }
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const part of model.parts) {
      const positions = part.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) for (const [axis, value] of [positions.getX(i), positions.getY(i), positions.getZ(i)].entries()) {
        min[axis] = Math.min(min[axis]!, value); max[axis] = Math.max(max[axis]!, value);
      }
    }
    if (kind === 'inlet') { min[0] = -length / 2; max[0] = length / 2; max[2] = depth + 2; max[1] = Math.max(max[1]!, 0.2); }
    const a = station + length / 2 + min[0]!, b = station + length / 2 + max[0]!;
    const z0 = setback + min[2]!, z1 = setback + max[2]!;
    const footprint: Ring = [along(face, a, z0), along(face, b, z0), along(face, b, z1), along(face, a, z1)];
    const receiving = owner.ground.filter(field => !['guard', 'tree-grate'].includes(kind) || field.surface === 'sidewalk').map(field => field.ring);
    if (totalArea(difference([footprint], receiving)) > 1e-7 || totalArea(intersection([footprint], this.excluded)) > 1e-7
      || this.features.some(feature => totalArea(intersection([footprint], [feature.descriptor.footprint])) > 1e-7)) return;
    const box = bounds(footprint);
    if (this.architecture.obstaclePoints.some(point => Math.hypot(Math.max(box.min[0] - point.position[0], 0, point.position[0] - box.max[0]),
      Math.max(box.min[1] - point.position[1], 0, point.position[1] - box.max[1])) < point.clearance)) return;
    const id = `${face.id}:${kind}:${station}:${setback}`;
    const feature: DistrictFeature = { owner, face, station, setback, kind, model,
      descriptor: { id, kind, ownerId: owner.id, frontageId: face.id, style: 0, length, depth,
        bounds: { min: [Math.floor(box.min[0] * 1000) / 1000, Math.floor((face.roadTop + min[1]!) * 1000) / 1000, Math.floor(box.min[1] * 1000) / 1000],
          max: [Math.ceil(box.max[0] * 1000) / 1000, Math.ceil((face.roadTop + max[1]!) * 1000) / 1000, Math.ceil(box.max[1] * 1000) / 1000] }, footprint } };
    if (kind === 'inlet') {
      feature.cut = { id, kind: 'inlet', frontageId: face.id, start: station, end: station + length, setback, depth,
        ring: [along(face, station), along(face, station + length), along(face, station + length, depth), along(face, station, depth)] };
      feature.panel = [along(face, station, depth), along(face, station + 2, depth), along(face, station + 2, depth + 2), along(face, station, depth + 2)];
    }
    this.features.push(feature);
  }
}
