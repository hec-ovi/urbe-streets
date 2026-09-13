# geometry

Extrudes and splits CCW polygons into metre-based triangle buffers.

[Types](schema.ts): rings and bounds in, `MeshData` out. `SurfaceBatch.prism` emits top, bottom and outward sides. Polygon operations retain source coordinates; boolean checks use eight decimal places. Triangulation area mismatch returns `E_INVARIANT`.

Depends on earcut and clipper2-ts. Construction primitives are adapted from Three.js Scene Studio's district SurfaceBatch and furniture Prism.
