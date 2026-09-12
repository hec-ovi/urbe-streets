# CONTRACT: streets

Purpose: deterministically builds the whole city's street construction (paving, curbs, gutters, corner returns, markings, crossing fields, parking bays, guardrails and surface artifacts) as model assets, from the architecture Atlas publishes.

Status: v0.1.0, contract draft. Breaking changes go through the orchestrator.

## Boundary

Atlas owns architecture: where a corridor runs, how wide it is reserved, how many lanes it carries, their directions, which turns are legal, where people walk, where they cross, how a car reaches a deck. Streets owns construction: every physical surface inside that reservation, and every styling choice about it.

Streets never moves a centerline, changes a reserved width, adds or removes a lane, or invents a crossing. It never publishes navigation. Engine routes cars and NPCs on Atlas lanes and walking lanes, and renders and collides on these meshes.

This mirrors Atlas to Exterior: Atlas gives a footprint, type and tier, Exterior decides every window. Atlas gives a corridor, class and district, Streets decides every panel.

## Conventions
- Units: metres. Ground plane XZ, +Y up, right-handed. 2D points `[x, z]`, CCW rings, first point not repeated (same as Atlas).
- Determinism: same blueprint, same design and same seed give byte-identical assets and manifest. No LLM, no wall clock, no ambient randomness.
- Coordinates are the city frame Atlas published. Pieces are not re-centred.

## In

`build(request: StreetRequest, options?: BuildOptions): Promise<StreetBuild>`

One pass over the whole city.

`request`:
- `blueprint`: an Atlas `CityBlueprint` at a supported architecture version. Read surfaces: `meta` (boundary, grid, bounds), `districts` (kind and wealth tier, for zone-dependent selection), `streets` (nodes, edges, class, centerline path, elevation profile, carriageway width, per-side reserved width, lanes, turn movements, walking lanes, crossings, highway structures), `blocks` (frontage rings and their land), `transit` entrance bays, `hydrology` water surfaces.
- `design`: finish family IDs, module catalogs, row layouts and per-district overrides. Validated before construction.
- `seed`: one integer. Drives every selection Streets owns.

`options`: materials source (path or preloaded catalog), output directory, asset mode.

## Out

`StreetBuild`: a manifest plus the assets it names.

- `pieces`: one record per emitted asset with its ID, kind (`block-frontage`, `junction`, `highway-run`, `crossing`, `underpass`), the Atlas IDs it was built from, its bounding box and its asset path. Engine streams on these bounds.
- `ground`: the exact disjoint cover of all street land, each owner with its polygon, surface role, bottom and top. This is the sole render and collision authority for street surfaces.
- `construction`: the resolved selections, so a reviewer can read what was chosen where: per corridor side the band layout, per region the layout, frame and finish family, per junction the corner treatment.
- `textures`: mode and reason, as Exterior reports it.
- `capabilities`: which optional architecture surfaces the source blueprint carried, so an absent turn arrow has a recorded cause.

One pass emits many pieces. A 10 km city cannot be one model, and Engine needs bounded loads.

## Levels

Street heights live here, not in Atlas. Road surface is y 0, as Atlas's ground levels already read it.

| Surface | Y |
| --- | --- |
| roadway | 0 |
| gutter, at the roadway edge | 0 |
| gutter, at the curb face | 0.06 |
| curb riser | 0.06 to 0.20 |
| curb top, sidewalk slabs | 0.20 |
| sidewalk joint bed | 0.193 |

The gutter slopes up to the curb face across its 0.30 m. Markings and artifacts stack above the roadway from 0.005 m, 1 mm per decal order.

## Capabilities

Two architecture surfaces are not in every blueprint, and Streets reports them rather than guessing:

- Without turn movements, no turn arrow is painted. An arrow not declared legal is a traffic instruction that does not exist.
- Without walking lanes, a crossing field covers the roadway Atlas names and carries no terminal strip onto the walking band.

## What Streets decides

Inside each reserved side width: the band layout (curb, gutter, border, furnishing, walking, frontage) and its widths. Panel row layouts, module pitches, joints and finish families per district kind and wealth tier. Corner returns: radius, tangents, fan subdivision and accent cuts. Gutter profile, inlets, grates, ramps and cable troughs. Markings: lane lines, stop bars, crossing style per road class, pedestrian stencils, and turn arrows read from Atlas turn movements. Parking bays and guardrail groups on eligible frontages. Wear zones and surface artifacts (cracks, oil, graffiti) by district.

Furniture and lighting are later additions to this box, not to Atlas.

## Invariants

- Every emitted surface lies inside the reservation Atlas published for its corridor, block or bay. Nothing paves into water, a parcel lot, a station bay or another corridor's roadway.
- `ground` is one exact partition: owners are disjoint, and together they cover the street land Atlas reserved, once.
- Roadway ownership takes precedence where corridors meet at a junction.
- A crossing field covers the roadway its Atlas crossing names, and its terminals land on the walking lanes that crossing joins.
- Turn arrows show exactly the movements Atlas declares legal, and no others.
- Highway decks, ramps and supports follow the Atlas structure record's path, width, elevation profile and footprints.
- A lane marking separates lanes at the offsets Atlas published. Streets does not reinterpret lane count or direction.
- Identical input produces identical output, including asset bytes and piece order.
- Atlas imports nothing from this box. The dependency runs one way.

## Errors

Closed set, thrown as `StreetsError { code, message, details? }`:
- `E_INVALID_PARAMS`: design or options fail validation; message names the field.
- `E_UNSUPPORTED_ARCHITECTURE`: the blueprint's architecture version or a required field is missing or unreadable.
- `E_UNSATISFIABLE`: a published reservation cannot carry a buildable cross section (message names the edge, side and width).
- `E_INVARIANT`: construction broke its own coherence check; a Streets bug, report with seed and blueprint.

## Dependencies

- [atlas](../atlas/CONTRACT.md): city architecture, reservations, lanes, walking lanes, crossings, turn movements, highway structures, blocks, water.
- [materials](../materials/CONTRACT.md): themed finish catalogs. Street finishes live there, beside the building and interior ones.
