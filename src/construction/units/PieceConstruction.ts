import type { NativePieceData } from '../../assets/native-schema.ts';
import type { Ring } from '../../geometry/schema.ts';
import { intersection, union } from '../../geometry/polygons.ts';
import { EdgeRing } from '../surfaces/EdgeRing.ts';
import { SurfaceBatch } from '../surfaces/SurfaceBatch.ts';
import type { NativeMesh, SurfaceOutput } from '../surfaces/schema.ts';
import { DistrictPaving } from '../district/Paving.ts';
import { DistrictRoads } from '../district/Roads.ts';
import { CrossingRamps } from '../district/Ramps.ts';
import { palette } from '../district/Palette.ts';
import { Paving } from '../surfaces/Paving.ts';
import { parking } from '../surfaces/Parking.ts';
import { asphalt } from '../surfaces/Asphalt.ts';
import { Markings } from '../markings/Markings.ts';
import type { SceneInput } from './UnitScene.ts';
import { unitBounds } from './UnitBounds.ts';
import { canonical, clean } from './Frame.ts';

export interface ConstructedPiece { geometry: NativePieceData; footprint: Ring[]; panels: number }

export function pieceGeometry(id: string, surfaces: SurfaceOutput[]): NativePieceData {
  const meshes = new Map<string, NativeMesh>();
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const output of surfaces) for (const source of output.meshes) {
    const key = `${source.surface}:${source.collision}`;
    let mesh = meshes.get(key);
    if (!mesh) { mesh = { ...source, id: key, ownerIds: [], groundIds: [], positions: [], normals: [], uvs: [], wear: [], heights: [] }; meshes.set(key, mesh); }
    for (const field of ['positions', 'normals', 'uvs', 'wear', 'heights'] as const) for (const value of source[field]) mesh[field].push(clean(value));
    for (let i = 0; i < source.positions.length; i++) { const axis = i % 3, value = source.positions[i]!; min[axis] = Math.min(min[axis]!, value); max[axis] = Math.max(max[axis]!, value); }
  }
  return { id, origin: [0, 0, 0], bounds: { min: min as [number, number, number], max: max as [number, number, number] }, meshes: [...meshes.values()].sort((a, b) => a.id.localeCompare(b.id, 'en')) };
}

/** All dimensions and surfaces come from the accepted construction routines. */
export function constructPiece(scene: SceneInput, seed: number): ConstructedPiece {
  const { architecture: a, details } = scene;
  const plain = scene.variant === 'fitted-closure';
  const edges = new EdgeRing({ owners: scene.edgeOwners }), roads = new DistrictRoads(a), paving = new DistrictPaving(a), ramps = new CrossingRamps(a);
  const sourcePaving = new Paving(a, seed, scene.wear), markings = new Markings(a, seed, () => 0);
  const outputs: SurfaceOutput[] = [];
  let panels = 0;
  for (const owner of a.owners) {
    const top = owner.frontages[0]?.roadTop ?? owner.ground.find(g => g.surface === 'roadway')?.top ?? owner.ground[0]!.top - 0.2;
    const batch = new SurfaceBatch({ ownerId: owner.id, groundIds: owner.ground.map(g => g.id), roadTop: top, wear: () => 0 });
    const features = plain ? [] : details.get(owner.id) ?? [], planned = a.format === 'district' && !plain ? ramps.plan(owner) : [];
    const cuts = [...features.flatMap(f => f.cut ? [f.cut] : []), ...planned.map(r => r.cut)];
    if (a.format === 'district') {
      roads.build(owner, batch);
      edges.build(owner, batch, cuts, []);
      panels += paving.build(owner, batch, features, planned.map(r => r.cut.ring));
      ramps.draw(planned, batch);
      for (const f of features) if (f.cut) batch.polygon('darkMetal', intersection([f.cut.ring], owner.ground.map(g => g.ring)), top - 0.195, p => p, true, true);
      const colors = palette(owner, a);
      for (const mesh of batch.finish().meshes) {
        if (mesh.surface === 'curb') mesh.surface = colors.curb;
        if (mesh.surface === 'gutter') mesh.surface = colors.gutter;
      }
    } else {
      asphalt(owner, batch, []); panels += parking(owner, batch);
      edges.build(owner, batch, cuts, []); panels += sourcePaving.build(owner, batch, cuts, []);
      for (const cut of cuts) batch.polygon('darkMetal', intersection([cut.ring], owner.ground.map(g => g.ring)), top - 0.195, p => p, true, true);
    }
    if (!plain) markings.build(owner, batch);
    const output = batch.finish();
    output.meshes = output.meshes.filter(mesh => !plain || mesh.collision).map(mesh => unitBounds(mesh, a.bounds)).filter(mesh => mesh.positions.length);
    outputs.push(output);
  }
  return { geometry: pieceGeometry('unit', outputs), footprint: canonical(union(outputs.flatMap(o => o.coverage.flatMap(c => c.rings)))), panels };
}
