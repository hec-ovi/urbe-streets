import type { Box3, Ring, Vec2, Vec3 } from '../geometry/schema.ts';
import type { NativeApproach, NativeRoad, NativeTurn } from '../architecture/native-schema.ts';

export type StreetClass = 'street' | 'road' | 'alley';
export interface StreetProfile {
  id: string; streetClass: StreetClass; zone: string; lanes: number; laneWidth: number;
  width: number; medianWidth: number; pavedWidth: number; curbWidth: number; gutterWidth: number;
}
export interface StreetProfileMapping { roadId: string; profileId: string; requestedWidth: number; width: number; delta: number }
export interface StreetKitPiece {
  id: string;
  file: string;
  kind: 'segment' | 'junction-arm' | 'junction-center' | 'prop';
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
  configurations?: { id: string; footprint: Ring[] }[];
}
export interface StreetKit { version: '1.1.0'; units: 'meters'; module: 8; profiles: StreetProfile[]; pieces: StreetKitPiece[] }
export interface StreetScan {
  surface: string; position: Vec3; rotationY: number; size: Vec2; clip: Ring[];
}
export interface StreetPlacement {
  piece: string;
  position: Vec3;
  rotationY: number;
  cell: Vec2;
  ownerId: string;
  ownerIds: string[];
  featureId?: string;
  scale?: Vec3;
  configuration?: string;
  /** Local translation applied before scale, rotation and position. */
  offset?: Vec2;
  /** Receiving polygons in placement coordinates after local offset and scale. */
  clip?: Ring[];
  markings?: { seed: number; domain: Ring[]; roadTop: number; roads: NativeRoad[]; approaches: NativeApproach[]; turns: NativeTurn[] };
  scans?: StreetScan[];
  message?: string;
  wear?: number;
  openings?: Ring[];
  finishes?: { finish: string; clip: Ring[] }[];
  panels?: { surface: string; clip: Ring[]; height: number }[];
}
export interface StreetPlacements { version: '1.1.0'; cellSize: 128; placements: StreetPlacement[] }
export interface StreetClosure {
  roadId: string; length: number; start: number; end: number; clearLength: number;
  segments: number; halfSegments: number; quarterSegments: number;
  /** Plain remainder in metres, zero when whole pieces fill the run. */
  fittedLength: number;
}
