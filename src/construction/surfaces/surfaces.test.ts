import { BoxGeometry } from 'three';
import { expect, it } from 'vitest';
import { SurfaceBatch } from './SurfaceBatch.ts';
import { rectangle } from '../../geometry/polygons.ts';
import { area, triangles } from './Regions.ts';

const batch = () => new SurfaceBatch({ ownerId: 'owner', groundIds: ['ground'], roadTop: 10, wear: p => (p[0] + p[1]) / 40 });

it('triangulates receiving surfaces around explicit holes and preserves source vertex attributes', () => {
  const source = batch(), outer = rectangle(0, 0, 20, 20), hole = [...rectangle(8, 8, 4, 4)].reverse();
  const rings = [outer, hole];
  expect(triangles(rings).reduce((sum, triangle) => sum + area(triangle), 0)).toBe(384);
  source.polygon('ordinary', rings, 10.2, p => [p[0] / 20, p[1] / 20], true, true);
  const result = source.finish(), mesh = result.meshes[0]!;
  expect(mesh.ownerIds).toEqual(['owner']); expect(mesh.groundIds).toEqual(['ground']);
  expect(mesh.positions.length / 3).toBe(mesh.wear.length);
  expect(mesh.heights.every(height => Math.abs(height - 0.2) < 1e-10)).toBe(true);
  expect(mesh.normals.filter((_, i) => i % 3 === 1).every(n => n === 1)).toBe(true);
  expect(new Set(mesh.wear).size).toBeGreaterThan(2);
  expect(result.coverage[0]!.rings).toEqual(rings);
});

it('constructs the source six-centimetre gutter rise with outward physical normals', () => {
  const source = batch();
  source.polygon('gutter', [rectangle(0, 0, 2, 0.3)], p => 10 + p[1] * 0.2, p => [p[0] / 2, p[1] / 0.3], true, true);
  const mesh = source.finish().meshes[0]!;
  expect(Math.max(...mesh.heights)).toBeCloseTo(0.06);
  expect(Math.min(...mesh.heights)).toBe(0);
  for (let i = 0; i < mesh.normals.length; i += 3) {
    expect(mesh.normals[i]).toBeCloseTo(0);
    expect(mesh.normals[i + 1]).toBeCloseTo(1 / Math.sqrt(1.04));
    expect(mesh.normals[i + 2]).toBeCloseTo(-0.2 / Math.sqrt(1.04));
  }
});

it('places original geometry while retaining local height and separates noncolliding paint', () => {
  const source = batch(), geometry = new BoxGeometry(2, 0.2, 1).translate(0, 0.1, 0.5);
  source.geometry('metal', geometry, { origin: [5, 4, 7], inward: [1, 0] });
  source.polygon('whitePaint', [rectangle(0, 0, 1, 1)], 10.005, p => p, false);
  const meshes = source.finish().meshes, metal = meshes.find(mesh => mesh.surface === 'metal')!;
  const axis = (i: number) => metal.positions.filter((_, n) => n % 3 === i);
  expect([Math.min(...axis(0)), Math.max(...axis(0)), Math.min(...axis(2)), Math.max(...axis(2))]).toEqual([5, 6, 6, 8]);
  expect(Math.max(...metal.heights)).toBeCloseTo(0.2);
  expect(meshes.find(mesh => mesh.surface === 'whitePaint')!.collision).toBe(false);
  geometry.dispose();
});

it('rejects unsupported holes and degenerate surfaces without silent area loss', () => {
  expect(() => triangles([[...rectangle(0, 0, 1, 1)].reverse()])).toThrowError(expect.objectContaining({ code: 'E_INVARIANT' }));
  expect(() => batch().face('curb', [[0, 0, 0], [0, 0, 0], [0, 0, 0]], [[0, 0], [0, 0], [0, 0]]))
    .toThrowError(expect.objectContaining({ code: 'E_INVARIANT' }));
});
