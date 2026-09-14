import type { NativeRoad } from '../../architecture/native-schema.ts';
import type { Vec2 } from '../../geometry/schema.ts';
export interface RoadFrame { road: NativeRoad; start: Vec2; end: Vec2; d: Vec2; n: Vec2; length: number; top: number }
