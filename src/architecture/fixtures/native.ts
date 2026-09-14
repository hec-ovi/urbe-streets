/** Small public-shape input for adapter and export conformance. */
export function nativeBlueprint() {
  return {
    meta: { version: '0.22.0', units: 'meters', seed: 'test', bounds: { min: [0, 0], max: [20, 20] }, boundary: [[0, 0], [20, 0], [20, 20], [0, 20]] },
    streets: {
      nodes: [{ id: 'n0', position: [0, 10] }, { id: 'n1', position: [20, 10] }],
      edges: [{ id: 'e0', from: 'n0', to: 'n1', class: 'street', path: [[0, 10], [20, 10]], width: 7, level: 0,
        elevationProfile: [{ distance: 0, level: 0 }, { distance: 20, level: 0 }] }],
      highwayStructures: [], crossings: [], signals: [], planting: [] as { kind: 'tree' | 'pole' | 'bin'; position: number[]; edgeId: string; spacing: number }[],
      construction: { modules: { version: '1.0.0', definitions: [], placements: [] },
        runs: [{ id: 'r0', edges: [{ edgeId: 'e0', start: 0, end: 20, forward: true }] }], junctions: [],
        reservations: { version: '1.0.0', groundArray: { path: 'volumetric.ground', count: 1 },
          owners: [{ id: 'roadway', kind: 'roadway', groundIndices: [0], excludedParcelIds: [], interiors: [], finish: null }],
          frontages: [], corners: [], parking: [], protected: [] } },
    },
    architecture: { version: '1.0.0', edges: [{ edgeId: 'e0', lanes: [
      { id: 'e0.v0', offset: 1.75, width: 3.5, direction: 'backward', path: [[20, 11.75], [0, 11.75]] },
      { id: 'e0.v1', offset: -1.75, width: 3.5, direction: 'forward', path: [[0, 8.25], [20, 8.25]] },
    ] }], nodes: [{ nodeId: 'n0', turns: [] }, { nodeId: 'n1', turns: [] }] },
    transit: { subwayStations: [] }, parcels: [],
    volumetric: { ground: [{ surface: 'roadway', polygon: [[0, 0], [20, 0], [20, 20], [0, 20]], bottom: -0.2, top: 0 }] },
  };
}
