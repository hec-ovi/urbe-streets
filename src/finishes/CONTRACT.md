# finishes

Resolves source roles to seeded Materials catalog bindings.

`Catalog.load(source, design, seed)` reads a [catalog](../schema/materials.ts) object or JSON path. `resolve(role, owner)` returns a selected `MaterialBinding`. Arrays of design keys and catalog variants are picked once per owner/role. Missing keys, invalid map references or malformed entries return `E_INVALID_PARAMS`. Exact placement aspect mismatch returns `E_UNSATISFIABLE`.

Depends on [Materials](../../../materials/CONTRACT.md), Node file IO and SHA-256. Map bytes remain caller-owned.

`NativeCatalog.load(object|path)` reads source-native binding version 1 at the pinned source revision, validates safe published texture paths/hashes/dimensions, known effects/UV modes, finite parameters and map references, and owns its unmodified snapshot. `require(surface)` rejects missing constructed identities. Its SHA-256 hashes UTF-8 JSON.stringify with property/array order retained and no newline. Native effects are interpreted and fully schema-validated by the renderer against the Materials public schema; this box creates no shaders or texture bytes.
