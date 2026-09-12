/** Ground plane is XZ, +Y up, right handed. A 2D point is `[x, z]` in metres. */
export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];

/** A closed ring, CCW, first point not repeated. */
export type Ring = readonly Vec2[];

export interface Box2 {
  readonly min: Vec2;
  readonly max: Vec2;
}

export interface Box3 {
  readonly min: Vec3;
  readonly max: Vec3;
}

/** A polygon with holes. Outer ring CCW, holes CW. */
export interface Shape {
  readonly outer: Ring;
  readonly holes: readonly Ring[];
}

/** One interval across a corridor side, measured outward from the carriageway edge. */
export interface Span {
  readonly start: number;
  readonly end: number;
}

/** Interleaved triangle data for one surface. Positions are world metres. */
export interface MeshData {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly indices: Uint32Array;
}

/** A mesh plus the finish it is drawn with, ready to batch. */
export interface Surface {
  readonly id: string;
  readonly mesh: MeshData;
  readonly finishKey: string;
  readonly bounds: Box3;
}

/** Height of a surface at a point, for gutters and ramps that are not flat. */
export type HeightField = (point: Vec2) => number;

/** The coordinate grid every emitted vertex lands on: 1 mm. */
export const GRID = 0.001;

/** Triangles per metre of arc, the corner fan and tube resolution. */
export const ARC_DENSITY = 4;
