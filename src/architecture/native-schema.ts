import type { Box2, Ring, Vec2 } from '../geometry/schema.ts';
export interface NativeIdentity { hash: string; encoding: 'json-file-bytes' | 'json-stringify-utf8' }
export interface NativeGround { id: string; sourceIndex: number; ownerId: string; surface: 'roadway' | 'sidewalk' | 'curb' | 'gutter'; ring: Ring; bottom: number; top: number }
export interface NativeFrontage {
  id: string; ownerId: string; edgeIds: string[]; start: Vec2; end: Vec2; inward: Vec2;
  length: number; moduleStationOffset: number; pavedWidth: number; roadTop: number; pavedTop: number;
  curbWidth: number; gutterWidth: number; cornerIds: [string | null, string | null];
}
export type NativeCorner = { id: string; ownerId: string; frontageIds: string[] } & (
  | { kind: 'arc'; center: Vec2; radius: number; arc: Ring }
  | { kind: 'explicit'; boundary: Ring }
);
export interface NativeParking {
  id: string; ownerId: string; frontageId: string; start: number; end: number;
  support: { start: number; end: number }; slotCount: number; depth: number; footprint: Ring; slots: Ring[];
}
export interface NativeGuard { moduleId: string; ownerId: string; origin: Vec2; turn: number; count: number; step: number }
export interface NativeOwner {
  id: string; kind: 'block' | 'perimeter' | 'underpass' | 'roadway' | 'station' | 'median'; finish: string | null;
  ground: NativeGround[]; interiors: Ring[]; excludedParcelIds: string[];
  frontages: NativeFrontage[]; corners: NativeCorner[]; parking: NativeParking[]; guards: NativeGuard[];
}
export interface NativeLane { id: string; offset: number; width: number; direction: 'forward' | 'backward'; path: Ring }
export interface NativeRoad {
  id: string; from: string; to: string; kind: 'street' | 'road' | 'highway' | 'alley'; path: Ring; width: number;
  lanes: NativeLane[]; runId: string; runStart: number; runForward: boolean;
  districtStyle?: 'luxury' | 'industrial' | 'ordinary';
  medianWidth?: number;
}
export interface NativeMedian {
  id: string; edgeId: string; footprint: Ring; paving: Ring; start: number; end: number;
  ornaments: { kind: 'tree' | 'pole'; position: Vec2 }[];
}
export interface NativeApproach { id: string; nodeId: string; edgeId: string; distance: number; station: Vec2; field: Ring; landings: Ring[] }
export interface NativeTurn { nodeId: string; fromLaneId: string; toLaneId: string; kind: 'through' | 'left' | 'right' | 'u-turn'; level: number }
export interface NativeStationBay { id: string; stationId: string; edgeId: string; footprint: Ring; shaft: Ring; approach: Ring }
export interface NativeShaft { id: string; stationId: string; ring: Ring }
export interface NativeProtection { kind: 'highway' | 'underpass' | 'station-bay' | 'station-shaft'; source: Record<string, unknown> }
export interface NativeArchitecture {
  format?: 'source' | 'district';
  medians?: NativeMedian[];
  version: '0.26.0'; reservationVersion: '2.1.0'; identity: NativeIdentity; bounds: Box2; boundary: Ring;
  groundArrayCount: number; owners: NativeOwner[]; roads: NativeRoad[]; approaches: NativeApproach[]; turns: NativeTurn[];
  shafts: NativeShaft[]; stationBays: NativeStationBay[]; protections: NativeProtection[];
  obstaclePoints: { id: string; position: Vec2; clearance: number }[]; exclusions: Ring[];
  highwayHash: string; stationHash: string; remainingGroundIndices: number[];
}
