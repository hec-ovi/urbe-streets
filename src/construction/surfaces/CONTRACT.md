# Native street surfaces

Fits surface geometry to retained ground polygons and emits owned triangle buffers. [Schema](schema.ts). `SurfaceBatch` takes source owner/ground IDs, road datum and the shared wear sampler; polygon, face and hardware entries return [SurfaceOutput](schema.ts) through `finish()`.

Buffers retain world-coordinate doubles until bounded export. Every vertex has position, normal, UV, continuous wear and road-relative height. Hardware keeps its original normals and UVs; surface normals follow actual triangle geometry. Physical and noncolliding paint/decal batches are distinct. Coverage claims refer only to emitted receiving surfaces, never new ground owners.

`Regions` fits CCW contours with explicit holes, checks triangulated area and supplies source convex half-plane cuts. Missing hole owners, lost area, incomplete hardware attributes and degenerate triangles fail with `E_INVARIANT`. Caller owns geometry lifetime and reserved-domain selection.

`EdgeRing` ports the source 6 cm gutter crown, 20 cm curb, 2 m scan stations, 6 mm sealed curb joints and inlet end caps. It uses exact road/gutter contacts from retained ground for its shared supports, including underpasses and outer corners. Complementary body/joint intents partition each original band; clipped numeric body views never become new cut authority. Gutter height reaches the authored road and curb interfaces exactly. Unknown or uncovered bands fail with owner evidence.

Depends on [geometry](../../geometry/CONTRACT.md), [native architecture](../../architecture/CONTRACT.md), source style data and Three.js geometry types. No renderer, materials, district generation or source-data mutation.
