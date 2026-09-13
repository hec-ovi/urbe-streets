# architecture

Reads Atlas 0.21.0 at-grade construction in one adapter.

`readAtlas(unknown)` returns [Architecture](schema.ts). It expands modules 1.0.0, retains non-module ground and crossing stripes, and checks source versions, basic geometry, lane bounds and IDs. It imports no sibling code. Unsupported fields/features return `E_UNSUPPORTED_ARCHITECTURE`; reservation mismatches return `E_UNSATISFIABLE`.

Depends on [Atlas](../../../atlas/CONTRACT.md) and [geometry](../geometry/CONTRACT.md).
