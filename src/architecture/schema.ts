import type { Box2, Ring, Vec2 } from '../geometry/schema.ts';
import type { FinishRole } from '../schema/request.ts';

export interface ConstructionSurface {
  id: string;
  sourceIds: string[];
  role: FinishRole;
  polygon: Ring;
  bottom: number;
  top: number;
  origin: Vec2;
  turn: number;
}
export interface Architecture {
  version: string;
  bounds: Box2;
  boundary: Ring;
  surfaces: ConstructionSurface[];
  reserved: Ring[];
  exclusions: Ring[];
  modules: boolean;
  omissions: string[];
}
