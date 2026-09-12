# CONTRACT: surfaces

Purpose: builds every paved surface of the street from a resolved plan: the roadway, the sloped gutter, the curb, the paving cells, the corner returns and the frontage.

## In

`buildSurfaces(plan: StreetPlan, architecture: Architecture): SurfaceSet`

## Out

`SurfaceSet`, [schema.ts](schema.ts): a flat list of `Surface` records, each with its mesh, its finish role, its bounds, and the Atlas id and band role it came from. `assets` groups them; nothing here knows about files.

## What it builds

One file per responsibility:

- [Roadway.ts](Roadway.ts): the carriageway surface per corridor, clipped to the junction land it does not own and to water.
- [EdgeRing.ts](EdgeRing.ts): walks a frontage ring and emits, in modules of at most 2 m, the gutter quad sloping from the roadway edge up to the curb face, the curb riser wall, and the curb top. Module cuts fall at every 2 m and at every inlet boundary, so the scan stays continuous through a return and closes cleanly beside an inlet.
- [Paving.ts](Paving.ts): lays whole panel modules over a range overshooting both frontage ends, then clips each to its region and subtracts the exclusions. Partial cells exist only as clipped wholes, and UVs stay anchored to the uncut module origin, so a cut cell shows the matching crop of one full image.
- [JointBed.ts](JointBed.ts): the joint surface under the slabs, 7 mm below them, which is what makes the paving read as a grid.
- [CornerReturn.ts](CornerReturn.ts): the accent strips along each cut and the radial fan between them, laid to the curb back, clipped to the frontage region.
- [Frontage.ts](Frontage.ts): the retaining wall where the paving meets block land, and the bay and channel exclusions.
- [Parking.ts](Parking.ts): the bay surface in 3 m modules across its full depth, with its diagonal ends.
- [Highway.ts](Highway.ts): the deck, its soffit, and the supports, on the Atlas structure path and elevation.

## Invariants

- Every surface lies inside the reservation Atlas published for its corridor, block or bay. Nothing paves into water, a parcel lot, a station bay or another corridor's roadway.
- The gutter rises 0.06 m across its 0.30 m to meet the curb face, and the curb riser carries it from there to the 0.20 m curb top.
- The curb runs unbroken through a corner return: its modules are cut by distance, not by corner, so no sliver appears where the arc meets the straight.
- A corner is fully paved. No gap is left between the fan, the accent strips and the straight rows.
- Over an inlet's reserved span the gutter, the curb top and the riser are omitted and the pan takes the whole span, so the mouth is clear.
- Paving cells never overlap, and every cell lies inside its frontage region.
- Identical plan and architecture give byte-identical meshes in the same order.

## Errors

`E_INVARIANT` when a clip drops a region to nothing, a ring degenerates, or a corner cannot be paved. `E_UNSATISFIABLE` never originates here; the plan has already proven the section fits.

## Dependencies

- [plan](../plan/CONTRACT.md) for every dimension and selection.
- [geometry](../geometry/CONTRACT.md) for the clipping, the rings and the mesh primitives.
