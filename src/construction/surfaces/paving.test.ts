import { expect, it } from 'vitest';
import type { NativeFrontage, NativeOwner } from '../../architecture/native-schema.ts';
import type { Ring, Vec2 } from '../../geometry/schema.ts';
import { rectangle, totalArea } from '../../geometry/polygons.ts';
import { intersection } from './Regions.ts';
import { along } from './Frame.ts';
import { SurfaceBatch } from './SurfaceBatch.ts';
import { Paving } from './Paving.ts';
import { parking } from './Parking.ts';

const front = (): NativeFrontage => ({ id: 'f0', ownerId: 'owner', edgeIds: ['e0'], start: [0, 0], end: [12, 0], inward: [0, 1],
  length: 12, moduleStationOffset: 0, pavedWidth: 2, roadTop: 0, pavedTop: 0.2, curbWidth: 0.2, gutterWidth: 0.3, cornerIds: [null, null] });
const owner = (): NativeOwner => ({ id: 'owner', kind: 'block', finish: null, interiors: [], excludedParcelIds: [],
  frontages: [front()], corners: [], parking: [], guards: [],
  ground: [{ id: 'g0', sourceIndex: 0, ownerId: 'owner', surface: 'sidewalk', ring: rectangle(0, 0.5, 12, 2), bottom: 0, top: 0.2 }] });
const batch = () => new SurfaceBatch({ ownerId: 'owner', groundIds: ['g0'], roadTop: 0, wear: () => 0.5 });

it('fits source rows with full-panel UVs and a physical recessed joint bed', () => {
  const output = batch();
  expect(new Paving({ roads: [], stationBays: [] }, 42, () => 0.5).build(owner(), output, [], [])).toBeGreaterThan(0);
  const result = output.finish();
  expect(result.coverage.reduce((sum, c) => sum + totalArea(c.rings), 0)).toBe(24);
  expect(result.meshes.find(mesh => mesh.surface === 'joint')!.heights.every(height => height === 0.193)).toBe(true);
  for (const mesh of result.meshes.filter(mesh => mesh.surface !== 'joint')) {
    expect(mesh.heights.every(height => height === 0.2)).toBe(true);
    expect(mesh.uvs.every(uv => uv >= 0 && uv <= 1)).toBe(true);
  }
});

it('keeps only the authored-grid enclosure in terminal joints and rejects larger unplanned fields', () => {
  const source = owner(), face = source.frontages[0]!, n = Math.SQRT1_2;
  face.inward = [-n, n]; face.end = [12 * n, 12 * n];
  const shape = (offset: number): Ring => [along(face, 0, 0.5 + offset), along(face, 12, 0.5 + offset), along(face, 12, 2.5 + offset), along(face, 0, 2.5 + offset)];
  source.ground[0]!.ring = shape(0.0005);
  const paver = new Paving({ roads: [], stationBays: [] }, 42, () => 0.5);
  expect(() => paver.build(source, batch(), [], [])).not.toThrow();
  source.ground[0]!.ring = shape(0.01);
  expect(() => paver.build(source, batch(), [], [])).toThrowError(expect.objectContaining({ code: 'E_INVARIANT' }));
});

it('uses source square cuts, corner fans and accent strips over a rounded owner', () => {
  const source = owner(), centers: Vec2[] = [[2, 2], [18, 2], [18, 18], [2, 18]];
  const arc = (i: number, radius: number): Ring => Array.from({ length: 13 }, (_, step) => {
    const angle = Math.PI + i * Math.PI / 2 + step * Math.PI / 24;
    return [centers[i]![0] + radius * Math.cos(angle), centers[i]![1] + radius * Math.sin(angle)];
  });
  source.corners = centers.map((center, i) => ({ id: `c${i}`, ownerId: source.id, kind: 'arc', center, radius: 2.5, arc: arc(i, 2.5), frontageIds: [`f${(i + 3) % 4}`, `f${i}`] }));
  source.frontages = centers.map((_, i) => {
    const start = arc(i, 2.5).at(-1)!, end = arc((i + 1) % 4, 2.5)[0]!, length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    return { ...front(), id: `f${i}`, start, end, length, inward: [-(end[1] - start[1]) / length, (end[0] - start[0]) / length], cornerIds: [`c${i}`, `c${(i + 1) % 4}`] };
  });
  const outline = centers.flatMap((_, i) => arc(i, 2));
  const fields = [rectangle(0, 0, 20, 2), rectangle(18, 2, 2, 16), rectangle(0, 18, 20, 2), rectangle(0, 2, 2, 16)]
    .flatMap(mask => intersection([outline], [mask]));
  source.ground = fields.map((ring, sourceIndex) => ({ id: `g${sourceIndex}`, sourceIndex, ownerId: source.id, surface: 'sidewalk', ring, bottom: 0, top: 0.2 }));
  source.interiors = [rectangle(2, 2, 16, 16)];
  const output = batch();
  expect(new Paving({ roads: [], stationBays: [] }, 42, () => 0.5).build(source, output, [], [])).toBeGreaterThan(40);
  expect(output.finish().meshes.some(mesh => ['oxblood', 'terracotta'].includes(mesh.surface))).toBe(true);
});

it('fits station receiving panels around the declared shaft opening', () => {
  const source = owner(); source.kind = 'station'; source.frontages = []; source.ground[0]!.ring = rectangle(0, 0, 10, 5);
  const shaft = rectangle(1, 1, 8, 3), output = batch();
  const paver = new Paving({ roads: [], stationBays: [{ id: 'bay', stationId: 'station', edgeId: 'e0', footprint: source.ground[0]!.ring, shaft, approach: [[5, 0], [5, 2.5]] }] }, 42, () => 0.5);
  expect(paver.build(source, output, [], [shaft])).toBeGreaterThan(0);
  expect(output.finish().coverage.reduce((sum, claim) => sum + totalArea(claim.rings), 0)).toBe(26);
});

it('maps source parking panels at three by two-and-a-half metres through diagonal ends', () => {
  const source = owner(), face = source.frontages[0]!; face.length = 34; face.end = [34, 0]; face.pavedWidth = 6;
  const footprint: Ring = [[8, 0], [24, 0], [22, 2.5], [10, 2.5]];
  source.parking = [{ id: 'bay', ownerId: source.id, frontageId: face.id, start: 8, end: 24, support: { start: 6, end: 26 }, slotCount: 2, depth: 2.5, footprint, slots: [rectangle(10, 0, 6, 2.5), rectangle(16, 0, 6, 2.5)] }];
  const output = batch(); expect(parking(source, output)).toBe(6);
  const result = output.finish(); expect(result.coverage.reduce((sum, claim) => sum + totalArea(claim.rings), 0)).toBe(35);
  expect(result.meshes.map(mesh => mesh.surface)).toEqual(['parking']);
  expect(result.meshes[0]!.heights.every(height => height === 0.001)).toBe(true);
  expect(result.meshes[0]!.uvs.every(uv => uv >= 0 && uv <= 1)).toBe(true);
});
