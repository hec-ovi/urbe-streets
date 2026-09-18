import type { Ring, Vec2, Vec3 } from '../../geometry/schema.ts';
/** Vertex fields stay double precision; worker results arrive as Float64Array and read the same way. */
export interface NativeMeshData {
  id: string; surface: string; collision: boolean; ownerIds: string[]; groundIds: string[];
  positions: ArrayLike<number>; normals: ArrayLike<number>; uvs: ArrayLike<number>; wear: ArrayLike<number>; heights: ArrayLike<number>;
}
export interface NativeMesh extends NativeMeshData {
  positions: number[]; normals: number[]; uvs: number[]; wear: number[]; heights: number[];
}
export interface CoverageClaim { ownerId: string; rings: Ring[] }
export interface SurfaceContext { ownerId: string; groundIds: string[]; roadTop: number; wear: (point: Vec2) => number }
export interface SurfaceCut { id: string; kind: 'inlet' | 'channel' | 'ramp'; frontageId: string; start: number; end: number; setback: number; depth: number; ring: Ring }
export interface SurfaceOutput { meshes: NativeMesh[]; coverage: CoverageClaim[] }
export type HeightMap = number | ((point: Vec2) => number);
export type UvMap = (point: Vec2) => Vec2;
export interface GeometryPlacement { origin: Vec3; inward: Vec2 }
