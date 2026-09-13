# assets

Splits construction at 128 m cell boundaries and emits one GLB per occupied cell.

`partitionPieces(` [surfaces](../architecture/schema.ts) `)` retains source IDs and UV frames. `encodePiece` returns bytes, measured city-frame bounds and triangle count. The [manifest](../schema/result.ts) names every asset and its ground owners. Mesh primitives batch by material key and variant.

`Output` writes only into a new destination and publishes the manifest last. IO errors use `E_INVALID_PARAMS`; geometry/export failures propagate as `E_INVARIANT` through `build`.

Depends on [geometry](../geometry/CONTRACT.md), [finishes](../finishes/CONTRACT.md), glTF Transform core and Node IO.
