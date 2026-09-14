import type { Box3, Ring, Vec3 } from '../geometry/schema.ts';
import type { NativeMaterialCatalog } from './native-materials.ts';
import type { WearSnapshot } from '../construction/style/schema.ts';

export interface NativeStreetPiece {
  id: string;
  /** Relative to the street bundle directory. Both are null in manifest mode. */
  asset: string | null;
  sha256: string | null;
  bounds: Box3;
  /** GLB node translation restores this city-frame origin; vertex positions are relative to it. */
  origin: Vec3;
  ownerIds: string[];
  groundIds: string[];
  surfaceIds: string[];
  hasCollision: boolean;
  triangles: number;
}
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
export interface NativeStreetFeature {
  id: string;
  kind: 'guard' | 'inlet' | 'channel' | 'access';
  ownerId: string;
  frontageId: string;
  style: number;
  length: number;
  depth: number;
  /** City-frame envelope of the constructed feature, rounded outward to millimetres. */
  bounds: Box3;
  /** Complete reserved plan footprint, independent of resident asset cells. */
  footprint: Ring;
}
export interface NativeStreetManifest {
  meta: {
    version: '0.2.0'; generatorVersion: string; architectureVersion: '0.22.0'; reservationVersion: '1.0.0';
    designVersion: 'native-1.0.0'; blueprintHash: string; blueprintEncoding: 'json-file-bytes' | 'json-stringify-utf8';
    nativeCatalogHash: string; seed: number; identity: string; units: 'meters';
  };
  pieces: NativeStreetPiece[];
  ground: {
    owners: NativeStreetGround[];
    replacements: { groundIndices: number[]; moduleOwnerIds: string[] };
    exclusions: { id: string; kind: 'station-shaft'; stationId: string; polygon: Ring }[];
    cover: { reservedArea: number; excludedArea: number; constructedArea: number; missingArea: number; outsideArea: number };
  };
  features: NativeStreetFeature[];
  materials: { mode: 'native-reference'; binding: NativeMaterialCatalog };
  wear: WearSnapshot;
  protected: { kind: 'highway' | 'underpass' | 'station-bay' | 'station-shaft'; source: Record<string, unknown> }[];
  delegated: {
    highways: { source: 'streets.highwayStructures'; hash: string; count: number };
    stations: { source: 'transit.subwayStations'; hash: string; stationIds: string[] };
    /** Engine may retain only these original ground records alongside the native street surface. */
    remainingGroundIndices: number[];
  };
  statistics: { pieces: number; triangles: number; materials: number; groundOwners: number; features: number; panels: number };
}
export interface NativeStreetBuild extends NativeStreetManifest { assets: Record<string, Uint8Array> }
