# CONTRACT: ground

Purpose: owns the exact disjoint partition of all street land, the sole render and collision authority for street surfaces.

## Why it exists separately

A mesh may be clipped, batched, split across pieces and dropped at distance. A collision surface may not. The partition is one proof, checked once, independent of how the meshes were fitted: every owner disjoint, and together the street land Atlas reserved, covered once.

## In

`buildGround(plan: StreetPlan, architecture: Architecture): GroundPartition`

## Out

`GroundPartition`, [schema.ts](schema.ts): `owners`, each with

- `id`, and the Atlas id it was reserved from,
- `role`: `roadway`, `gutter`, `curb`, `paved`, `bay`, `deck` or `support`,
- `ring` plus holes, on the 1 mm grid,
- `bottom` and `top` in metres.

Plus `cover`: the total area claimed, the reserved area, and their difference, so a caller can see the proof rather than trust it.

## Precedence

Where reservations meet, ownership resolves in one fixed order, highest first:

1. water, which no street owns
2. transit entrance bays and parcel lots, which are excluded land
3. roadway, including the junction land where corridors meet
4. gutter
5. curb
6. paved
7. block frontage

Roadway taking precedence at a junction is what stops four corridors claiming the same square.

## Invariants

- Owners have mutually disjoint interiors. Shared boundaries are exact and shared to the millimetre.
- The union of all owners equals the street land Atlas reserved, minus excluded land, to within one grid unit of area.
- Every owner's `bottom` is below its `top`, and the levels agree with the geometry box's level table.
- No owner covers water, a parcel lot or a station bay.
- A role appears with the same levels everywhere it appears.
- The same plan gives the same owners in the same order.

## Errors

`E_INVARIANT` with the two offending owner ids when interiors overlap, and with the missing area when the cover falls short.

## Dependencies

- [plan](../plan/CONTRACT.md) for the band spans and the corner cuts.
- [geometry](../geometry/CONTRACT.md) for the exact integer booleans the proof rests on.
