import { expect, it } from 'vitest';
import { rectangle, totalArea } from '../../geometry/polygons.ts';
import type { NativeOwner } from '../../architecture/native-schema.ts';
import { SurfaceBatch } from './SurfaceBatch.ts';
import { EdgeRing } from './EdgeRing.ts';

function fixture(): NativeOwner[] {
  const common = { finish: null, interiors: [], excludedParcelIds: [], corners: [], parking: [], guards: [] };
  return [
    { ...common, id: 'road', kind: 'roadway', frontages: [], ground: [{ id: 'g0', sourceIndex: 0, ownerId: 'road', surface: 'roadway', ring: rectangle(-1, -2, 4, 2), bottom: -0.2, top: 0 }] },
    { ...common, id: 'side', kind: 'block', frontages: [{ id: 'f0', ownerId: 'side', edgeIds: ['e0'], start: [0, 0], end: [2, 0], inward: [0, 1], length: 2,
      moduleStationOffset: 0, pavedWidth: 2, roadTop: 0, pavedTop: 0.2, curbWidth: 0.2, gutterWidth: 0.3, cornerIds: [null, null] }], ground: [
      { id: 'g1', sourceIndex: 1, ownerId: 'side', surface: 'gutter', ring: rectangle(0, 0, 2, 0.3), bottom: -0.03, top: 0 },
      { id: 'g2', sourceIndex: 2, ownerId: 'side', surface: 'curb', ring: rectangle(0, 0.3, 2, 0.2), bottom: -0.03, top: 0.2 },
    ] },
  ];
}

it('fits source curb stations and sloped gutters over complete authoritative bands', () => {
  const owners = fixture(), owner = owners[1]!, batch = new SurfaceBatch({ ownerId: owner.id, groundIds: ['g1', 'g2'], roadTop: 0, wear: () => 0.5 });
  new EdgeRing({ owners }).build(owner, batch, [], []);
  const output = batch.finish();
  expect(output.coverage.reduce((sum, claim) => sum + totalArea(claim.rings), 0)).toBeCloseTo(1, 8);
  const gutter = output.meshes.find(mesh => mesh.surface === 'gutter')!;
  expect(Math.max(...gutter.heights)).toBeCloseTo(0.06);
  expect(Math.min(...gutter.heights)).toBe(0);
  expect(gutter.normals.filter((_, i) => i % 3 === 2).every(n => Math.abs(n + 0.2 / Math.sqrt(1.04)) < 1e-8)).toBe(true);
  const curb = output.meshes.find(mesh => mesh.surface === 'curb')!;
  expect(Math.max(...curb.heights)).toBe(0.2);
  expect(Math.min(...curb.positions.filter((_, i) => i % 3 === 0))).toBeCloseTo(0.003);
});

it('keeps exact inlet openings and closes the gutter ends above the sunk pan', () => {
  const owners = fixture(), owner = owners[1]!, batch = new SurfaceBatch({ ownerId: owner.id, groundIds: ['g1', 'g2'], roadTop: 0, wear: () => 0.5 });
  new EdgeRing({ owners }).build(owner, batch, [{ id: 'inlet', kind: 'inlet', frontageId: 'f0', start: 0.5, end: 1.5, setback: 0, depth: 0.5, ring: rectangle(0.5, 0, 1, 0.5) }], []);
  const output = batch.finish(), gutter = output.meshes.find(mesh => mesh.surface === 'gutter')!;
  expect(output.coverage.reduce((sum, claim) => sum + totalArea(claim.rings), 0)).toBeCloseTo(0.5, 8);
  expect(Math.min(...gutter.heights)).toBe(-0.02);
  expect(gutter.normals.some((n, i) => i % 3 === 0 && n === 1)).toBe(true);
  expect(gutter.normals.some((n, i) => i % 3 === 0 && n === -1)).toBe(true);
  expect(gutter.normals.some((n, i) => i % 3 === 2 && n === 1)).toBe(true);
});
