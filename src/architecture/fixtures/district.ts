import type { Ring } from '../../geometry/schema.ts';
import { nativeBlueprint } from './native.ts';

/** One divided avenue, a district frontage with parking, and its physical median owner. */
export function districtBlueprint() {
  const source = nativeBlueprint();
  const rectangle = (x: number, z: number, width: number, depth: number): Ring => [[x, z], [x + width, z], [x + width, z + depth], [x, z + depth]];
  const footprint = rectangle(10, 8.3, 20, 3.4), paving = rectangle(10.7, 9, 18.6, 2);
  const parking: Ring = [[8, 19.4], [18, 19.4], [16, 21.4], [10, 21.4]];
  const ground: { surface: string; polygon: Ring; bottom: number; top: number; moduleBlockId: string }[] = [];
  function owner(id: string, kind: string, fields: { surface: string; polygons: Ring[]; top: number }[]) {
    const groundIndices: number[] = [];
    for (const field of fields) for (const polygon of field.polygons) {
      groundIndices.push(ground.length);
      ground.push({ surface: field.surface, polygon, top: field.top, bottom: -0.2, moduleBlockId: id });
    }
    return { id, kind, groundIndices, excludedParcelIds: [], interiors: [], finish: kind === 'roadway' ? null : 'luxury-blue' };
  }
  const owners = [
    owner('roadway', 'roadway', [{ surface: 'roadway', polygons: [rectangle(0, 1.3, 40, 7), rectangle(0, 11.7, 40, 7),
      rectangle(0, 8.3, 10, 3.4), rectangle(30, 8.3, 10, 3.4)], top: 0 }]),
    owner('block', 'block', [
      { surface: 'sidewalk', polygons: [[[0, 19.4], [8, 19.4], [10, 21.4], [16, 21.4], [18, 19.4], [40, 19.4], [40, 23.6], [0, 23.6]]], top: 0.2 },
      { surface: 'curb', polygons: [rectangle(0, 19.2, 40, 0.2)], top: 0.2 },
      { surface: 'gutter', polygons: [rectangle(0, 18.7, 40, 0.5)], top: 0 },
      { surface: 'roadway', polygons: [parking], top: 0 },
    ]),
    owner('median:e0', 'median', [
      { surface: 'sidewalk', polygons: [structuredClone(paving)], top: 0.2 },
      { surface: 'curb', polygons: [rectangle(10.5, 8.8, 19, 0.2), rectangle(10.5, 11, 19, 0.2),
        rectangle(10.5, 9, 0.2, 2), rectangle(29.3, 9, 0.2, 2)], top: 0.2 },
      { surface: 'gutter', polygons: [rectangle(10, 8.3, 20, 0.5), rectangle(10, 11.2, 20, 0.5),
        rectangle(10, 8.8, 0.5, 2.4), rectangle(29.5, 8.8, 0.5, 2.4)], top: 0 },
    ]),
  ];
  const lanes = [6.95, 3.45, -3.45, -6.95].map((offset, i) => ({ id: `e0.v${i}`, offset, width: 3.5,
    direction: i < 2 ? 'backward' : 'forward', path: i < 2 ? [[40, 10 + offset], [0, 10 + offset]] : [[0, 10 + offset], [40, 10 + offset]] }));
  return { ...source,
    meta: { ...source.meta, version: '0.23.0', bounds: { min: [0, 0], max: [40, 25] }, boundary: rectangle(0, 0, 40, 25) },
    streets: { ...source.streets,
      nodes: [{ id: 'n0', position: [0, 10] }, { id: 'n1', position: [40, 10] }],
      edges: [{ ...source.streets.edges[0]!, class: 'road', path: [[0, 10], [40, 10]], width: 17.4, districtStyle: 'luxury',
        crossSection: { median: { width: 3.4 } }, elevationProfile: [{ distance: 0, level: 0 }, { distance: 40, level: 0 }] }],
      construction: { ...source.streets.construction,
        modules: { ...source.streets.construction.modules, format: 'district' },
        runs: [{ id: 'r0', edges: [{ edgeId: 'e0', start: 0, end: 40, forward: true }] }],
        medians: [{ id: 'median:e0', edgeId: 'e0', start: 10, end: 30, width: 3.4, pavedWidth: 2, curbWidth: 0.2, gutterWidth: 0.5,
          footprint, paving, ornaments: [{ kind: 'tree', position: [14, 10] }, { kind: 'pole', position: [26, 10] }] }],
        reservations: { ...source.streets.construction.reservations,
          groundArray: { path: 'volumetric.ground', count: ground.length }, owners,
          frontages: [{ id: 'frontage:block', ownerId: 'block', edgeIds: ['e0'], start: [0, 18.7], end: [40, 18.7], inward: [0, 1],
            stationRange: [0, 40], moduleStationOffset: 0, pavedWidth: 4.2, roadTop: 0, pavedTop: 0.2, curbWidth: 0.2, gutterWidth: 0.5, cornerIds: [null, null] }],
          parking: [{ id: 'parking:block', ownerId: 'block', frontageId: 'frontage:block', start: 8, end: 18, support: { start: 6, end: 20 },
            slotCount: 1, slotLength: 6, depth: 2, endRun: 2, walkingClearance: 2.2, footprint: parking, slots: [rectangle(10, 19.4, 6, 2)] }],
        },
      },
    },
    architecture: { ...source.architecture, edges: [{ edgeId: 'e0', lanes }] },
    volumetric: { ground },
  };
}
