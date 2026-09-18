import type { Box3, Ring, Vec2, Vec3 } from '../geometry/schema.ts';

export type StreetClass = 'street' | 'road' | 'alley';
export interface StreetKitPiece {
  id: string;
  file: string;
  kind: 'segment' | 'junction-arm' | 'junction-center' | 'prop' | 'marking';
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
}
export interface StreetKit { version: '1.0.0'; units: 'meters'; module: 8; pieces: StreetKitPiece[] }
export interface StreetPlacement {
  piece: string;
  position: Vec3;
  rotationY: number;
  cell: Vec2;
  ownerId: string;
  ownerIds: string[];
  featureId?: string;
  scale?: Vec3;
}
export interface StreetPlacements { version: '1.0.0'; cellSize: 128; placements: StreetPlacement[] }
export interface StreetClosure {
  roadId: string; length: number; start: number; end: number; clearLength: number;
  segments: number; halfSegments: number; quarterSegments: number;
  /** Plain remainder in metres, zero when whole pieces fill the run. */
  fittedLength: number;
}
