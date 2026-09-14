import type { Box3, Vec3 } from '../geometry/schema.ts';
import type { NativeMesh } from '../construction/surfaces/schema.ts';
export interface NativePieceData { id: string; origin: Vec3; bounds: Box3; meshes: NativeMesh[] }
export interface NativeEncodedPiece { bytes: Uint8Array; bounds: Box3; triangles: number }
