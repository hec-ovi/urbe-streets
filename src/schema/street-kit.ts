import type { Box3, Ring, Vec2, Vec3 } from '../geometry/schema.ts';

export type StreetClass = 'street' | 'road' | 'alley';
export interface StreetProfile {
  id: string; streetClass: StreetClass; zone: string; lanes: number; laneWidth: number;
  width: number; medianWidth: number; pavedWidth: number; curbWidth: number; gutterWidth: number;
}
export interface StreetProfileMapping { roadId: string; profileId: string; requestedWidth: number; width: number; delta: number }
export interface StreetKitPiece {
  id: string;
  file: string;
  kind: 'segment' | 'junction-arm' | 'junction-center' | 'prop' | 'overlay';
  classes: StreetClass[];
  zone: string;
  variant: string;
  length: number;
  size: Vec3;
  origin: 'run-start-at-road' | 'junction-at-road' | 'anchor-at-road';
  bounds: Box3;
  footprint: Ring[];
  surfaces: string[];
  hasCollision: boolean;
  triangles: number;
  bytes: number;
  sha256: string;
  profileId?: string;
}
export interface StreetKit {
  version: '1.2.0'; units: 'meters'; module: 8; profiles: StreetProfile[]; pieces: StreetKitPiece[];
  /** Equal horizontal UV cells, resolved once from the native material binding. */
  scanAtlas: string[];
  glyphs: string;
}
export interface StreetPlacement {
  piece: string;
  position: Vec3;
  rotationY: number;
  scale?: Vec3;
  cell: Vec2;
  ownerId: string;
  ownerIds: string[];
  tint?: Vec3;
  wear?: number;
  scan?: { offset: Vec2; scale: Vec2 };
  text?: number[];
}
export interface StreetPlacements { version: '1.2.0'; cellSize: 128; placements: StreetPlacement[] }
export interface StreetOverhang {
  placement: number; piece: string; boundaryArea: number; fringeArea: number;
}
export interface StreetOverhangReport {
  accepted: StreetOverhang[];
  boundaryArea: number; fringeArea: number; overlapArea: number;
}
export interface StreetClosure {
  roadId: string; length: number; start: number; end: number; clearLength: number;
  segments: number; halfSegments: number; quarterSegments: number;
  /** Plain remainder in metres, zero when whole pieces fill the run. */
  fittedLength: number;
}
