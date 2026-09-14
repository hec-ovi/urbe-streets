# Native street surfaces

Fits surface geometry to retained ground polygons and emits owned triangle buffers. [Schema](schema.ts). `SurfaceBatch` takes source owner/ground IDs, road datum and the shared wear sampler; polygon, face and hardware entries return [SurfaceOutput](schema.ts) through `finish()`.

Buffers retain world-coordinate doubles until bounded export. Every vertex has position, normal, UV, continuous wear and road-relative height. Hardware keeps its original normals and UVs; surface normals follow actual triangle geometry. Physical and noncolliding paint/decal batches are distinct. Coverage claims refer only to emitted receiving surfaces, never new ground owners.

`Regions` fits CCW contours with explicit holes, checks triangulated area and supplies source convex half-plane cuts. Missing hole owners, lost area, incomplete hardware attributes and degenerate triangles fail with `E_INVARIANT`. Caller owns geometry lifetime and reserved-domain selection.

Depends on [geometry](../../geometry/CONTRACT.md), [native architecture](../../architecture/CONTRACT.md), source style data and Three.js geometry types. No renderer, materials, district generation or source-data mutation.
