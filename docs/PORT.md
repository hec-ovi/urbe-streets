# Construction port

| Source in Three.js Scene Studio | Adopted code |
| --- | --- |
| `scene/street/district/SurfaceBatch.ts` | Polygon triangulation, upward winding and separate flat face normals in `src/geometry/SurfaceBatch.ts`. |
| `scene/street/furniture/Prism.ts` | Closed prism caps, side faces and dominant-face metre UV mapping in `SurfaceBatch.ts` and `src/assets/glb.ts`. |
| `scene/street/MeshBatch.ts` | Compatible-material batching in `src/assets/glb.ts`. |
| `scene/materials/textures.ts` | Tile-versus-exact UV semantics in `src/finishes/catalog.ts` and `src/assets/glb.ts`; map loading remains consumer-owned. |

These are adapted construction primitives. The source district planner, block/row/corner builders, detailed furniture and node materials are not incorporated. Their required boundary work is in [ISSUES.md](ISSUES.md).

`examples/request.json` is a synthetic 260 m at-grade strip with asymmetric module orientation, panel joints and published crossing stripes. `examples/catalog.json` supplies placeholder map references for API tests. It is not a rendered appearance reference or an accepted city.

Validation uses the root library entry, actual GLB decoding and output files. One test file has six cases. The starting repository has 287 source lines across three TypeScript files and no test files/cases. Source counts include blank lines and comments; test fixtures are excluded.
