# CONTRACT: assets

Purpose: splits the city's construction into bounded streamable pieces, writes one model per piece, and writes the manifest that names them.

## Why pieces

A 10 km by 10 km city cannot be one model, and the engine needs bounded loads. One pass over the whole city therefore emits many pieces, each a semantic unit the engine can stream on its bounds.

## In

`writeAssets(build: FinishedBuild, ground: GroundPartition, options: AssetOptions): Promise<StreetBuild>`

`options`: the output directory, and the asset mode: `glb` writes models, `manifest` writes the manifest alone.

## Out

`StreetBuild`, the public manifest, [schema.ts](schema.ts):

- `pieces`: per piece, its id, its kind, the Atlas ids it was built from, its bounding box, and its asset path.
- `ground`: the exact partition, as the sole render and collision authority for street surfaces.
- `construction`: the resolved selections, so a reviewer can read what was chosen where.
- `textures`: the mode and the reason.
- `capabilities`: what the source architecture carried, so a missing turn arrow has a recorded cause.

## The pieces

| Kind | Unit |
| --- | --- |
| `block-frontage` | one block's paving, curbs, gutters, corner returns, frontage and the hardware on it |
| `junction` | the junction roadway, its corner returns and its markings |
| `crossing` | one crossing field with its stencils |
| `highway-run` | a bounded length of deck with its soffit and supports |
| `underpass` | the grade surface beneath a deck |

A piece whose bounds exceed the size cap is split along its longest axis until each part fits, keeping its kind and naming its parent.

## Models

One glTF binary per piece. Inside it, one mesh per finish key, so a piece draws in as many calls as it has distinct finishes. Material names are the materials key verbatim, which is how the engine resolves them.

Hardware parts are merged into their piece by finish rather than instanced, so a piece loads with no extension support required.

## Invariants

- Every surface lands in exactly one piece. No surface is dropped and none is duplicated.
- A piece's bounding box contains every vertex it holds.
- A piece's asset path is relative to the output directory and stable across builds.
- The manifest names only files that were written.
- Piece order, and the bytes of every asset, are identical for identical input.
- UVs are world-space, so splitting a surface between pieces does not move its finish.

## Errors

`E_INVALID_PARAMS` when the output directory cannot be written or the mode is unknown. `E_INVARIANT` when a surface belongs to no piece, or a piece cannot be split below the cap.

## Dependencies

- [finishes](../finishes/CONTRACT.md) for the bound surfaces.
- [ground](../ground/CONTRACT.md) for the partition the manifest publishes.
- `@gltf-transform/core` for writing glTF binaries.
