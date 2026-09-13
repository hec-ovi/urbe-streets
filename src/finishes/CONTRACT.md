# finishes

Resolves source roles to seeded Materials catalog bindings.

`Catalog.load(source, design, seed)` reads a [catalog](../schema/materials.ts) object or JSON path. `resolve(role, owner)` returns a selected `MaterialBinding`. Arrays of design keys and catalog variants are picked once per owner/role. Missing keys, invalid map references or malformed entries return `E_INVALID_PARAMS`. Exact placement aspect mismatch returns `E_UNSATISFIABLE`.

Depends on [Materials](../../../materials/CONTRACT.md), Node file IO and SHA-256. Map bytes remain caller-owned.
