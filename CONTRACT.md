# Streets 0.1.0

Builds bounded GLB street assets from saved Atlas construction with retained ground ownership and seeded material bindings.

## Call

`build(request, options): Promise<StreetBuild>` from `src/index.ts`.

Inputs: [StreetRequest and BuildOptions](src/schema/request.ts), [Materials catalog subset](src/schema/materials.ts). Output: [StreetBuild](src/schema/result.ts). CLI: [contract](src/cli/CONTRACT.md).

Required: `blueprint`, `design.version`, `design.finishes`, integer `seed`, `options.materials`. `mode` defaults to `glb`; omitted `outDir` returns bytes in `assets`. A destination must be new and its parent must exist. `manifest` mode has no assets and sets every piece's `asset` to null.

## Supported construction

Atlas blueprint 0.21.0, flat at-grade streets. Reads published physical module prisms (modules 1.0.0), their placements, non-module ground, and crossing stripes. Module planning covers are replaced by their physical parts, once. No source coordinates, levels, lane offsets or widths change. Each source role needs a catalog key; arrays select a finish by seed and owner. Material variants use the same owner seed. Catalog identity is SHA-256 of the supplied catalog JSON.

`pieces` are clipped to 128 m spatial cells with city-frame bounds and relative GLB paths. Piece kinds describe their content: `block-frontage` includes paving, `crossing` is paint only, `junction` is roadway. Mixed cells retain all source IDs. `ground.owners` retain source polygons and absolute bottom/top; vertically stacked solids have separate owners. Markings have no ground owner. The physical cover must equal the published street land; overlapping solids and excluded parcel land fail.

`construction` records retained module frames and material selections. `textures` carries catalog-reference bindings; consumers supply the actual maps, including separate roughness and metallic maps. GLBs contain scalar material values and binding identities, with no embedded textures. Catalog map paths are validated as references, not read from disk. Tiled UVs use declared metre scale; exact maps require a matching panel aspect. Asset splitting preserves the source UV frame.

`capabilities` reports absent legal turns and walking-lane identities; no new arrows or walking terminal strips are generated. Highways, stations and hydrology are unsupported. Source module hardware is retained; additional furniture is not generated. The [boundary proposals](docs/ISSUES.md) describe the complete stage target.

The same request, catalog content and mode produce identical manifest data, piece order and GLB bytes. Output paths and CLI timings are excluded from identity. Returned snapshots have no shared mutable state with the input.

## Errors

Closed set: `StreetsError {code, message, details?}` in [errors.ts](src/errors.ts).

- `E_INVALID_PARAMS`: malformed request/options, unavailable catalog keys/maps, invalid catalog entries, unreadable JSON or output IO failure.
- `E_UNSUPPORTED_ARCHITECTURE`: unsupported version/feature or unreadable geometry/reference, with its field path.
- `E_UNSATISFIABLE`: lane exceeds its reservation, exact material cannot fit, crossing paint leaves the roadway, or construction enters a parcel.
- `E_INVARIANT`: constructed solids overlap, cover or triangulation fails, or construction/export fails unexpectedly. Details retain source identity where available.

## Dependencies

[Atlas contract](../atlas/CONTRACT.md) and [blueprint schema](../atlas/schema/blueprint.ts), read by [one adapter](src/architecture/atlas.ts). [Materials contract](../materials/CONTRACT.md), [theme schema](../materials/schema/theme-index.schema.json) and [entry schema](../materials/schema/material-entry.schema.json), consumed as saved catalog data. No sibling code imports or running services. Runtime packages: glTF Transform core, clipper2-ts and earcut.
