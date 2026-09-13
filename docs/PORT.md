# Construction port

| Source in Three.js Scene Studio | Adopted code |
| --- | --- |
| `scene/street/district/SurfaceBatch.ts` | Polygon triangulation, upward winding and separate flat face normals in `src/geometry/SurfaceBatch.ts`. |
| `scene/street/furniture/Prism.ts` | Closed prism caps, side faces and dominant-face metre UV mapping in `SurfaceBatch.ts` and `src/assets/glb.ts`. |
| `scene/street/MeshBatch.ts` | Compatible-material batching in `src/assets/glb.ts`. |
| `scene/materials/textures.ts` | Tile-versus-exact UV semantics in `src/finishes/catalog.ts` and `src/assets/glb.ts`; map loading remains consumer-owned. |

These are adapted construction primitives. The source district planner, block/row/corner builders, detailed furniture and node materials are not incorporated. Their required boundary work is in [ISSUES.md](ISSUES.md).

`examples/request.json` is a synthetic 260 m at-grade strip with asymmetric module orientation, panel joints and published crossing stripes. `examples/catalog.json` supplies placeholder map references for API tests. It is not a rendered appearance reference or an accepted city.

Validation uses the root library entry, actual GLB decoding and output files. One test file has six cases. Source lines: 287 across 3 TypeScript files before, 759 across 17 after. Tests: 0 files/cases before, 1 file and 6 cases after. Source counts include blank lines and comments; test fixtures are excluded.

Node 24.21.0: the example CLI wrote 6 GLBs, 21,888 triangles and 1,821 ground owners in 122 ms. An in-memory run took 160 ms and returned 2,121,764 asset bytes. These are single synthetic-strip runs, not a full-city performance measurement. Build, tests, CLI export and root skill validation pass. Real catalog appearance and Atlas/Engine integration remain unverified.
