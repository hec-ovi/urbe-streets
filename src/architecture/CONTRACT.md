# CONTRACT: architecture

Purpose: reads a saved Atlas blueprint, gates its version, and normalizes it into the one architecture model every other box in this repo reads.

## Why it exists

Atlas owns its own shape and bumps it. Every other box here reads corridors, junctions and blocks, never Atlas JSON. One file changes when Atlas moves.

## In

`readArchitecture(source: unknown, options?: ReadOptions): Architecture`

- `source`: a parsed Atlas `CityBlueprint`.
- `options.requireTurnMovements`, `options.requireWalkingLanes`: when true, a blueprint missing either fails instead of reporting the gap.

`loadArchitecture(path: string, options?: ReadOptions): Promise<Architecture>` reads the file first.

## Out

`Architecture`, [schema.ts](schema.ts):

- `meta`: architecture version, seed, bounds, city boundary ring, building grid.
- `districts`: id, kind, wealth tier, boundary ring.
- `corridors`: one per Atlas street edge. Class, centerline path, carriageway width, per-side reserved width, ordered lanes with offset and direction, walking lanes per side, elevation knots, district ids, end node ids.
- `junctions`: one per physical junction. Its approaches with the arm frame and the two side tangent points, its corners between consecutive approaches, its crossings, and its turn movements.
- `blocks`: block land as disjoint rings, the frontage rings that face a corridor, and the district it belongs to.
- `highways`: one record per maximal highway run: path, width, level, deck thickness, ramp lengths, elevation knots, support footprints.
- `water`: water surface rings with their elevation. Empty when the city has no hydrology.
- `exclusions`: land no street surface may cover: parcel lots, transit entrance bays and their walking approaches.
- `capabilities`: which optional surfaces this blueprint actually carried.

Offsets follow the corridor's own frame: +offset is left of travel along `path`, metres.

## Capabilities

Atlas is moving to an architecture-only surface. Two fields it will publish are not in every blueprint, so the model reports them instead of guessing:

- `capabilities.turnMovements`: false means `junction.turns` is empty. No turn arrow is painted, because an arrow not declared legal is wrong.
- `capabilities.walkingLanes`: false means `corridor.walking` is empty. Crossing fields still cover the roadway Atlas names, and carry no terminal strips onto the walking band.

A build records its capabilities so a reviewer sees what was available.

## Invariants

- Reading is pure: the same blueprint gives a deeply equal model, and the source object is not mutated.
- Every corridor's reserved width covers its gutter, its curb and at least some paved width, or the read fails.
- Every lane offset lies inside the carriageway. Lanes are ordered left to right across the frame.
- Every crossing names a corridor in the model, and its roadway span lies on that corridor.
- Coordinates are passed through unchanged. This box snaps nothing and moves nothing.

## Errors

`StreetsError` with:
- `E_UNSUPPORTED_ARCHITECTURE`: the blueprint version is outside the supported range, or a required field is missing or unreadable. The message names the field.
- `E_INVALID_PARAMS`: options fail validation.

## Supported versions

`SUPPORTED_ARCHITECTURE` in [versions.ts](versions.ts) holds the range. Atlas blueprint `0.21` is the current floor.

## Dependencies

- [atlas](../../../atlas/CONTRACT.md), read only, through a saved blueprint. No code import.
