import type { Box2, Ring, Vec2 } from '../geometry/schema.ts';

export type DistrictKind = 'downtown' | 'commercial' | 'residential' | 'industrial' | 'mixed';
export type WealthTier = 'poor' | 'mid' | 'rich' | 'high_rich';
export type CorridorClass = 'street' | 'road' | 'highway' | 'alley';
export type Side = 'left' | 'right';
export type TravelDirection = 'forward' | 'backward';

export interface District {
  readonly id: string;
  readonly kind: DistrictKind;
  readonly tier: WealthTier;
  readonly boundary: Ring;
}

/** One travel lane, measured in its corridor's frame. +offset is left of travel. */
export interface Lane {
  readonly index: number;
  readonly offset: number;
  readonly width: number;
  readonly direction: TravelDirection;
}

/** A walking centerline Atlas published for one side. NPCs follow these. */
export interface WalkingLane {
  readonly index: number;
  readonly offset: number;
  readonly width: number;
}

export interface ElevationKnot {
  readonly distance: number;
  readonly level: number;
}

/** Total land Atlas reserved outside the carriageway on one side. */
export interface SideReservation {
  readonly width: number;
}

export interface Corridor {
  readonly id: string;
  readonly class: CorridorClass;
  readonly path: readonly Vec2[];
  readonly length: number;
  readonly carriageway: number;
  readonly reserved: Readonly<Record<Side, SideReservation>>;
  readonly lanes: readonly Lane[];
  readonly walking: Readonly<Record<Side, readonly WalkingLane[]>>;
  readonly elevation: readonly ElevationKnot[];
  readonly districtIds: readonly string[];
  readonly fromNodeId: string;
  readonly toNodeId: string;
}

/** One arm of a junction, as the junction sees it. */
export interface Approach {
  readonly id: string;
  readonly corridorId: string;
  readonly nodeId: string;
  readonly groupId: string;
  /** Distance along the corridor from its junction node to the stop line. */
  readonly distance: number;
  /** Outward direction of the arm, unit, from the junction centre. */
  readonly direction: Vec2;
  /** Where the corridor's two curb lines meet the junction, left and right of travel. */
  readonly tangents: Readonly<Record<Side, Vec2>>;
}

/** The gap between two consecutive approaches, where a corner return is built. */
export interface JunctionCorner {
  readonly id: string;
  /** The approach whose right side bounds this corner. */
  readonly fromApproachId: string;
  /** The approach whose left side bounds this corner. */
  readonly toApproachId: string;
  /** Interior angle between the two arms, radians. */
  readonly angle: number;
  /** Radius Atlas published for this corner, when it publishes one. */
  readonly radius: number | undefined;
}

export interface TurnMovement {
  readonly fromCorridorId: string;
  readonly fromLaneIndex: number;
  readonly toCorridorId: string;
  readonly toLaneIndex: number;
}

/** Where a crossing spans a roadway, and the walking lanes it joins. */
export interface Crossing {
  readonly id: string;
  readonly corridorId: string;
  readonly junctionId: string | undefined;
  readonly roadway: { readonly from: Vec2; readonly to: Vec2 };
  readonly width: number;
  readonly terminals: Readonly<Record<Side, CrossingTerminal | undefined>>;
  readonly signalGroupId: string | undefined;
}

export interface CrossingTerminal {
  readonly walkingLaneIndex: number;
  readonly point: Vec2;
}

export interface Junction {
  readonly id: string;
  readonly nodeIds: readonly string[];
  readonly centre: Vec2;
  readonly approaches: readonly Approach[];
  readonly corners: readonly JunctionCorner[];
  readonly turns: readonly TurnMovement[];
  readonly crossingIds: readonly string[];
}

/** A ring of block land that faces a corridor, where the frontage band ends. */
export interface Frontage {
  readonly corridorId: string | undefined;
  readonly side: Side | undefined;
  readonly ring: Ring;
}

export interface Block {
  readonly id: string;
  readonly districtId: string;
  readonly land: readonly Ring[];
  readonly frontages: readonly Frontage[];
}

export interface HighwaySupport {
  readonly centre: Vec2;
  readonly footprint: Ring;
}

export interface Highway {
  readonly id: string;
  readonly corridorIds: readonly string[];
  readonly path: readonly Vec2[];
  readonly width: number;
  readonly level: number;
  readonly deckThickness: number;
  readonly elevation: readonly ElevationKnot[];
  readonly supports: readonly HighwaySupport[];
}

export interface WaterSurface {
  readonly id: string;
  readonly ring: Ring;
  readonly elevation: number;
}

export type ExclusionKind = 'parcel' | 'transit-bay' | 'transit-approach';

/** Land no street surface may cover. */
export interface Exclusion {
  readonly id: string;
  readonly kind: ExclusionKind;
  readonly ring: Ring;
}

export interface ArchitectureMeta {
  readonly version: string;
  readonly seed: string;
  readonly bounds: Box2;
  readonly boundary: Ring;
  readonly grid: { readonly origin: Vec2; readonly angle: number; readonly spacing: number };
}

/** What this blueprint actually carried, so a build can report it. */
export interface ArchitectureCapabilities {
  readonly turnMovements: boolean;
  readonly walkingLanes: boolean;
  readonly cornerRadii: boolean;
  readonly hydrology: boolean;
}

export interface Architecture {
  readonly meta: ArchitectureMeta;
  readonly capabilities: ArchitectureCapabilities;
  readonly districts: readonly District[];
  readonly corridors: readonly Corridor[];
  readonly junctions: readonly Junction[];
  readonly crossings: readonly Crossing[];
  readonly blocks: readonly Block[];
  readonly highways: readonly Highway[];
  readonly water: readonly WaterSurface[];
  readonly exclusions: readonly Exclusion[];
}

export interface ReadOptions {
  readonly requireTurnMovements?: boolean;
  readonly requireWalkingLanes?: boolean;
}
