# CONTRACT: finishes

Purpose: resolves every finish role a construction box asked for into a materials key, and places the wear-driven surface artifacts.

## In

`resolveFinishes(surfaces: SurfaceSet[], plan: StreetPlan, architecture: Architecture, source: MaterialsSource): FinishedBuild`

`source` is the materials catalog: a path to read, or a preloaded index.

## Out

- `bound`: every `Surface` with its finish role replaced by a materials key, `theme/kind/tier`.
- `artifacts`: the decal surfaces the wear field produced.
- `textures`: the mode and the reason, as Exterior reports it, so a build says whether real maps were found or keys were emitted unresolved.

## Role to key

A finish role is a construction word (`paving-base`, `curb`, `gutter`, `joint`, `lane-paint`, `guard-concrete`). A materials key is `theme/kind/tier`. This box holds the one table between them, and the tier comes from the district the surface stands in, passed through verbatim from Atlas.

A role whose key the catalog cannot resolve is reported, not substituted. A silent fallback to a neighbouring material is how a city ends up grey and nobody notices.

## Finish families

Per block, a seeded roll and the wear field pick the family:

- The block style is coated below a roll of 0.35, industrial above a wear of 0.55, otherwise concrete.
- The base finish is polished when the style is coated, a worn variant when the roll falls below `wear * 0.65`, otherwise ordinary.
- Accent is oxblood below a roll of 0.75, otherwise terracotta. Light is aggregate, dark is basalt, metal is tread, painted below a roll of 0.35.

District kind and wealth tier choose the family set, so an industrial poor block and a downtown high-wealth block read differently with the same code.

## Wear and artifacts

The wear field comes from the plan. Every vertex of an affected surface carries its sampled wear, so a shader gets a smooth world-space field with no mask texture and no seam between pieces.

Artifacts walk the roadway every 6 m from 3 m inside each end. At each station the field is sampled and three rolls are made: a crack below `wear * 0.8`, graffiti below `0.012 + wear * 0.22`, an oil patch below `wear * 0.17`. Each is a flat quad at its decal order, offset across the roadway by a seeded amount, snapped beside the median where one exists.

## Invariants

- Every bound surface carries a key the catalog resolved, or appears in the unresolved report. No surface is silently re-finished.
- A tier is Atlas's, passed through unchanged.
- The same surfaces, plan and catalog give the same keys and the same artifacts in the same order.
- Wear is 0 everywhere when the design asks for no wear, and the field never exceeds 1.
- An artifact lies inside the roadway it was placed on.

## Errors

`E_INVALID_PARAMS` when the materials source cannot be read. `E_INVARIANT` when a construction box asked for a finish role this box has no entry for, naming the role.

## Dependencies

- [materials](../../../materials/CONTRACT.md) for the catalog. Street finishes live there, beside the building and interior ones.
- [plan](../plan/CONTRACT.md) for the wear field and the block families.
- [geometry](../geometry/CONTRACT.md) for the artifact quads.
