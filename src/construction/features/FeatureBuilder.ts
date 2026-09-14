import { invariant } from '../../errors.ts';
import type { NativeArchitecture, NativeFrontage, NativeOwner } from '../../architecture/native-schema.ts';
import type { Box3, Vec2 } from '../../geometry/schema.ts';
import { random } from '../style/random.ts';
import { PanelStyle } from '../style/PanelStyle.ts';
import { along, dot, sub } from '../surfaces/Frame.ts';
import { SurfaceBatch } from '../surfaces/SurfaceBatch.ts';
import type { SurfaceOutput } from '../surfaces/schema.ts';
import { Models } from './Models.ts';
import { accessPlan } from './AccessPlan.ts';
import { Fitting } from './Fitting.ts';
import type { PlacedFeature } from './schema.ts';

/** Source candidate rhythm and styles, constrained by the retained city reservations. */
export class FeatureBuilder {
  private readonly architecture: NativeArchitecture;
  private readonly seed: number;
  private readonly wear: (point: Vec2) => number;
  private readonly models = new Models();
  private readonly fitting: Fitting;
  constructor(architecture: NativeArchitecture, seed: number, wear: (point: Vec2) => number) { this.architecture = architecture; this.seed = seed; this.wear = wear; this.fitting = new Fitting(architecture); }

  plan(): PlacedFeature[] {
    const result: PlacedFeature[] = [];
    for (const owner of this.architecture.owners) {
      const occupied = new Map(owner.frontages.map(face => [face.id, owner.parking.filter(bay => bay.frontageId === face.id).map(bay => [bay.support.start, bay.support.end] as Vec2)]));
      for (const [index, guard] of owner.guards.entries()) {
        const normal = ([[0, 1], [-1, 0], [0, -1], [1, 0]] as Vec2[])[guard.turn]!;
        const face = owner.frontages.find(face => face.inward.every((value, axis) => Math.abs(value - normal[axis]!) < 1e-8)
          && Math.abs(dot(sub(guard.origin, face.start), normal) - 0.5) < 1e-7);
        if (!face) throw invariant('Retained guard has no authored frontage', { ownerId: owner.id, guardIndex: index });
        const start = dot(sub(guard.origin, face.start), [normal[1], -normal[0]]);
        for (let repetition = 0; repetition < guard.count; repetition++) {
          const station = start + repetition * guard.step, id = `guard:${owner.id}:${index}:${repetition}`;
          const style = Math.floor(random(this.seed, `guard:${owner.id}:${index}:style`) * 6);
          const placed = this.fit(owner, face, id, 'guard', station, 2, 0.4, 0, style, true);
          if (!placed) throw invariant('Retained guard cannot fit its native geometry', { featureId: id });
          result.push(placed);
        }
        occupied.get(face.id)!.push([start, start + guard.count * guard.step]);
      }
      if (owner.kind !== 'block' && owner.kind !== 'perimeter') continue;
      for (const face of owner.frontages) {
        if (face.length < 10 || face.edgeIds.every(id => this.architecture.roads.find(road => road.id === id)?.kind === 'highway')) continue;
        const service = PanelStyle.rows(face.pavedWidth, this.seed, face.id).find(row => row.band === 'service' && row.width === 1);
        const spans = occupied.get(face.id)!;
        const add = (kind: 'guard' | 'inlet' | 'channel', start: number, length: number, probability: number, depth: number, setback = 0) => {
          const id = `${face.id}:${kind}:${start}`, end = start + length;
          if (start < 4 || end > face.length - 4 || random(this.seed, `${id}:select`) >= probability
            || spans.some(([a, b]) => end + 1 > a && start < b + 1)) return;
          const style = Math.floor(random(this.seed, `${id}:style`) * (kind === 'guard' ? 6 : 3));
          const placed = this.fit(owner, face, id, kind, start, length, depth, setback, style, false);
          if (placed) { result.push(placed); spans.push([start, end]); }
        };
        for (let station = 10; station < face.length - 6; station += 8) {
          add('inlet', station, 2, 0.13 + this.wear(along(face, station)) * 0.12, 0.5);
          if (face.pavedWidth >= 4 && service) add('channel', station, random(this.seed, `${owner.id}:${station}:channel-length`) < 0.25 ? 4 : 2, 0.08, 1, service.depth);
          if (face.pavedWidth >= 4) add('guard', station, random(this.seed, `${owner.id}:${station}:guard-length`) < 0.3 ? 4 : 2, 0.16, 0.4);
        }
      }
    }
    result.push(...accessPlan(this.architecture, this.seed, this.wear, this.models));
    return result;
  }

  draw(owner: NativeOwner, features: PlacedFeature[]): SurfaceOutput {
    if (!features.length) return { meshes: [], coverage: [] };
    const batch = new SurfaceBatch({ ownerId: owner.id, groundIds: owner.ground.map(ground => ground.id), roadTop: features[0]!.placement.origin[1], wear: this.wear });
    const coverage: SurfaceOutput['coverage'] = [];
    for (const feature of features) {
      const model = this.models.get(feature.options);
      for (const part of model.model.parts) batch.geometry(part.material, part.geometry, feature.placement);
      if (feature.cut) coverage.push({ ownerId: owner.id, rings: [feature.descriptor.footprint] });
    }
    return { meshes: batch.finish().meshes, coverage };
  }
  dispose(): void { this.models.dispose(); }

  private fit(owner: NativeOwner, face: NativeFrontage, id: string, kind: 'guard' | 'inlet' | 'channel', start: number, length: number,
    depth: number, setback: number, style: number, required: boolean): PlacedFeature | null {
    const point = along(face, start + length / 2, setback), inward = face.inward, d: Vec2 = [inward[1], -inward[0]];
    const options = { kind, length, depth, style, damaged: this.wear(point) > 0.5 };
    const source = this.models.get(options);
    const place = ([x, z]: Vec2): Vec2 => [point[0] + d[0] * x + inward[0] * z, point[1] + d[1] * x + inward[1] * z];
    const footprint = source.footprint.map(place);
    const reason = this.fitting.rejection(owner, footprint, kind);
    if (reason && required) throw invariant('Retained guard cannot fit its native geometry', { featureId: id, style, footprint, reason });
    if (reason || (kind === 'inlet' && !this.fitting.inletInterfaces(footprint))) return null;
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const part of source.model.parts) {
      const positions = part.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        const p = place([positions.getX(i), positions.getZ(i)]), values = [p[0], face.roadTop + positions.getY(i), p[1]];
        values.forEach((value, axis) => { min[axis] = Math.min(min[axis]!, value); max[axis] = Math.max(max[axis]!, value); });
      }
    }
    const bounds: Box3 = { min: min.map(value => Math.floor(value * 1000) / 1000) as unknown as Box3['min'], max: max.map(value => Math.ceil(value * 1000) / 1000) as unknown as Box3['max'] };
    return { descriptor: { id, kind, ownerId: owner.id, frontageId: face.id, style, length, depth, bounds, footprint }, options,
      placement: { origin: [point[0], face.roadTop, point[1]], inward },
      cut: kind === 'guard' ? null : { id, kind, frontageId: face.id, start, end: start + length, setback, depth, ring: footprint } };
  }
}
