# CONTRACT: geometry

Purpose: the exact 2D polygon toolkit, the seeded hash, and the mesh primitives every surface in this repo is built from.

## Why it exists

Every construction box needs the same operations: offset a centerline, fillet a corner, clip a paving cell to its region, subtract water from a band, triangulate a ring. They live here once, with the grid, the winding and the determinism rules in one place, so the ground partition and the meshes agree to the millimetre.

## In

Value types in [schema.ts](schema.ts): `Vec2`, `Vec3`, `Ring`, `Shape`, `Box2`, `Box3`, `Span`, `MeshData`, `Surface`, `HeightField`.

### 2D toolkit

- [vec.ts](vec.ts): `add`, `sub`, `scale`, `dot`, `cross`, `length`, `distance`, `normalize`, `left`, `lerp`.
- [rings.ts](rings.ts): `area`, `centroid`, `bounds`, `isCCW`, `toCCW`, `contains`, `clean`, `snapRing`, `ringsEqual`.
- [booleans.ts](booleans.ts): `union`, `intersect`, `subtract`, `inset`, `offsetRing`. Integer clipper coordinates at 1 mm, so a result lands on the grid by construction and an exact partition is provable.
- [paths.ts](paths.ts): `pathLength`, `stationAt`, `frameAt`, `offsetPath`, `along`, `rectangle`, `resample`.
- [arcs.ts](arcs.ts): `sampleArc`, `fillet`, `fanRays`. A fillet steps at most 15 degrees.
- [triangulate.ts](triangulate.ts): `triangulate(shape)` to indices, via earcut, holes supported.
- [random.ts](random.ts): `random(seed, key)`, an FNV-1a hash finished with two xor-multiply rounds, normalized by 2^32. Order independent, so a caller can sample any key in any order and get the same number.

### Mesh primitives

Flat work, the bulk of a street, in [SurfaceBatch.ts](SurfaceBatch.ts):

- `polygon(finish, ring, y, uv?, holes?, order?)`: a horizontal surface, triangulated, normal +Y, every triangle forced to one winding.
- `face(finish, points3D, uv)`: a planar polygon in 3D, for the sloped gutter and the inlet end caps. Normal by Newell.
- `wall(finish, a, b, low, high, scan?)`: a vertical quad, for the curb riser and the frontage retaining wall.

Solid work, hardware only, one file each: [Prism.ts](Prism.ts) (faceted extrusion of a profile along an axis), [Loft.ts](Loft.ts) (smooth skin through rings), [CastPrism.ts](CastPrism.ts) (a loft with seeded cast-concrete wear), [Tube.ts](Tube.ts) (an octagonal sweep with a parallel-transported frame), [SlopedPlate.ts](SlopedPlate.ts) (a box whose top and bottom follow a height field), [Beam.ts](Beam.ts) (a hexagonal strut between two points).

[MeshBuilder.ts](MeshBuilder.ts) accumulates positions, normals, uvs and indices in insertion order and freezes to `MeshData`. Insertion order is the determinism guarantee.

## Out

`MeshData`: four typed arrays with triangle indices and world-metre positions.

`order` is the decal layer: it selects the y offset above a surface and the draw order, and it is part of the batch key, so a decal never merges into the surface under it.

## Levels

One place heights live. Road surface is y 0, as Atlas's ground levels already read it.

| Surface | Y |
| --- | --- |
| roadway | 0 |
| gutter, at the roadway edge | 0 |
| gutter, at the curb face | 0.06 |
| curb riser | 0.06 to 0.20 |
| curb top, sidewalk slabs | 0.20 |
| sidewalk joint bed | 0.193 |

The gutter slopes up to the curb face across its 0.30 m: a 20 percent cross slope. The slab reveal over its joint bed is 7 mm. Decals stack above the roadway from 0.005, 1 mm per `order`.

## Invariants

- Every emitted vertex coordinate is a multiple of 1 mm.
- Rings are CCW with no repeated first point and no duplicate consecutive points; holes are CW.
- Triangle winding is counter-clockwise seen from the face normal.
- A boolean on grid input gives grid output. The union of a partition's parts equals the whole to within one grid unit of area.
- The same call with the same arguments gives byte-identical arrays. No wall clock, no ambient randomness.
- UVs are whatever the caller asks for, and the default is world-space metres, so a surface moved between pieces keeps its finish alignment. A paving cell keeps its UVs anchored to its uncut module origin, so a clipped cell shows the matching crop of one full image.
- A cast prism reproduces the reference hash exactly: `frac(sin(seed*12.9898 + a*78.233 + b*37.719) * 43758.5453) * 2 - 1`.

## Errors

`StreetsError` with `E_INVARIANT` when a ring is degenerate, a fillet does not fit between its tangents, or a triangulation drops area. `E_INVALID_PARAMS` when an argument is out of range.

## Dependencies

- `clipper2-ts` for polygon booleans and offsets.
- `earcut` for triangulation.
