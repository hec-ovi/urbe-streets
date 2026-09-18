import type { Box3, Ring } from '../geometry/schema.ts';
import type { NativeMaterialCatalog } from './native-materials.ts';
import type { StreetClosure, StreetKit, StreetPlacements, StreetProfileMapping } from './street-kit.ts';
import type { WearSnapshot } from '../construction/style/schema.ts';

export interface NativeStreetGround {
  id: string;
  sourceIndex: number;
  ownerId: string;
  role: 'roadway' | 'sidewalk' | 'curb' | 'gutter';
  polygon: Ring;
  /** Original reservation levels. Physical surface/collision heights are carried by the mesh. */
  bottom: number;
  top: number;
}
export type NativeStreetFeature = {
  id: string;
  ownerId: string;
  style: number;
  length: number;
  depth: number;
  /** City-frame envelope of the constructed feature, rounded outward to millimetres. */
  bounds: Box3;
  /** Complete reserved plan footprint, independent of resident asset cells. */
  footprint: Ring;
} & (
  | { kind: 'guard' | 'inlet' | 'channel' | 'cable' | 'marquee' | 'tree-grate'; frontageId: string; roadId?: never }
  | { kind: 'access'; frontageId: null; /** References Atlas streets.edges[].id. */ roadId: string }
);
/**
 * Catalog and delegated hashes use SHA-256 over UTF-8 JSON.stringify of the exact parsed
 * binding/infrastructure value, retaining property and array order, with no indentation or newline.
 * GLB SHA-256 uses exact file bytes. Native GLB nodes and primitives carry streetCollision:boolean;
 * materials carry streetNativeSurface:string. Apply the complete GLB node transforms followed by the placement transform.
 */
export interface NativeStreetManifest {
  meta: {
    version: '0.4.0'; generatorVersion: string; architectureVersion: '0.26.0'; reservationVersion: '2.1.0';
    designVersion: 'native-1.0.0'; blueprintHash: string; blueprintEncoding: 'json-file-bytes' | 'json-stringify-utf8';
    nativeCatalogHash: string; seed: number; identity: string; units: 'meters';
  };
  kit: StreetKit;
  placements: StreetPlacements;
  files: { kit: 'streets/kit.json'; placements: 'streets/placements.json' };
  closures: StreetClosure[];
  report: { profiles: StreetProfileMapping[] };
  ground: {
    owners: NativeStreetGround[];
    replacements: { groundIndices: number[]; moduleOwnerIds: string[] };
    exclusions: { id: string; kind: 'station-shaft'; stationId: string; polygon: Ring }[];
    cover: { reservedArea: number; excludedArea: number; constructedArea: number; missingArea: number; outsideArea: number };
  };
  features: NativeStreetFeature[];
  materials: { mode: 'native-reference'; binding: NativeMaterialCatalog };
  wear: WearSnapshot & { application: 'world-position' };
  protected: { kind: 'highway' | 'underpass' | 'station-bay' | 'station-shaft'; source: Record<string, unknown> }[];
  delegated: {
    highways: { source: 'streets.highwayStructures'; hash: string; count: number };
    stations: { source: 'transit.subwayStations'; hash: string; stationIds: string[] };
    /** Engine may retain only these original ground records alongside the native street surface. */
    remainingGroundIndices: number[];
  };
  statistics: { pieceBytes: number; placements: number; placementBytes: number; pieces: number; triangles: number; materials: number; groundOwners: number; features: number; panels: number };
}
export interface NativeStreetBuild extends NativeStreetManifest { assets: Record<string, Uint8Array> }
