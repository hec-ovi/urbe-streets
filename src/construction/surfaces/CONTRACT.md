# Native street surfaces

Fits surface geometry to retained ground polygons and emits owned triangle buffers. [Schema](schema.ts). `SurfaceBatch` takes source owner/ground IDs, road datum and the shared wear sampler; polygon, face and hardware entries return [SurfaceOutput](schema.ts) through `finish()`.

Buffers retain world-coordinate doubles until bounded export. Every vertex has position, normal, UV, continuous wear and road-relative height. Hardware keeps its original normals and UVs; surface normals follow actual triangle geometry. Physical and noncolliding paint/decal batches are distinct. Coverage claims refer only to emitted receiving surfaces, never new ground owners.

`Regions` fits CCW contours with explicit holes, checks triangulated area and supplies source convex half-plane cuts. Missing hole owners, lost area, incomplete hardware attributes and degenerate triangles fail with `E_INVARIANT`. Caller owns geometry lifetime and reserved-domain selection.

`EdgeRing` ports the source 6 cm gutter crown, 20 cm curb, 2 m scan stations, 6 mm sealed curb joints and inlet end caps. It uses exact road/gutter contacts from retained ground for its shared supports, including underpasses and outer corners. Structural joint beds retain each complete curb owner at its 7 mm recess and gutter owner at the 2 cm sunk-pan level, excluding real openings. Complementary body/joint intents fit the visible caps and gap walls; clipped numeric body views never become new cut authority. Gutter height reaches the authored road and curb interfaces exactly. Unknown or uncovered bands fail with owner evidence.

`Paving` uses the source row iterator, square corner cuts, 1.5 m fan panels, 2 m fan depths and 0.2 m accent strips. Whole-panel UVs and 6 mm gaps remain independent of asset cells. The source 7 mm joint recess fills the exact paving owner. Terminal joints include the diagonal enclosure of the two authored 1 mm boundaries; panel dimensions and owner coordinates remain unchanged. Every paving field requires complete intended row/corner coverage. Underpasses use one grade frame, and station fields use their published bay/approach frame with shaft openings.

`parking` emits the source 3 by 2.5 m panels inside each exact bay, 1 mm above the road, without painted dividers. `asphalt` samples the shared wear field on a 16 m world grid before export; its road domain excludes those parking panels and station shafts.

`Frame` exports shared Vec2 arithmetic and `along(frontage,station,depth)`, mapping authored stations and inward depth into world XZ. Feature and marking consumers use these same frames.

Depends on [geometry](../../geometry/CONTRACT.md), [native architecture](../../architecture/CONTRACT.md), source style data and Three.js geometry types. No renderer, materials, district generation or source-data mutation.

District consumers retain 0.5 m gutter interfaces and may supply ramp cuts across curb/gutter bands. Their replacement consumer owns the sloped crossing surface and coverage.
