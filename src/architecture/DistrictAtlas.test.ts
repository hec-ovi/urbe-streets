import { expect, it } from 'vitest';
import { readNativeAtlas } from './NativeAtlas.ts';
import { districtBlueprint } from './fixtures/district.ts';

it('reads district sidewalks, parking and a physical median without changing their geometry', async () => {
  const input = districtBlueprint(), before = structuredClone(input);
  const result = await readNativeAtlas(input);
  expect(result.format).toBe('district');
  expect(result.roads[0]).toMatchObject({ id: 'e0', kind: 'road', width: 17.4, districtStyle: 'luxury', medianWidth: 3.4 });
  expect(result.roads[0]!.lanes.map(lane => lane.offset)).toEqual([6.95, 3.45, -3.45, -6.95]);
  const block = result.owners.find(owner => owner.id === 'block')!;
  expect(block.frontages[0]).toMatchObject({ pavedWidth: 4.2, curbWidth: 0.2, gutterWidth: 0.5 });
  expect(block.parking[0]).toMatchObject({ depth: 2, slotCount: 1, start: 8, end: 18, support: { start: 6, end: 20 } });
  expect(result.medians).toEqual([{ id: 'median:e0', edgeId: 'e0', start: 10, end: 30,
    footprint: before.streets.construction.medians[0]!.footprint, paving: before.streets.construction.medians[0]!.paving,
    ornaments: [{ kind: 'tree', position: [14, 10] }, { kind: 'pole', position: [26, 10] }] }]);
  expect(input).toEqual(before);
  input.streets.construction.medians[0]!.ornaments[0]!.position[0] = 0;
  expect(result.medians![0]!.ornaments[0]!.position).toEqual([14, 10]);
});

type Fixture = ReturnType<typeof districtBlueprint>;
const invalid: { name: string; path: string; change: (input: Fixture) => void }[] = [
  { name: 'null format', path: 'construction.modules.format', change: source => { Object.assign(source.streets.construction.modules, { format: null }); } },
  { name: 'non-string style', path: 'edges.e0.districtStyle', change: source => { Object.assign(source.streets.edges[0]!, { districtStyle: ['luxury'] }); } },
  { name: 'null median', path: 'edges.e0.median', change: source => { Object.assign(source.streets.edges[0]!.crossSection, { median: null }); } },
  { name: 'lane inside median', path: 'edges.e0.median', change: source => { source.architecture.edges[0]!.lanes[1]!.offset = 1.75; } },
  { name: 'missing median source', path: 'construction.medians', change: source => { source.streets.construction.medians = []; } },
  { name: 'median source outside declared stations', path: 'median.stations', change: source => { source.streets.construction.medians[0]!.start = 9; } },
  { name: 'median source different from physical paving', path: 'median.footprint', change: source => {
    const owner = source.streets.construction.reservations.owners.find(owner => owner.kind === 'median')!;
    const field = source.volumetric.ground[owner.groundIndices[0]!]!;
    field.polygon = field.polygon.map(([x, z], index) => [index === 0 ? x + 0.1 : x, z]);
  } },
  { name: 'ornament outside median paving', path: 'median.ornaments', change: source => { source.streets.construction.medians[0]!.ornaments[0]!.position = [14, 13]; } },
];
it.each(invalid)('rejects $name at the adapter boundary', async ({ path, change }) => {
  const input = districtBlueprint(); change(input);
  await expect(readNativeAtlas(input)).rejects.toMatchObject({ code: 'E_UNSUPPORTED_ARCHITECTURE', details: { path } });
});
