export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];
export type Ring = readonly Vec2[];
export interface Box2 { min: Vec2; max: Vec2 }
export interface Box3 { min: Vec3; max: Vec3 }
export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
}
