import type { Box3, Ring, Vec2 } from '../geometry/schema.ts';
import type { MaterialBinding } from './materials.ts';
import type { FinishRole } from './request.ts';

export interface GroundOwner {
  id: string;
  sourceIds: string[];
  role: 'roadway' | 'paved' | 'curb' | 'gutter' | 'support' | 'joint' | 'gutter-lip';
  ring: Ring;
  bottom: number;
  top: number;
}
export interface StreetPiece {
  id: string;
  kind: 'block-frontage' | 'junction' | 'crossing' | 'highway-run' | 'underpass';
  sourceIds: string[];
  bounds: Box3;
  asset: string | null;
  groundIds: string[];
}
export interface ConstructionRecord {
  id: string;
  sourceIds: string[];
  role: FinishRole;
  material: string;
  variant: string;
  /** Shared source module frame; splitting assets preserves this mapping. */
  origin: Vec2;
  turn: number;
}
export interface StreetManifest {
  meta: {
    version: string;
    generatorVersion: string;
    architectureVersion: string;
    designVersion: string;
    catalogHash: string;
    seed: number;
    identity: string;
    units: 'meters';
  };
  pieces: StreetPiece[];
  ground: {
    owners: GroundOwner[];
    cover: { reservedArea: number; coveredArea: number; difference: number };
  };
  construction: ConstructionRecord[];
  textures: { mode: 'catalog-reference'; reason: string; catalogHash: string; bindings: MaterialBinding[] };
  capabilities: {
    turnMovements: false;
    walkingLanes: false;
    modules: boolean;
    highways: false;
    stations: false;
    furniture: false;
    omissions: string[];
  };
  statistics: { pieces: number; triangles: number; materials: number; groundOwners: number };
}
export interface StreetBuild extends StreetManifest {
  /** GLBs indexed by their relative manifest paths. Empty in manifest mode or with outDir. */
  assets: Record<string, Uint8Array>;
}
